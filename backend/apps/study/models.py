import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.common.choices import Subject


class FocusSession(models.Model):
    """One completed (or stopped-early) focus block. Recorded by the student's own timer."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='focus_sessions')
    subject = models.CharField(max_length=16, choices=Subject.choices, blank=True)
    goal = models.CharField(max_length=140, blank=True)
    # Up to 24 hours, matching the longest focus block a room can run.
    minutes = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(24 * 60)])
    completed_at = models.DateTimeField()
    room = models.ForeignKey('rooms.Room', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    partial = models.BooleanField(default=False, help_text='Stopped before the planned duration ended.')
    client_id = models.CharField(
        max_length=40, blank=True, help_text='Id from the device that recorded it, so retries and imports never duplicate.'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['completed_at']
        indexes = [models.Index(fields=['user', 'completed_at'])]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'client_id'], condition=~Q(client_id=''), name='unique_focus_client_id'
            )
        ]

    def __str__(self):
        return f'{self.minutes} min — {self.user}'


class PlannedSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='planned_sessions')
    date = models.DateField(help_text="The student's local date.")
    subject = models.CharField(max_length=16, choices=Subject.choices)
    title = models.CharField(max_length=80)
    minutes = models.PositiveSmallIntegerField(validators=[MinValueValidator(5), MaxValueValidator(480)])
    done = models.BooleanField(default=False)
    client_id = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'created_at']
        indexes = [models.Index(fields=['user', 'date'])]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'client_id'], condition=~Q(client_id=''), name='unique_plan_client_id'
            )
        ]

    def __str__(self):
        return f'{self.date} {self.title}'
