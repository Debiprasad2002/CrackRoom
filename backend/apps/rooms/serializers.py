from rest_framework import serializers

from apps.common.choices import ExamScope, LevelScope, RoomSubject, StudyMode, Visibility

from .models import MAX_BREAK_MINUTES, MAX_FOCUS_MINUTES, ChatMessage, Room, RoomReport
from .realtime import can_control_timer, member_key, participant_counts, timer_state

MAX_RULES = 6
MAX_RULE_LENGTH = 120


class RoomSerializer(serializers.ModelSerializer):
    """
    Mirrors the frontend `Room` type. `participants` counts students with a live socket in
    the room right now, and `isLive` means the shared timer is running with someone present.
    """

    id = serializers.CharField(source='slug', read_only=True)
    exam = serializers.ChoiceField(choices=ExamScope.choices)
    level = serializers.ChoiceField(choices=LevelScope.choices)
    subject = serializers.ChoiceField(choices=RoomSubject.choices)
    mode = serializers.ChoiceField(choices=StudyMode.choices)
    visibility = serializers.ChoiceField(choices=Visibility.choices, default=Visibility.PUBLIC)
    host = serializers.CharField(source='host_name', read_only=True)
    focusMinutes = serializers.IntegerField(source='focus_minutes', min_value=10, max_value=MAX_FOCUS_MINUTES, default=50)
    breakMinutes = serializers.IntegerField(source='break_minutes', min_value=0, max_value=MAX_BREAK_MINUTES, default=10)
    capacity = serializers.IntegerField(min_value=2, max_value=100, default=24)
    rules = serializers.ListField(
        child=serializers.CharField(max_length=MAX_RULE_LENGTH, allow_blank=True), max_length=MAX_RULES, default=list
    )
    isMember = serializers.SerializerMethodField()
    isHost = serializers.SerializerMethodField()
    inviteCode = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()
    isLive = serializers.SerializerMethodField()
    timer = serializers.SerializerMethodField()
    canControlTimer = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = [
            'id', 'name', 'description', 'exam', 'level', 'subject', 'mode', 'visibility', 'host',
            'focusMinutes', 'breakMinutes', 'capacity', 'rules', 'isMember', 'isHost', 'inviteCode',
            'participants', 'isLive', 'timer', 'canControlTimer',
        ]

    def _user(self):
        request = self.context.get('request')
        return request.user if request else None

    def get_isMember(self, room) -> bool:
        annotated = getattr(room, 'is_member', None)
        if annotated is not None:
            return bool(annotated)
        user = self._user()
        return bool(user and user.is_authenticated and room.memberships.filter(user=user).exists())

    def get_isHost(self, room) -> bool:
        user = self._user()
        return bool(user and room.host_id and room.host_id == user.id)

    def get_inviteCode(self, room) -> str | None:
        # Only the host ever sees the code; everyone else must be given it.
        if not self.get_isHost(room):
            return None
        return room.invite_code or None

    def get_participants(self, room) -> int:
        counts = self.context.get('participants')
        if counts is None:
            counts = participant_counts([room.id])
        return counts.get(room.id, 0)

    def get_isLive(self, room) -> bool:
        return room.timer_status == 'running' and self.get_participants(room) > 0

    def get_timer(self, room) -> dict:
        return timer_state(room)

    def get_canControlTimer(self, room) -> bool:
        user = self._user()
        return bool(user and user.is_authenticated and can_control_timer(room, user, self.get_isMember(room)))

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError('Use at least 3 characters.')
        return value

    def validate_rules(self, value):
        return [rule.strip() for rule in value if rule.strip()]


class ChatMessageSerializer(serializers.ModelSerializer):
    roomId = serializers.CharField(source='room.slug', read_only=True)
    author = serializers.CharField(source='author.display_name', read_only=True)
    authorHue = serializers.SerializerMethodField()
    authorAvatar = serializers.SerializerMethodField()
    authorKey = serializers.SerializerMethodField()
    isOwn = serializers.SerializerMethodField()
    sentAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = ChatMessage
        fields = ['id', 'roomId', 'author', 'authorHue', 'authorAvatar', 'authorKey', 'isOwn', 'body', 'sentAt']
        read_only_fields = ['id']

    def get_authorHue(self, message) -> int | None:
        profile = getattr(message.author, 'profile', None)
        return profile.avatar_hue if profile else None

    def get_authorAvatar(self, message) -> str:
        profile = getattr(message.author, 'profile', None)
        return profile.avatar if profile else ''

    def get_authorKey(self, message) -> str:
        return member_key(message.room, message.author_id)

    def get_isOwn(self, message) -> bool:
        request = self.context.get('request')
        return bool(request and message.author_id == request.user.id)

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Write a message first.')
        return value


class RoomReportSerializer(serializers.ModelSerializer):
    reason = serializers.ChoiceField(choices=RoomReport.Reason.choices)
    details = serializers.CharField(max_length=1000, required=False, allow_blank=True, default='')
    messageId = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = RoomReport
        fields = ['id', 'reason', 'details', 'messageId']
        read_only_fields = ['id']


class TimerActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['start', 'pause', 'resume', 'skip', 'reset'])


class JoinSerializer(serializers.Serializer):
    inviteCode = serializers.CharField(required=False, allow_blank=True, max_length=16)
