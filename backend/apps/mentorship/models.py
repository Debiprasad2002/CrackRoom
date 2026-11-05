import secrets

from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models
from django.db.models import Q
from django.utils.text import slugify


class Mentor(models.Model):
    """
    A person students can book 1:1. Created and verified by staff in admin and linked to the
    mentor's own (Google) account, so they can publish slots and see their bookings.
    """

    class Length(models.IntegerChoices):
        MIN_20 = 20, '20 minutes'
        MIN_30 = 30, '30 minutes'
        MIN_45 = 45, '45 minutes'
        MIN_60 = 60, '60 minutes'

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mentor_profile')
    slug = models.SlugField(max_length=80, unique=True, help_text='Public id used in URLs.')
    display_name = models.CharField(max_length=60)
    headline = models.CharField(max_length=120, help_text='e.g. "IIT Bombay CSE · JEE Advanced 2024".')
    bio = models.TextField(max_length=1200)
    exams = models.JSONField(default=list, help_text='["JEE"], ["NEET"] or both.')
    subjects = models.JSONField(default=list, help_text='e.g. ["physics", "mathematics"].')
    languages = models.JSONField(default=list, help_text='e.g. ["English", "Hindi"].')
    session_minutes = models.PositiveSmallIntegerField(choices=Length.choices, default=Length.MIN_30)
    meeting_url = models.URLField(
        blank=True, help_text='Backup Google Meet or Zoom link, used if a Google Calendar invite cannot be created. Only shown to students with a booking.'
    )
    avatar_hue = models.PositiveSmallIntegerField(default=262, validators=[MaxValueValidator(359)])
    is_verified = models.BooleanField(default=False, help_text='Staff checked their background and results.')
    is_active = models.BooleanField(default=True, help_text='Inactive mentors are hidden and cannot be booked.')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_name']

    def __str__(self):
        return self.display_name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = f'{slugify(self.display_name)[:60] or "mentor"}-{secrets.token_hex(3)}'
        super().save(*args, **kwargs)


class Slot(models.Model):
    """A time a mentor offers. At most one active booking per slot."""

    mentor = models.ForeignKey(Mentor, on_delete=models.CASCADE, related_name='slots')
    starts_at = models.DateTimeField(db_index=True)
    minutes = models.PositiveSmallIntegerField()
    is_cancelled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['starts_at']
        constraints = [
            models.UniqueConstraint(
                fields=['mentor', 'starts_at'], condition=Q(is_cancelled=False), name='one_live_slot_per_start'
            )
        ]

    def __str__(self):
        return f'{self.mentor} · {self.starts_at:%d %b %H:%M}'


class Booking(models.Model):
    class Status(models.TextChoices):
        BOOKED = 'booked', 'Booked'
        CANCELLED = 'cancelled', 'Cancelled'

    class CancelledBy(models.TextChoices):
        STUDENT = 'student', 'Student'
        MENTOR = 'mentor', 'Mentor'

    slot = models.ForeignKey(Slot, on_delete=models.CASCADE, related_name='bookings')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mentor_bookings')
    topic = models.CharField(max_length=300)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.BOOKED, db_index=True)
    cancelled_by = models.CharField(max_length=8, choices=CancelledBy.choices, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    calendar_event_id = models.CharField(max_length=64, blank=True, help_text='Empty means no Google Calendar invite was sent.')
    meet_url = models.URLField(blank=True, help_text='The Meet link Google created for this session.')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['slot__starts_at']
        constraints = [
            # The database itself guarantees two students can never hold the same slot.
            models.UniqueConstraint(fields=['slot'], condition=Q(status='booked'), name='one_active_booking_per_slot')
        ]

    def __str__(self):
        return f'{self.student} with {self.slot.mentor}'
