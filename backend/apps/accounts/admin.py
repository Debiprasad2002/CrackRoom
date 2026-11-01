from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Profile, User


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    extra = 0


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ['-date_joined']
    list_display = ['email', 'display_name', 'is_active', 'is_staff', 'date_joined', 'last_login']
    list_filter = ['is_active', 'is_staff', 'is_superuser']
    search_fields = ['email', 'profile__display_name']
    readonly_fields = ['google_sub', 'date_joined', 'last_login']
    inlines = [ProfileInline]
    fieldsets = [
        (None, {'fields': ['email', 'google_sub', 'password']}),
        ('Permissions', {'fields': ['is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions']}),
        ('Dates', {'fields': ['last_login', 'date_joined']}),
    ]
    add_fieldsets = [(None, {'classes': ['wide'], 'fields': ['email', 'password1', 'password2']})]

    @admin.display(description='Display name')
    def display_name(self, obj):
        return obj.display_name


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'user', 'exam', 'level', 'target_year', 'created_at']
    list_filter = ['exam', 'level', 'target_year']
    search_fields = ['display_name', 'user__email']
    readonly_fields = ['created_at', 'updated_at']
