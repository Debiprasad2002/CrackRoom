"""Booking rules, in one place so the API, serializers and tests agree."""

from datetime import timedelta

from django.db.models import Count, Exists, IntegerField, OuterRef, Q, Subquery
from django.utils import timezone

from apps.common.choices import Exam, Language, Subject

from .models import Booking, Mentor, Slot

BOOKING_LEAD = timedelta(minutes=30)  # A mentor needs a little notice.
STUDENT_CANCEL_BEFORE = timedelta(hours=2)
MAX_UPCOMING_PER_STUDENT = 2
BOOKING_WINDOW = timedelta(days=21)  # How far ahead students can see and book.
SLOT_HORIZON = timedelta(days=60)  # How far ahead mentors can publish.
JOIN_EARLY = timedelta(minutes=10)


def clean_choices(value, choices) -> list[str]:
    """
    A mentor's exams, subjects or languages as a list of known values. Older records were typed
    by hand in admin, and could hold a plain string, different capitals or an unknown value.
    """
    items = value.split(',') if isinstance(value, str) else value if isinstance(value, list) else []
    known = {choice.lower(): choice for choice in choices.values}
    cleaned = [known.get(str(item).strip().lower()) for item in items]
    return list(dict.fromkeys(item for item in cleaned if item))


def clean_exams(value) -> list[str]:
    return clean_choices(value, Exam)


def clean_subjects(value) -> list[str]:
    return clean_choices(value, Subject)


def clean_languages(value) -> list[str]:
    return clean_choices(value, Language)


def open_slots(now=None):
    """Bookable now: live, far enough ahead, inside the window, and nobody holds it."""
    now = now or timezone.now()
    held = Booking.objects.filter(slot=OuterRef('pk'), status=Booking.Status.BOOKED)
    return (
        Slot.objects.filter(is_cancelled=False, starts_at__gte=now + BOOKING_LEAD, starts_at__lte=now + BOOKING_WINDOW)
        .annotate(is_held=Exists(held))
        .filter(is_held=False)
    )


def annotated_mentors(now=None):
    """Active mentors with real figures only: completed sessions, next free slot, free slots ahead."""
    now = now or timezone.now()
    free = open_slots(now).filter(mentor=OuterRef('pk'))
    return Mentor.objects.filter(is_active=True).annotate(
        sessions_done=Count(
            'slots__bookings',
            filter=Q(slots__bookings__status=Booking.Status.BOOKED, slots__starts_at__lt=now),
            distinct=True,
        ),
        next_slot=Subquery(free.order_by('starts_at').values('starts_at')[:1]),
        open_slots=Subquery(
            free.order_by().values('mentor').annotate(n=Count('id')).values('n')[:1], output_field=IntegerField()
        ),
    )


def student_can_cancel(booking, now=None) -> bool:
    now = now or timezone.now()
    return booking.status == Booking.Status.BOOKED and booking.slot.starts_at - now >= STUDENT_CANCEL_BEFORE


def overlaps(mentor, starts_at, minutes, exclude_id=None) -> bool:
    end = starts_at + timedelta(minutes=minutes)
    live = Slot.objects.filter(mentor=mentor, is_cancelled=False)
    if exclude_id:
        live = live.exclude(pk=exclude_id)
    for slot in live.filter(starts_at__lt=end, starts_at__gt=starts_at - timedelta(minutes=120)):
        if slot.starts_at < end and starts_at < slot.starts_at + timedelta(minutes=slot.minutes):
            return True
    return False
