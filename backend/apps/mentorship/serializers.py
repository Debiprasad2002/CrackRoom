from rest_framework import serializers

from apps.common.choices import Exam, Language, Subject

from .models import Booking, Mentor, Slot
from .rules import clean_exams, clean_languages, clean_subjects, student_can_cancel


class CleanChoicesMixin:
    """Whatever an older record holds, the app always receives proper lists."""

    def to_representation(self, mentor):
        # Cleaned first, because list fields fail on anything that is not a list. This is never saved.
        mentor.exams = clean_exams(mentor.exams)
        mentor.subjects = clean_subjects(mentor.subjects)
        mentor.languages = clean_languages(mentor.languages)
        return super().to_representation(mentor)


class SlotSerializer(serializers.ModelSerializer):
    startsAt = serializers.DateTimeField(source='starts_at')

    class Meta:
        model = Slot
        fields = ['id', 'startsAt', 'minutes']


class MentorCardSerializer(CleanChoicesMixin, serializers.ModelSerializer):
    """The public face of a mentor. Never includes the meeting link or account details."""

    id = serializers.CharField(source='slug')
    name = serializers.CharField(source='display_name')
    sessionMinutes = serializers.IntegerField(source='session_minutes')
    hue = serializers.IntegerField(source='avatar_hue')
    isVerified = serializers.BooleanField(source='is_verified')
    sessionsDone = serializers.SerializerMethodField()
    nextSlot = serializers.SerializerMethodField()
    openSlots = serializers.SerializerMethodField()

    class Meta:
        model = Mentor
        fields = ['id', 'name', 'headline', 'exams', 'subjects', 'languages', 'sessionMinutes', 'hue', 'isVerified',
                  'sessionsDone', 'nextSlot', 'openSlots']

    def get_sessionsDone(self, mentor) -> int:
        return getattr(mentor, 'sessions_done', 0)

    def get_nextSlot(self, mentor) -> str | None:
        value = getattr(mentor, 'next_slot', None)
        return value.isoformat() if value else None

    def get_openSlots(self, mentor) -> int:
        return getattr(mentor, 'open_slots', 0)


class MentorDetailSerializer(MentorCardSerializer):
    slots = serializers.SerializerMethodField()

    class Meta(MentorCardSerializer.Meta):
        fields = MentorCardSerializer.Meta.fields + ['bio', 'slots']

    def get_slots(self, mentor) -> list[dict]:
        return SlotSerializer(self.context.get('slots', []), many=True).data


class BookSerializer(serializers.Serializer):
    topic = serializers.CharField(max_length=300)

    def validate_topic(self, value):
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError('Tell your mentor a little more, so they can prepare (at least 10 characters).')
        return value


def call_link(booking) -> str | None:
    """The session's own Meet link, or the mentor's backup link if Google could not create one."""
    return booking.meet_url or booking.slot.mentor.meeting_url or None


class BookingSerializer(serializers.ModelSerializer):
    """A booking as the student sees it. The call link appears only while the booking is active."""

    startsAt = serializers.DateTimeField(source='slot.starts_at')
    minutes = serializers.IntegerField(source='slot.minutes')
    mentor = serializers.SerializerMethodField()
    meetingUrl = serializers.SerializerMethodField()
    inviteSent = serializers.SerializerMethodField()
    canCancel = serializers.SerializerMethodField()
    cancelledBy = serializers.CharField(source='cancelled_by')
    createdAt = serializers.DateTimeField(source='created_at')

    class Meta:
        model = Booking
        fields = ['id', 'status', 'topic', 'startsAt', 'minutes', 'mentor', 'meetingUrl', 'inviteSent', 'canCancel', 'cancelledBy', 'createdAt']

    def get_mentor(self, booking) -> dict:
        m = booking.slot.mentor
        return {'id': m.slug, 'name': m.display_name, 'headline': m.headline, 'hue': m.avatar_hue, 'isVerified': m.is_verified}

    def get_meetingUrl(self, booking) -> str | None:
        if booking.status != Booking.Status.BOOKED:
            return None
        return call_link(booking)

    def get_inviteSent(self, booking) -> bool:
        return bool(booking.calendar_event_id)

    def get_canCancel(self, booking) -> bool:
        return student_can_cancel(booking)


class MentorSlotSerializer(serializers.ModelSerializer):
    """A mentor's own slot, with who booked it."""

    startsAt = serializers.DateTimeField(source='starts_at')
    booking = serializers.SerializerMethodField()

    class Meta:
        model = Slot
        fields = ['id', 'startsAt', 'minutes', 'booking']

    def get_booking(self, slot) -> dict | None:
        booking = next((b for b in slot.bookings.all() if b.status == Booking.Status.BOOKED), None)
        if booking is None:
            return None
        profile = getattr(booking.student, 'profile', None)
        return {
            'id': booking.id,
            'studentName': booking.student.display_name,
            'studentHue': profile.avatar_hue if profile else None,
            'studentExam': f'{profile.exam} {profile.target_year}' if profile else None,
            'topic': booking.topic,
            'meetingUrl': call_link(booking),
            'inviteSent': bool(booking.calendar_event_id),
        }


class MentorSelfSerializer(CleanChoicesMixin, serializers.ModelSerializer):
    """What a mentor can edit about themselves. Verification stays with staff."""

    id = serializers.CharField(source='slug', read_only=True)
    name = serializers.CharField(source='display_name', read_only=True)
    isVerified = serializers.BooleanField(source='is_verified', read_only=True)
    isActive = serializers.BooleanField(source='is_active', read_only=True)
    exams = serializers.ListField(child=serializers.ChoiceField(choices=Exam.choices), allow_empty=False, max_length=2)
    subjects = serializers.ListField(child=serializers.ChoiceField(choices=Subject.choices), allow_empty=False, max_length=4)
    languages = serializers.ListField(child=serializers.ChoiceField(choices=Language.choices), allow_empty=False, max_length=3)
    sessionMinutes = serializers.ChoiceField(source='session_minutes', choices=Mentor.Length.choices)
    meetingUrl = serializers.URLField(source='meeting_url', allow_blank=True, max_length=200)

    class Meta:
        model = Mentor
        fields = ['id', 'name', 'isVerified', 'isActive', 'headline', 'bio', 'exams', 'subjects', 'languages', 'sessionMinutes', 'meetingUrl']


class CreateSlotsSerializer(serializers.Serializer):
    startsAt = serializers.ListField(child=serializers.DateTimeField(), allow_empty=False, max_length=40)
