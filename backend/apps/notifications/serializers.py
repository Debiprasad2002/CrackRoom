from django.utils import timezone
from rest_framework import serializers

from apps.community.serializers import author_data

from .models import Notification

PREVIEW = 140


class NotificationSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()
    postId = serializers.IntegerField(source='post_id')
    link = serializers.SerializerMethodField()
    commentId = serializers.IntegerField(source='comment_id')
    preview = serializers.SerializerMethodField()
    read = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at')

    class Meta:
        model = Notification
        fields = ['id', 'kind', 'actor', 'postId', 'link', 'commentId', 'preview', 'read', 'createdAt']

    def get_actor(self, item) -> dict:
        actor = author_data(item.actor, self.context['request'].user)
        mentor = item.booking.slot.mentor if item.booking else None
        if mentor and mentor.user_id == item.actor_id:
            # A mentor may have no student profile, so use the name students know them by.
            actor.update(name=mentor.display_name, hue=mentor.avatar_hue)
        return actor

    def get_link(self, item) -> str | None:
        if not item.booking:
            return None
        return '/mentorship/schedule' if item.booking.slot.mentor.user_id == item.recipient_id else '/mentorship'

    def get_preview(self, item) -> str:
        if item.booking:
            starts = timezone.localtime(item.booking.slot.starts_at)
            return f'{starts:%d %b, %I:%M %p} · {item.booking.topic}'[:PREVIEW]
        return (item.comment.body if item.comment else item.post.body)[:PREVIEW]

    def get_read(self, item) -> bool:
        return item.read_at is not None
