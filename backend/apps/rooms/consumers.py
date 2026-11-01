"""
Live room socket. Read-mostly: chat and timer changes arrive through the REST API, which
validates them and broadcasts here. The socket itself only carries presence.

Connect with  /ws/rooms/<room id>/?ticket=<from GET /api/rooms/<id>/socket-ticket/>
Server -> client: snapshot, presence, chat, timer, closed
Client -> server: {"type": "status", "status": "focusing"|"break"|"paused"|"ready"}, {"type": "ping"}
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Room, RoomMembership, RoomPresence
from .realtime import group_name, presence_list, prune_presence, read_ticket, timer_state

CLOSE_UNAUTHORISED = 4401
CLOSE_FORBIDDEN = 4403
CLOSE_NOT_FOUND = 4404


class RoomConsumer(AsyncJsonWebsocketConsumer):
    room: Room | None = None

    async def connect(self):
        slug = self.scope['url_route']['kwargs']['room_id']
        ticket = parse_qs(self.scope.get('query_string', b'').decode()).get('ticket', [''])[0]
        claims = read_ticket(ticket)
        if not claims or claims.get('r') != slug:
            await self.close(code=CLOSE_UNAUTHORISED)
            return
        outcome = await self.admit(claims['u'], slug)
        if isinstance(outcome, int):
            await self.close(code=outcome)
            return
        self.room, self.user = outcome
        self.group = group_name(slug)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        snapshot = await self.join_presence()
        await self.send_json({'type': 'snapshot', **snapshot})
        await self.broadcast_presence()

    async def disconnect(self, code):
        if self.room is None:
            return
        await self.channel_layer.group_discard(self.group, self.channel_name)
        await self.leave_presence()
        await self.broadcast_presence()

    async def receive_json(self, content, **kwargs):
        kind = content.get('type') if isinstance(content, dict) else None
        if kind == 'ping':
            await self.touch()
            await self.send_json({'type': 'pong'})
        elif kind == 'status' and content.get('status') in RoomPresence.Status.values:
            await self.touch(status=content['status'])
            await self.broadcast_presence()

    async def room_event(self, event):
        await self.send_json(event['payload'])
        if event['payload'].get('type') == 'closed':
            await self.close(code=CLOSE_NOT_FOUND)

    async def room_kick(self, event):
        """Sent to this socket alone when its student leaves the room or loses access."""
        await self.close(code=CLOSE_FORBIDDEN)

    async def broadcast_presence(self):
        people = await database_sync_to_async(presence_list)(self.room)
        await self.channel_layer.group_send(
            self.group, {'type': 'room.event', 'payload': {'type': 'presence', 'people': people}}
        )

    @database_sync_to_async
    def admit(self, user_id, slug):
        user = get_user_model().objects.filter(id=user_id, is_active=True).select_related('profile').first()
        if user is None:
            return CLOSE_UNAUTHORISED
        room = Room.objects.filter(slug=slug, is_active=True).first()
        if room is None:
            return CLOSE_NOT_FOUND
        if not RoomMembership.objects.filter(room=room, user=user).exists():
            return CLOSE_FORBIDDEN
        return room, user

    @database_sync_to_async
    def join_presence(self):
        prune_presence(self.room)
        RoomPresence.objects.create(
            room=self.room, user=self.user, channel_name=self.channel_name, last_seen=timezone.now()
        )
        self.room.refresh_from_db()
        return {'timer': timer_state(self.room), 'people': presence_list(self.room)}

    @database_sync_to_async
    def leave_presence(self):
        RoomPresence.objects.filter(channel_name=self.channel_name).delete()

    @database_sync_to_async
    def touch(self, status=None):
        fields = {'last_seen': timezone.now()}
        if status:
            fields['status'] = status
        RoomPresence.objects.filter(channel_name=self.channel_name).update(**fields)
