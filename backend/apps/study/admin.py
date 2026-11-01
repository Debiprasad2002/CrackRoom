from django.contrib import admin

from .models import FocusSession, PlannedSession


@admin.register(FocusSession)
class FocusSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'subject', 'minutes', 'partial', 'completed_at']
    list_filter = ['subject', 'partial']
    search_fields = ['user__email', 'goal']
    date_hierarchy = 'completed_at'
    readonly_fields = ['created_at']


@admin.register(PlannedSession)
class PlannedSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'date', 'subject', 'title', 'minutes', 'done']
    list_filter = ['subject', 'done']
    search_fields = ['user__email', 'title']
    date_hierarchy = 'date'
    readonly_fields = ['created_at', 'updated_at']
