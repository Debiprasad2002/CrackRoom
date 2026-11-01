"""Shared vocabularies. Values match the frontend's `src/types/index.ts` exactly."""

from django.db import models


class Exam(models.TextChoices):
    JEE = 'JEE', 'JEE'
    NEET = 'NEET', 'NEET'


class ExamScope(models.TextChoices):
    """Exam a room or resource is aimed at; `both` covers shared syllabus."""

    JEE = 'JEE', 'JEE'
    NEET = 'NEET', 'NEET'
    BOTH = 'both', 'JEE + NEET'


class Level(models.TextChoices):
    CLASS_11 = 'class11', 'Class 11'
    CLASS_12 = 'class12', 'Class 12'
    DROPPER = 'dropper', 'Dropper'
    OTHER = 'other', 'Other'


class LevelScope(models.TextChoices):
    CLASS_11 = 'class11', 'Class 11'
    CLASS_12 = 'class12', 'Class 12'
    DROPPER = 'dropper', 'Dropper'
    OTHER = 'other', 'Other'
    ALL = 'all', 'All classes'


class Subject(models.TextChoices):
    PHYSICS = 'physics', 'Physics'
    CHEMISTRY = 'chemistry', 'Chemistry'
    MATHEMATICS = 'mathematics', 'Mathematics'
    BIOLOGY = 'biology', 'Biology'


class RoomSubject(models.TextChoices):
    PHYSICS = 'physics', 'Physics'
    CHEMISTRY = 'chemistry', 'Chemistry'
    MATHEMATICS = 'mathematics', 'Mathematics'
    BIOLOGY = 'biology', 'Biology'
    MIXED = 'mixed', 'Mixed'


class StudyMode(models.TextChoices):
    POMODORO = 'pomodoro', 'Pomodoro'
    SILENT = 'silent', 'Silent co-study'
    DOUBT = 'doubt', 'Doubt solving'
    REVISION = 'revision', 'Revision sprint'


class Visibility(models.TextChoices):
    PUBLIC = 'public', 'Public'
    PRIVATE = 'private', 'Private'


class Language(models.TextChoices):
    ENGLISH = 'English', 'English'
    HINDI = 'Hindi', 'Hindi'
    HINGLISH = 'Hinglish', 'Hinglish'


SUBJECTS_BY_EXAM: dict[str, set[str]] = {
    Exam.JEE: {Subject.PHYSICS, Subject.CHEMISTRY, Subject.MATHEMATICS},
    Exam.NEET: {Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY},
}


# Preset avatars students can pick. The frontend draws each one (icon + gradient);
# the server only stores and validates the key. Empty means "initials".
AVATAR_KEYS = (
    # Illustrated characters (images in the frontend's public/avatars/).
    'focused', 'bookworm', 'backpacker', 'topper',
    # Icon avatars.
    'atom', 'flask', 'dna', 'sigma', 'rocket', 'brain', 'microscope', 'telescope',
    'leaf', 'zap', 'compass', 'book', 'flame', 'moon', 'sun', 'sparkles',
)
