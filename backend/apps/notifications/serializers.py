from rest_framework import serializers

from apps.community.serializers import author_data

from .models import Notification

PREVIEW = 140


class NotificationSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()
    postId = serializers.IntegerField(source='post_id')
    commentId = serializers.IntegerField(source='comment_id')
    preview = serializers.SerializerMethodField()
    read = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at')

    class Meta:
        model = Notification
        fields = ['id', 'kind', 'actor', 'postId', 'commentId', 'preview', 'read', 'createdAt']

    def get_actor(self, item) -> dict:
        return author_data(item.actor, self.context['request'].user)

    def get_preview(self, item) -> str:
        return (item.comment.body if item.comment else item.post.body)[:PREVIEW]

    def get_read(self, item) -> bool:
        return item.read_at is not None
