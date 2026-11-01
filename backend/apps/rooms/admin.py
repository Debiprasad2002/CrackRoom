from django.contrib import admin
from django.utils import timezone

from .models import ChatMessage, Room, RoomMembership, RoomReport


class MembershipInline(admin.TabularInline):
    model = RoomMembership
    extra = 0
    autocomplete_fields = ['user']
    readonly_fields = ['joined_at']


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'exam', 'level', 'subject', 'mode', 'visibility', 'host', 'is_active', 'created_at']
    list_filter = ['is_active', 'visibility', 'exam', 'level', 'subject', 'mode']
    search_fields = ['name', 'slug', 'description', 'host__email']
    prepopulated_fields = {'slug': ['name']}
    autocomplete_fields = ['host']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [MembershipInline]
    actions = ['deactivate', 'activate']

    @admin.action(description='Hide selected rooms from students')
    def deactivate(self, request, queryset):
        queryset.update(is_active=False, updated_at=timezone.now())

    @admin.action(description='Show selected rooms to students')
    def activate(self, request, queryset):
        queryset.update(is_active=True, updated_at=timezone.now())


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['room', 'author', 'short_body', 'created_at', 'is_hidden']
    list_filter = ['is_hidden', 'room']
    search_fields = ['body', 'author__email', 'room__name']
    readonly_fields = ['room', 'author', 'body', 'created_at']
    actions = ['hide', 'unhide']

    @admin.display(description='Message')
    def short_body(self, obj):
        return obj.body[:80]

    @admin.action(description='Hide selected messages')
    def hide(self, request, queryset):
        queryset.update(is_hidden=True)

    @admin.action(description='Restore selected messages')
    def unhide(self, request, queryset):
        queryset.update(is_hidden=False)


@admin.register(RoomReport)
class RoomReportAdmin(admin.ModelAdmin):
    """Moderation queue. Open reports first; reviewers record what they did."""

    list_display = ['room', 'reason', 'status', 'reporter', 'created_at', 'reviewed_by']
    list_filter = ['status', 'reason']
    search_fields = ['room__name', 'details', 'reporter__email']
    readonly_fields = ['room', 'message', 'reporter', 'reason', 'details', 'created_at', 'reviewed_by', 'reviewed_at']
    fields = readonly_fields[:5] + ['status', 'moderator_note', 'created_at', 'reviewed_by', 'reviewed_at']
    actions = ['mark_actioned', 'mark_dismissed']

    def get_queryset(self, request):
        return super().get_queryset(request).order_by('status', '-created_at')

    def save_model(self, request, obj, form, change):
        if 'status' in form.changed_data and obj.status != RoomReport.Status.OPEN:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)

    def _close(self, request, queryset, status):
        queryset.filter(status=RoomReport.Status.OPEN).update(
            status=status, reviewed_by=request.user, reviewed_at=timezone.now()
        )

    @admin.action(description='Mark as action taken')
    def mark_actioned(self, request, queryset):
        self._close(request, queryset, RoomReport.Status.ACTIONED)

    @admin.action(description='Dismiss')
    def mark_dismissed(self, request, queryset):
        self._close(request, queryset, RoomReport.Status.DISMISSED)
