from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.common.choices import Subject
from apps.rooms.models import Room

from .models import FocusSession, PlannedSession

CLOCK_SKEW = timedelta(minutes=5)


class FocusSessionSerializer(serializers.ModelSerializer):
    """Mirrors the frontend `FocusSession` type. `subject` and `roomId` may be null."""

    subject = serializers.ChoiceField(choices=Subject.choices, allow_null=True, required=False)
    goal = serializers.CharField(max_length=140, allow_blank=True, required=False, default='')
    completedAt = serializers.DateTimeField(source='completed_at')
    roomId = serializers.SlugRelatedField(
        source='room', slug_field='slug', queryset=Room.objects.all(), allow_null=True, required=False
    )
    clientId = serializers.CharField(source='client_id', max_length=40, required=False, allow_blank=True, write_only=True)

    class Meta:
        model = FocusSession
        fields = ['id', 'subject', 'goal', 'minutes', 'completedAt', 'roomId', 'partial', 'clientId']
        read_only_fields = ['id']

    def validate_completedAt(self, value):
        if value > timezone.now() + CLOCK_SKEW:
            raise serializers.ValidationError('A session cannot finish in the future.')
        return value

    def validate_subject(self, value):
        return value or ''

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['subject'] = data['subject'] or None
        return data


class PlannedSessionSerializer(serializers.ModelSerializer):
    """Mirrors the frontend `PlannedSession` type; `date` is the student's local yyyy-mm-dd."""

    clientId = serializers.CharField(source='client_id', max_length=40, required=False, allow_blank=True, write_only=True)

    class Meta:
        model = PlannedSession
        fields = ['id', 'date', 'subject', 'title', 'minutes', 'done', 'clientId']
        read_only_fields = ['id']

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Give the session a title.')
        return value
