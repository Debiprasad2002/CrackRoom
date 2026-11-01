from django.contrib import admin

from .models import Booking, Mentor, Slot


class SlotInline(admin.TabularInline):
    model = Slot
    extra = 0
    fields = ['starts_at', 'minutes', 'is_cancelled']
    ordering = ['-starts_at']


@admin.register(Mentor)
class MentorAdmin(admin.ModelAdmin):
    """Onboard mentors here: link their account, check their background, then tick Verified."""

    list_display = ['display_name', 'headline', 'is_verified', 'is_active', 'session_minutes', 'user']
    list_filter = ['is_verified', 'is_active']
    search_fields = ['display_name', 'headline', 'user__email']
    autocomplete_fields = ['user']
    prepopulated_fields = {'slug': ['display_name']}
    inlines = [SlotInline]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['student', 'mentor', 'starts_at', 'status', 'cancelled_by', 'created_at']
    list_filter = ['status', 'cancelled_by']
    search_fields = ['student__email', 'slot__mentor__display_name', 'topic']
    readonly_fields = ['slot', 'student', 'topic', 'created_at', 'cancelled_at']

    @admin.display(ordering='slot__mentor__display_name')
    def mentor(self, obj):
        return obj.slot.mentor

    @admin.display(ordering='slot__starts_at')
    def starts_at(self, obj):
        return obj.slot.starts_at
