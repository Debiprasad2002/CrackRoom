from django.contrib import admin

from .models import Comment, Post, PostReport


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['author', 'short_body', 'is_reshare', 'is_hidden', 'created_at']
    list_filter = ['is_hidden', 'is_reshare']
    search_fields = ['body', 'author__email', 'author__profile__display_name']
    readonly_fields = ['author', 'body', 'reshare_of', 'is_reshare', 'created_at']
    actions = ['hide', 'unhide']

    @admin.display(description='Post')
    def short_body(self, obj):
        return obj.body[:80] or '(reshare)'

    @admin.action(description='Hide selected posts')
    def hide(self, request, queryset):
        queryset.update(is_hidden=True)

    @admin.action(description='Restore selected posts')
    def unhide(self, request, queryset):
        queryset.update(is_hidden=False)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['author', 'short_body', 'post', 'is_hidden', 'created_at']
    list_filter = ['is_hidden']
    search_fields = ['body', 'author__email']
    readonly_fields = ['post', 'author', 'body', 'created_at']
    actions = ['hide', 'unhide']

    @admin.display(description='Comment')
    def short_body(self, obj):
        return obj.body[:80]

    @admin.action(description='Hide selected comments')
    def hide(self, request, queryset):
        queryset.update(is_hidden=True)

    @admin.action(description='Restore selected comments')
    def unhide(self, request, queryset):
        queryset.update(is_hidden=False)


@admin.register(PostReport)
class PostReportAdmin(admin.ModelAdmin):
    """Moderation queue for the community feed. Hide the post, then mark the report."""

    list_display = ['post', 'comment', 'reason', 'status', 'reporter', 'created_at']
    list_filter = ['status', 'reason']
    readonly_fields = ['post', 'comment', 'reporter', 'reason', 'details', 'created_at']
    actions = ['hide_and_action', 'dismiss']

    @admin.action(description='Hide the reported post or comment and mark as action taken')
    def hide_and_action(self, request, queryset):
        Comment.objects.filter(reports__in=queryset).update(is_hidden=True)
        Post.objects.filter(reports__in=queryset.filter(comment__isnull=True)).update(is_hidden=True)
        queryset.update(status=PostReport.Status.ACTIONED)

    @admin.action(description='Dismiss')
    def dismiss(self, request, queryset):
        queryset.update(status=PostReport.Status.DISMISSED)
