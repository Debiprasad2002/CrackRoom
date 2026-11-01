from django.contrib import admin, messages
from django.utils import timezone

from .models import Resource


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    """
    Content management for the notes library. Editors can draft; only users with the
    `publish_resource` permission (or superusers) can publish or archive.
    """

    list_display = ['title', 'exam', 'level', 'subject', 'chapter', 'language', 'status', 'has_file', 'published_at']
    list_filter = ['status', 'exam', 'level', 'subject', 'language']
    search_fields = ['title', 'slug', 'chapter', 'description']
    prepopulated_fields = {'slug': ['title']}
    readonly_fields = ['published_at', 'created_by', 'created_at', 'updated_at']
    fieldsets = [
        (None, {'fields': ['title', 'slug', 'description']}),
        ('Syllabus', {'fields': ['exam', 'level', 'subject', 'chapter', 'language']}),
        ('File', {'fields': ['file', 'pages', 'source']}),
        ('Publishing', {'fields': ['status', 'published_at', 'created_by', 'created_at', 'updated_at']}),
    ]
    actions = ['publish', 'archive', 'return_to_draft']

    @admin.display(boolean=True, description='PDF')
    def has_file(self, obj):
        return bool(obj.file)

    def can_publish(self, request):
        return request.user.has_perm('resources.publish_resource')

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if not self.can_publish(request):
            fields.append('status')
        return fields

    def get_actions(self, request):
        actions = super().get_actions(request)
        if not self.can_publish(request):
            for name in ('publish', 'archive', 'return_to_draft'):
                actions.pop(name, None)
        return actions

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description='Publish selected resources')
    def publish(self, request, queryset):
        missing = queryset.filter(file='')
        if missing.exists():
            self.message_user(
                request,
                f'{missing.count()} resource(s) have no PDF and were left unpublished.',
                messages.WARNING,
            )
        ready = queryset.exclude(file='').exclude(status=Resource.Status.PUBLISHED)
        count = 0
        for resource in ready:
            resource.status = Resource.Status.PUBLISHED
            resource.published_at = resource.published_at or timezone.now()
            resource.save(update_fields=['status', 'published_at', 'updated_at'])
            count += 1
        self.message_user(request, f'{count} resource(s) published.', messages.SUCCESS)

    @admin.action(description='Archive selected resources')
    def archive(self, request, queryset):
        count = queryset.update(status=Resource.Status.ARCHIVED, updated_at=timezone.now())
        self.message_user(request, f'{count} resource(s) archived.', messages.SUCCESS)

    @admin.action(description='Return selected resources to draft')
    def return_to_draft(self, request, queryset):
        count = queryset.update(status=Resource.Status.DRAFT, updated_at=timezone.now())
        self.message_user(request, f'{count} resource(s) moved to draft.', messages.SUCCESS)
