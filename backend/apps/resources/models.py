import secrets

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

from apps.common.choices import SUBJECTS_BY_EXAM, ExamScope, Language, LevelScope, Subject


def resource_upload_path(instance, filename):
    # Random component so file locations cannot be guessed from the title.
    return f'resources/{instance.subject}/{secrets.token_hex(8)}.pdf'


def validate_pdf(file):
    limit = settings.RESOURCE_MAX_UPLOAD_MB * 1024 * 1024
    if file.size > limit:
        raise ValidationError(f'PDFs must be {settings.RESOURCE_MAX_UPLOAD_MB} MB or smaller.')
    position = file.tell() if hasattr(file, 'tell') else 0
    file.seek(0)
    header = file.read(5)
    file.seek(position)
    if header != b'%PDF-':
        raise ValidationError('This file is not a PDF.')


class Resource(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    slug = models.SlugField(max_length=100, unique=True, help_text='Public id used in URLs.')
    title = models.CharField(max_length=120)
    description = models.CharField(max_length=400)
    exam = models.CharField(max_length=8, choices=ExamScope.choices)
    level = models.CharField(max_length=12, choices=LevelScope.choices)
    subject = models.CharField(max_length=16, choices=Subject.choices)
    chapter = models.CharField(max_length=80)
    language = models.CharField(max_length=10, choices=Language.choices, default=Language.ENGLISH)
    file = models.FileField(
        upload_to=resource_upload_path,
        blank=True,
        validators=[FileExtensionValidator(['pdf']), validate_pdf],
        help_text='Stored privately. Students reach it only through the authorised download link.',
    )
    pages = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(2000)])
    source = models.CharField(max_length=80, default='CrackRoom Curated')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-published_at', 'title']
        permissions = [('publish_resource', 'Can publish and archive resources')]
        constraints = [
            # A student must never see a published entry that has nothing to open.
            models.CheckConstraint(
                condition=~Q(status='published') | (~Q(file='') & Q(published_at__isnull=False)),
                name='published_resource_has_file',
            )
        ]

    def __str__(self):
        return self.title

    def clean(self):
        if self.exam in SUBJECTS_BY_EXAM and self.subject not in SUBJECTS_BY_EXAM[self.exam]:
            raise ValidationError({'subject': f'{self.get_subject_display()} is not part of the {self.exam} syllabus.'})
        if self.status == self.Status.PUBLISHED:
            if not self.file:
                raise ValidationError({'file': 'Upload the PDF before publishing.'})
            # Set here as well as in save(): full_clean checks constraints before saving.
            self.published_at = self.published_at or timezone.now()

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = f'{slugify(self.title)[:80] or "notes"}-{secrets.token_hex(3)}'
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)
