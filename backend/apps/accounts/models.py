from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.choices import Exam, Level


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError('An email address is required.')
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    """Students sign in with Google. Staff can also sign in to admin with a password."""

    username = None
    first_name = None
    last_name = None
    email = models.EmailField('email address', unique=True)
    google_sub = models.CharField(
        'Google account id', max_length=64, unique=True, null=True, blank=True, editable=False,
        help_text="Google's permanent id for the account; stays the same if the email changes.",
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    def __str__(self):
        return self.email

    @property
    def display_name(self) -> str:
        profile = getattr(self, 'profile', None)
        return profile.display_name if profile else 'Student'


def default_privacy():
    return {'showStats': True, 'showSubjects': True, 'showTargetYear': False}


PRIVACY_KEYS = tuple(default_privacy())


class Profile(models.Model):
    """Onboarding answers and preferences. Created when a student finishes onboarding."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=40)
    exam = models.CharField(max_length=8, choices=Exam.choices)
    level = models.CharField(max_length=12, choices=Level.choices)
    subjects = models.JSONField(default=list)
    target_year = models.PositiveSmallIntegerField(validators=[MinValueValidator(2024), MaxValueValidator(2040)])
    daily_goal_minutes = models.PositiveSmallIntegerField(
        default=240, validators=[MinValueValidator(30), MaxValueValidator(720)]
    )
    avatar_hue = models.PositiveSmallIntegerField(default=262, validators=[MaxValueValidator(359)])
    avatar = models.CharField(max_length=16, blank=True, help_text='Preset avatar key; empty shows initials.')
    privacy = models.JSONField(default=default_privacy)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.display_name
