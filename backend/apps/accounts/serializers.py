from rest_framework import serializers

from apps.common.choices import AVATAR_KEYS, SUBJECTS_BY_EXAM, Exam, Level, Subject

from .models import PRIVACY_KEYS, Profile


class PrivacySerializer(serializers.Serializer):
    showStats = serializers.BooleanField()
    showSubjects = serializers.BooleanField()
    showTargetYear = serializers.BooleanField()


class ProfileSerializer(serializers.ModelSerializer):
    """Mirrors the frontend `Profile` type, camelCase included."""

    displayName = serializers.CharField(source='display_name', min_length=2, max_length=40)
    exam = serializers.ChoiceField(choices=Exam.choices)
    level = serializers.ChoiceField(choices=Level.choices)
    subjects = serializers.ListField(
        child=serializers.ChoiceField(choices=Subject.choices), allow_empty=False, max_length=4
    )
    targetYear = serializers.IntegerField(source='target_year', min_value=2024, max_value=2040)
    dailyGoalMinutes = serializers.IntegerField(source='daily_goal_minutes', min_value=30, max_value=720)
    avatarHue = serializers.IntegerField(source='avatar_hue', min_value=0, max_value=359)
    avatar = serializers.ChoiceField(choices=[('', 'Initials'), *[(k, k) for k in AVATAR_KEYS]], required=False, allow_blank=True)
    privacy = PrivacySerializer()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Profile
        fields = [
            'displayName', 'exam', 'level', 'subjects', 'targetYear',
            'dailyGoalMinutes', 'avatarHue', 'avatar', 'privacy', 'createdAt',
        ]

    def validate(self, attrs):
        exam = attrs.get('exam', getattr(self.instance, 'exam', None))
        subjects = attrs.get('subjects', getattr(self.instance, 'subjects', []))
        outside = [s for s in subjects if s not in SUBJECTS_BY_EXAM.get(exam, set())]
        if outside:
            raise serializers.ValidationError(
                {'subjects': [f'{", ".join(outside)} is not part of the {exam} syllabus.']}
            )
        attrs['subjects'] = list(dict.fromkeys(subjects))
        if 'privacy' in attrs:
            attrs['privacy'] = {key: attrs['privacy'][key] for key in PRIVACY_KEYS}
        return attrs


class GoogleSignInSerializer(serializers.Serializer):
    """The ID token ("credential") that Google Identity Services hands the browser."""

    credential = serializers.CharField(max_length=4096)


class AccountDeleteSerializer(serializers.Serializer):
    confirm = serializers.CharField(max_length=16)

    def validate_confirm(self, value):
        if value.strip() != 'DELETE':
            raise serializers.ValidationError('Type DELETE to confirm.')
        return value


class SessionSerializer(serializers.Serializer):
    """What the app needs at start-up: who is signed in and whether onboarding is done."""

    email = serializers.EmailField()
    isStaff = serializers.BooleanField(source='is_staff')
    mentorId = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    def get_mentorId(self, user) -> str | None:
        mentor = getattr(user, 'mentor_profile', None)
        return mentor.slug if mentor else None

    def get_profile(self, user) -> dict | None:
        profile = getattr(user, 'profile', None)
        return ProfileSerializer(profile).data if profile else None
