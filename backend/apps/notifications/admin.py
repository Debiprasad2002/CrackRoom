from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['kind', 'recipient', 'actor', 'read_at', 'created_at']
    list_filter = ['kind']
    raw_id_fields = ['recipient', 'actor', 'post', 'comment']
    date_hierarchy = 'created_at'
