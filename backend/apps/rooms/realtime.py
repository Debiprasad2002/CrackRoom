"""
Shared room state: the synced timer, presence and the WebSocket broadcast channel.

The timer is stored as a cycle rather than a countdown, so no background job is needed:
a running timer has an anchor (the moment a focus block began at cycle position 0) and
every client derives the current phase from the anchor, the room's rhythm and its clock.
"""

import hashlib
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core import signing
from django.db.models import Count, Q
from django.utils import timezone

from .models import Room, RoomPresence, TimerStatus

PRESENCE_TTL = timedelta(seconds=75)  # Clients ping every 25 s; three missed pings and they are gone.
TICKET_SALT = 'crackroom.room-socket'
TICKET_MAX_AGE = 60


def group_name(slug: str) -> str:
    return f'room.{slug}'


# --- Timer ---------------------------------------------------------------------------


def cycle_seconds(room: Room) -> int:
    return (room.focus_minutes + room.break_minutes) * 60


def cycle_position(room: Room, now=None) -> float:
    """Seconds into the current focus+break cycle."""
    if room.timer_status == TimerStatus.PAUSED:
        return room.timer_offset
    if room.timer_status == TimerStatus.RUNNING and room.timer_anchor:
        now = now or timezone.now()
        return (now - room.timer_anchor).total_seconds() % cycle_seconds(room)
    return 0.0


def timer_state(room: Room, now=None) -> dict:
    now = now or timezone.now()
    focus = room.focus_minutes * 60
    position = cycle_position(room, now)
    in_focus = position < focus or room.break_minutes == 0
    remaining = (focus - position) if in_focus else (cycle_seconds(room) - position)
    return {
        'status': room.timer_status,
        'phase': 'focus' if in_focus else 'break',
        'focusSeconds': focus,
        'breakSeconds': room.break_minutes * 60,
        # Clients recompute from these, so a slow network never makes rooms drift apart.
        'anchor': room.timer_anchor.isoformat() if room.timer_status == TimerStatus.RUNNING else None,
        'offsetSeconds': round(position, 3) if room.timer_status == TimerStatus.PAUSED else None,
        'remainingSeconds': round(max(0.0, remaining), 3),
        'serverTime': now.isoformat(),
    }


def apply_timer_action(room: Room, action: str, now=None) -> None:
    now = now or timezone.now()
    if action == 'start':
        room.timer_status = TimerStatus.RUNNING
        room.timer_anchor = now
        room.timer_offset = 0
    elif action == 'pause' and room.timer_status == TimerStatus.RUNNING:
        room.timer_offset = cycle_position(room, now)
        room.timer_status = TimerStatus.PAUSED
    elif action == 'resume' and room.timer_status == TimerStatus.PAUSED:
        room.timer_anchor = now - timedelta(seconds=room.timer_offset)
        room.timer_status = TimerStatus.RUNNING
    elif action == 'skip' and room.timer_status != TimerStatus.IDLE:
        # Jump to the start of the next phase.
        focus = room.focus_minutes * 60
        position = cycle_position(room, now)
        target = focus if position < focus and room.break_minutes else 0
        if room.timer_status == TimerStatus.PAUSED:
            room.timer_offset = target
        else:
            room.timer_anchor = now - timedelta(seconds=target)
    elif action == 'reset':
        room.timer_status = TimerStatus.IDLE
        room.timer_anchor = None
        room.timer_offset = 0
    room.save(update_fields=['timer_status', 'timer_anchor', 'timer_offset', 'updated_at'])


def can_control_timer(room: Room, user, is_member: bool) -> bool:
    """The host runs the room clock. Rooms without a host (run by CrackRoom) are shared by members."""
    if user.is_staff or (room.host_id and room.host_id == user.id):
        return True
    return room.host_id is None and is_member


# --- Presence --------------------------------------------------------------------------


def fresh_presence():
    return RoomPresence.objects.filter(last_seen__gte=timezone.now() - PRESENCE_TTL)


def participant_counts(room_ids) -> dict[int, int]:
    rows = (
        fresh_presence()
        .filter(room_id__in=room_ids)
        .values('room_id')
        .annotate(n=Count('user', distinct=True))
    )
    return {row['room_id']: row['n'] for row in rows}


def member_key(room: Room, user_id: int) -> str:
    """Stable per-room id for a student that does not expose their account id."""
    return hashlib.sha256(f'{settings.SECRET_KEY}:{room.slug}:{user_id}'.encode()).hexdigest()[:12]


def presence_list(room: Room) -> list[dict]:
    # A student in several tabs shows once, with the status of their most recent tab.
    rows = fresh_presence().filter(room=room).select_related('user__profile').order_by('connected_at')
    people: dict[int, dict] = {}
    for row in rows:
        profile = getattr(row.user, 'profile', None)
        people[row.user_id] = {
            'key': member_key(room, row.user_id),
            'name': row.user.display_name,
            'hue': profile.avatar_hue if profile else None,
            'avatar': profile.avatar if profile else '',
            'status': row.status,
            'isHost': room.host_id == row.user_id,
        }
    return list(people.values())


def prune_presence(room: Room) -> None:
    RoomPresence.objects.filter(room=room).filter(~Q(last_seen__gte=timezone.now() - PRESENCE_TTL)).delete()


# --- Broadcast and tickets ------------------------------------------------------------


def broadcast(room: Room, payload: dict) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    async_to_sync(layer.group_send)(group_name(room.slug), {'type': 'room.event', 'payload': payload})


def disconnect_user(room: Room, user) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    for channel in RoomPresence.objects.filter(room=room, user=user).values_list('channel_name', flat=True):
        async_to_sync(layer.send)(channel, {'type': 'room.kick'})


def issue_ticket(user, room: Room) -> str:
    return signing.dumps({'u': user.id, 'r': room.slug}, salt=TICKET_SALT, compress=True)


def read_ticket(ticket: str) -> dict | None:
    try:
        return signing.loads(ticket, salt=TICKET_SALT, max_age=TICKET_MAX_AGE)
    except signing.BadSignature:
        return None
