from django import forms
from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from apps.accounts.models import User
from apps.common.choices import Exam, Language, Subject

from . import google_calendar
from .models import Booking, Mentor, Slot
from .rules import clean_exams, clean_languages, clean_subjects


class SlotInline(admin.TabularInline):
    """Add new times here. Existing ones are read-only, because changing them would leave a booked student's invite wrong."""

    model = Slot
    extra = 1
    fields = ['starts_at', 'minutes', 'is_cancelled']
    readonly_fields = ['minutes', 'is_cancelled']
    ordering = ['-starts_at']
    can_delete = False

    def has_change_permission(self, request, obj=None):
        return False


class MentorForm(forms.ModelForm):
    """Plain checkboxes, and an email in place of an account picker, so a mentor can be added before they first sign in."""

    email = forms.EmailField(label='Mentor Gmail', help_text='The Google account they will sign in with. Their calendar invites go here.')
    exams = forms.MultipleChoiceField(choices=Exam.choices, widget=forms.CheckboxSelectMultiple)
    subjects = forms.MultipleChoiceField(choices=Subject.choices, widget=forms.CheckboxSelectMultiple)
    languages = forms.MultipleChoiceField(choices=Language.choices, widget=forms.CheckboxSelectMultiple)

    class Meta:
        model = Mentor
        exclude = ['user']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['slug'].required = False
        self.fields['slug'].help_text = 'The end of their page address. Leave empty to create it from their name.'
        if self.instance.pk:
            # Older records may hold hand-typed values, so tick the matching boxes for them.
            self.initial.update(
                exams=clean_exams(self.instance.exams),
                subjects=clean_subjects(self.instance.subjects),
                languages=clean_languages(self.instance.languages),
            )
            self.fields['email'].initial = self.instance.user.email
            # Moving a mentor to another account would orphan their sessions and invites.
            self.fields['email'].disabled = True
            self.fields['email'].help_text = 'This cannot be changed. To use another Gmail, add them as a new mentor.'

    def clean_email(self):
        email = self.cleaned_data['email'].strip().lower()
        if not self.instance.pk and Mentor.objects.filter(user__email__iexact=email).exists():
            raise ValidationError('This Gmail is already a mentor.')
        return email

    def save(self, commit=True):
        if not self.instance.pk:
            email = self.cleaned_data['email']
            user = User.objects.filter(email__iexact=email).first()
            # When they first sign in, Google sign-in links to this account by its verified email.
            self.instance.user = user or User.objects.create_user(email)
        return super().save(commit)


@admin.register(Mentor)
class MentorAdmin(admin.ModelAdmin):
    """Onboard mentors here: enter their Gmail and details, check their background, then tick Verified."""

    form = MentorForm
    list_display = ['display_name', 'headline', 'is_verified', 'is_active', 'session_minutes', 'user']
    list_filter = ['is_verified', 'is_active']
    search_fields = ['display_name', 'headline', 'user__email']
    prepopulated_fields = {'slug': ['display_name']}
    fields = ['email', 'display_name', 'slug', 'headline', 'bio', 'exams', 'subjects', 'languages', 'session_minutes', 'meeting_url', 'avatar_hue', 'is_verified', 'is_active']
    inlines = [SlotInline]

    def save_formset(self, request, form, formset, change):
        slots = formset.save(commit=False)
        for slot in slots:
            slot.minutes = form.instance.session_minutes
            slot.save()
        formset.save_m2m()


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['student', 'mentor', 'starts_at', 'status', 'cancelled_by', 'invite_sent', 'created_at']
    list_filter = ['status', 'cancelled_by']
    search_fields = ['student__email', 'slot__mentor__display_name', 'topic']
    # Status stays read-only: cancelling belongs in the app, which also cancels the invite and tells both people.
    readonly_fields = ['slot', 'student', 'topic', 'status', 'cancelled_by', 'created_at', 'cancelled_at', 'calendar_event_id', 'meet_url']
    actions = ['retry_invite']

    @admin.display(ordering='slot__mentor__display_name')
    def mentor(self, obj):
        return obj.slot.mentor

    @admin.display(ordering='slot__starts_at')
    def starts_at(self, obj):
        return obj.slot.starts_at

    @admin.display(boolean=True, description='Invite sent')
    def invite_sent(self, obj):
        return bool(obj.calendar_event_id)

    @admin.action(description='Retry Google Calendar invite')
    def retry_invite(self, request, queryset):
        if not google_calendar.is_configured():
            self.message_user(request, 'Google Calendar is not connected yet.', messages.ERROR)
            return
        active = queryset.filter(status=Booking.Status.BOOKED).select_related('slot__mentor__user', 'student')
        sent = sum(google_calendar.send_invite(booking) for booking in active)
        failed = len(active) - sent
        if sent:
            self.message_user(request, f'{sent} invite(s) are in place.', messages.SUCCESS)
        if failed:
            self.message_user(request, f'{failed} invite(s) failed again. Check the server logs.', messages.ERROR)
