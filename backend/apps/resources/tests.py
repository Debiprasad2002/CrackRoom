import shutil
import tempfile

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.common.management.commands.seed_demo import placeholder_pdf

from .models import Resource

MEDIA = tempfile.mkdtemp()


def pdf(name='notes.pdf'):
    return SimpleUploadedFile(name, placeholder_pdf('Test notes'), content_type='application/pdf')


def make_resource(status='published', with_file=True, **overrides):
    fields = dict(
        title='Kinematics Notes', description='Graphs.', exam='both', level='class11', subject='physics',
        chapter='Kinematics', status=status,
    )
    fields.update(overrides)
    if with_file:
        fields['file'] = pdf()
    return Resource.objects.create(**fields)


@override_settings(MEDIA_ROOT=MEDIA)
class ResourceApiTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.client.force_authenticate(User.objects.create_user('a@example.com', 'study-hard-42'))

    def test_only_published_resources_are_listed_or_retrievable(self):
        published = make_resource()
        draft = make_resource(status='draft', with_file=False, title='Draft')
        archived = make_resource(status='archived', title='Old')
        self.assertEqual([r['id'] for r in self.client.get('/api/resources/').data], [published.slug])
        for hidden in (draft, archived):
            self.assertEqual(self.client.get(f'/api/resources/{hidden.slug}/').status_code, 404)
            self.assertEqual(self.client.get(f'/api/resources/{hidden.slug}/file/').status_code, 404)

    def test_shape_matches_frontend(self):
        resource = make_resource(pages=12)
        data = self.client.get(f'/api/resources/{resource.slug}/').data
        self.assertEqual(data['fileType'], 'PDF')
        self.assertRegex(data['publishedAt'], r'^\d{4}-\d{2}-\d{2}$')
        self.assertEqual(data['fileUrl'], f'/api/resources/{resource.slug}/file/')
        self.assertNotIn('file', data)

    def test_filters(self):
        make_resource(title='Physics')
        make_resource(title='Biology', exam='NEET', subject='biology', chapter='Genetics', language='Hindi')
        self.assertEqual(len(self.client.get('/api/resources/?exam=JEE').data), 1)
        self.assertEqual(len(self.client.get('/api/resources/?language=Hindi').data), 1)
        self.assertEqual(len(self.client.get('/api/resources/?q=genetics').data), 1)

    def test_file_streams_for_signed_in_students_only(self):
        resource = make_resource()
        url = f'/api/resources/{resource.slug}/file/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response['Content-Disposition'].startswith('inline'))
        self.assertEqual(response['X-Frame-Options'], 'SAMEORIGIN')
        self.assertEqual(b''.join(response.streaming_content)[:5], b'%PDF-')
        self.assertTrue(self.client.get(f'{url}?download=1')['Content-Disposition'].startswith('attachment'))

        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.client.get('/api/resources/').status_code, 403)


@override_settings(MEDIA_ROOT=MEDIA)
class ResourceModelTests(APITestCase):
    def test_cannot_publish_without_file(self):
        resource = Resource(title='Empty', description='x', exam='JEE', level='class11', subject='physics', chapter='x', status='published')
        with self.assertRaises(ValidationError):
            resource.full_clean()
        with self.assertRaises(IntegrityError), transaction.atomic():
            Resource.objects.create(title='Empty', description='x', exam='JEE', level='class11', subject='physics', chapter='x', status='published')

    def test_rejects_non_pdf_upload(self):
        resource = Resource(
            title='Fake', description='x', exam='JEE', level='class11', subject='physics', chapter='x',
            file=SimpleUploadedFile('fake.pdf', b'MZ\x90\x00 not a pdf'),
        )
        with self.assertRaises(ValidationError) as ctx:
            resource.full_clean()
        self.assertIn('file', ctx.exception.message_dict)

    def test_subject_must_fit_exam(self):
        resource = Resource(title='x', description='x', exam='JEE', level='class11', subject='biology', chapter='x')
        with self.assertRaises(ValidationError) as ctx:
            resource.full_clean()
        self.assertIn('subject', ctx.exception.message_dict)

    def test_publishing_sets_date(self):
        resource = make_resource(status='draft')
        self.assertIsNone(resource.published_at)
        resource.status = 'published'
        resource.full_clean()
        resource.save()
        self.assertIsNotNone(resource.published_at)
