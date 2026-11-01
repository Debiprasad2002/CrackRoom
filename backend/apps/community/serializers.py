import re

from rest_framework import serializers

from apps.common.choices import Level

from .models import Comment, Post, PostReport, Reaction

LEVEL_LABELS = dict(Level.choices)


def tidy(text: str) -> str:
    """Trim, and collapse runs of blank lines so posts cannot be padded into walls of space."""
    return re.sub(r'\n{3,}', '\n\n', text.strip())


def author_data(user, request_user) -> dict:
    profile = getattr(user, 'profile', None)
    return {
        'name': user.display_name,
        'hue': profile.avatar_hue if profile else None,
        'avatar': profile.avatar if profile else '',
        'exam': profile.exam if profile else None,
        'level': LEVEL_LABELS.get(profile.level) if profile else None,
        'isYou': user.id == request_user.id,
    }


class OriginalSerializer(serializers.ModelSerializer):
    """The post inside a reshare, shown as an embedded card."""

    author = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at')

    class Meta:
        model = Post
        fields = ['id', 'body', 'author', 'createdAt']

    def get_author(self, post) -> dict:
        return author_data(post.author, self.context['request'].user)


class PostSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at')
    reactions = serializers.SerializerMethodField()
    myReaction = serializers.SerializerMethodField()
    reshareCount = serializers.SerializerMethodField()
    commentCount = serializers.SerializerMethodField()
    resharedFrom = serializers.SerializerMethodField()
    isReshare = serializers.BooleanField(source='is_reshare')
    canDelete = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'body', 'author', 'createdAt', 'reactions', 'myReaction', 'reshareCount', 'commentCount', 'isReshare', 'resharedFrom', 'canDelete']

    def _user(self):
        return self.context['request'].user

    def get_author(self, post) -> dict:
        return author_data(post.author, self._user())

    def get_reactions(self, post) -> dict:
        return {
            'like': getattr(post, 'n_like', 0),
            'fire': getattr(post, 'n_fire', 0),
            'idea': getattr(post, 'n_idea', 0),
        }

    def get_myReaction(self, post) -> str | None:
        return getattr(post, 'my_reaction', None)

    def get_reshareCount(self, post) -> int:
        return getattr(post, 'n_reshares', 0)

    def get_commentCount(self, post) -> int:
        return getattr(post, 'n_comments', 0)

    def get_resharedFrom(self, post) -> dict | None:
        original = post.reshare_of
        if not post.is_reshare:
            return None
        if original is None or original.is_hidden:
            return {'removed': True}
        return OriginalSerializer(original, context=self.context).data

    def get_canDelete(self, post) -> bool:
        user = self._user()
        return post.author_id == user.id or user.is_staff


class CreatePostSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=1000, allow_blank=True, required=False, default='', trim_whitespace=False)

    def validate_body(self, value):
        return tidy(value)


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    canDelete = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'body', 'author', 'createdAt', 'canDelete']
        read_only_fields = ['id']

    def get_author(self, comment) -> dict:
        return author_data(comment.author, self.context['request'].user)

    def get_canDelete(self, comment) -> bool:
        # The commenter, the author of the post (to keep their thread clean), or staff.
        user = self.context['request'].user
        return user.is_staff or comment.author_id == user.id or comment.post.author_id == user.id

    def validate_body(self, value):
        value = tidy(value)
        if not value:
            raise serializers.ValidationError('Write a comment first.')
        return value


class ReactSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Reaction.Kind.choices)


class PostReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostReport
        fields = ['reason', 'details']
