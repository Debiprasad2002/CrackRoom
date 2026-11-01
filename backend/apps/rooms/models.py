import secrets

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils.crypto import get_random_string
from django.utils.text import slugify

from apps.common.choices import ExamScope, LevelScope, RoomSubject, StudyMode, Visibility


def new_invite_code():
    # Unambiguous characters only, so codes can be read aloud or typed from a screenshot.
    return get_random_string(8, allowed_chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789')


MAX_FOCUS_MINUTES = 24 * 60
MAX_BREAK_MINUTES = 120


class TimerStatus(models.TextChoices):
    IDLE = 'idle', 'Idle'
    RUNNING = 'running', 'Running'
    PAUSED = 'paused', 'Paused'


class Room(models.Model):
    slug = models.SlugField(max_length=80, unique=True, help_text='Public id used in URLs.')
    name = models.CharField(max_length=60)
    description = models.CharField(max_length=280)
    exam = models.CharField(max_length=8, choices=ExamScope.choices)
    level = models.CharField(max_length=12, choices=LevelScope.choices)
    subject = models.CharField(max_length=16, choices=RoomSubject.choices)
    mode = models.CharField(max_length=12, choices=StudyMode.choices)
    visibility = models.CharField(max_length=8, choices=Visibility.choices, default=Visibility.PUBLIC)
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hosted_rooms',
        help_text='Leave empty for rooms run by CrackRoom.',
    )
    # Hosts choose any rhythm: a 25-minute pomodoro up to a 24-hour marathon block.
    focus_minutes = models.PositiveSmallIntegerField(default=50, validators=[MinValueValidator(10), MaxValueValidator(MAX_FOCUS_MINUTES)])
    break_minutes = models.PositiveSmallIntegerField(default=10, validators=[MinValueValidator(0), MaxValueValidator(MAX_BREAK_MINUTES)])
    capacity = models.PositiveSmallIntegerField(default=24, validators=[MinValueValidator(2), MaxValueValidator(100)])
    rules = models.JSONField(default=list, blank=True)
    invite_code = models.CharField(max_length=8, blank=True, help_text='Required to join private rooms.')
    is_active = models.BooleanField(default=True, help_text='Inactive rooms are hidden from students.')

    # Shared room timer. A running timer cycles focus -> break -> focus from `timer_anchor`;
    # a paused one remembers how far into the cycle it stopped. See apps.rooms.realtime.
    timer_status = models.CharField(max_length=8, choices=TimerStatus.choices, default=TimerStatus.IDLE)
    timer_anchor = models.DateTimeField(null=True, blank=True)
    timer_offset = models.FloatField(default=0, help_text='Seconds into the cycle when paused.')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [models.Index(fields=['is_active', 'visibility'])]

    def __str__(self):
        return self.name

    @property
    def host_name(self) -> str:
        return self.host.display_name if self.host_id else 'CrackRoom'

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:60] or 'room'
            self.slug = f'{base}-{secrets.token_hex(3)}'
        if self.visibility == Visibility.PRIVATE and not self.invite_code:
            self.invite_code = new_invite_code()
        if self.visibility == Visibility.PUBLIC:
            self.invite_code = ''
        super().save(*args, **kwargs)


class RoomMembership(models.Model):
    class Role(models.TextChoices):
        HOST = 'host', 'Host'
        MEMBER = 'member', 'Member'

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='room_memberships')
    role = models.CharField(max_length=8, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['room', 'user'], name='unique_room_member')]

    def __str__(self):
        return f'{self.user} in {self.room}'


class RoomPresence(models.Model):
    """One open WebSocket. A student with two tabs has two rows but counts once."""

    class Status(models.TextChoices):
        READY = 'ready', 'Ready'
        FOCUSING = 'focusing', 'Focusing'
        BREAK = 'break', 'On a break'
        PAUSED = 'paused', 'Paused'

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='presence')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    channel_name = models.CharField(max_length=200, unique=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.READY)
    connected_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(db_index=True)

    def __str__(self):
        return f'{self.user} in {self.room}'


class ChatMessage(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='messages')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_messages')
    body = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    is_hidden = models.BooleanField(default=False, help_text='Hidden by a moderator.')

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.author}: {self.body[:40]}'


class RoomReport(models.Model):
    class Reason(models.TextChoices):
        SPAM = 'spam', 'Spam or advertising'
        HARASSMENT = 'harassment', 'Harassment or bullying'
        INAPPROPRIATE = 'inappropriate', 'Inappropriate content'
        CHEATING = 'cheating', 'Sharing leaked papers or cheating'
        OTHER = 'other', 'Something else'

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        ACTIONED = 'actioned', 'Action taken'
        DISMISSED = 'dismissed', 'Dismissed'

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='reports')
    message = models.ForeignKey(ChatMessage, on_delete=models.SET_NULL, null=True, blank=True, related_name='reports')
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='room_reports')
    reason = models.CharField(max_length=16, choices=Reason.choices)
    details = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN, db_index=True)
    moderator_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['room', 'reporter'], condition=Q(status='open'), name='one_open_report_per_room'
            )
        ]

    def __str__(self):
        return f'{self.get_reason_display()} — {self.room}'
