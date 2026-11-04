import os
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.db import OperationalError
from django.test import TestCase, override_settings

from apps.accounts.models import User
from apps.rooms.models import Room


class HealthCheckTests(TestCase):
    @override_settings(ALLOWED_HOSTS=['example.com'], SECURE_SSL_REDIRECT=True)
    def test_answers_any_host_over_plain_http(self):
        response = self.client.get('/api/health/', HTTP_HOST='10.0.0.5:10000')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok', 'database': 'ok'})

    def test_database_outage_is_reported_but_not_fatal(self):
        with mock.patch('apps.common.middleware.connection.cursor', side_effect=OperationalError):
            response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['database'], 'unavailable')

    @override_settings(ALLOWED_HOSTS=['example.com'])
    def test_other_paths_still_check_the_host(self):
        self.assertEqual(self.client.get('/api/mentors/', HTTP_HOST='evil.example').status_code, 400)


class EnsureAdminTests(TestCase):
    def run_command(self, email='Boss@Example.com', password='a-long-admin-pass'):
        with mock.patch.dict(os.environ, {'DJANGO_SUPERUSER_EMAIL': email, 'DJANGO_SUPERUSER_PASSWORD': password}):
            call_command('ensure_admin', stdout=StringIO())

    def test_creates_then_updates(self):
        self.run_command()
        admin = User.objects.get(email='boss@example.com')
        self.assertTrue(admin.is_superuser and admin.is_staff)
        self.run_command(password='a-newer-admin-pass')
        admin.refresh_from_db()
        self.assertEqual(User.objects.count(), 1)
        self.assertTrue(admin.check_password('a-newer-admin-pass'))

    def test_promotes_an_existing_google_account(self):
        User.objects.create_user('boss@example.com', google_sub='123')
        self.run_command()
        admin = User.objects.get(email='boss@example.com')
        self.assertTrue(admin.is_superuser)
        self.assertEqual(admin.google_sub, '123')

    def test_skips_without_credentials(self):
        self.run_command(email='', password='')
        self.assertFalse(User.objects.exists())


class SeedRoomsTests(TestCase):
    def test_creates_public_rooms_only_once(self):
        call_command('seed_rooms', stdout=StringIO())
        count = Room.objects.count()
        self.assertGreater(count, 0)
        self.assertFalse(Room.objects.filter(visibility='private').exists())
        self.assertFalse(Room.objects.exclude(host=None).exists())
        Room.objects.first().delete()
        call_command('seed_rooms', stdout=StringIO())
        self.assertEqual(Room.objects.count(), count - 1)
