from unittest import mock

from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from .models import User

PROFILE = {
    'displayName': 'Aarav',
    'exam': 'JEE',
    'level': 'class12',
    'subjects': ['physics', 'mathematics'],
    'targetYear': 2027,
    'dailyGoalMinutes': 240,
    'avatarHue': 200,
    'privacy': {'showStats': True, 'showSubjects': True, 'showTargetYear': False},
}




CLIENT_ID = 'test-client.apps.googleusercontent.com'


def claims(**overrides):
    data = {
        'iss': 'https://accounts.google.com', 'aud': CLIENT_ID, 'sub': '1001', 'email': 'Asha@Gmail.com',
        'email_verified': True, 'name': 'Asha',
    }
    data.update(overrides)
    return data


@override_settings(GOOGLE_CLIENT_ID=CLIENT_ID)
class GoogleSignInTests(APITestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        patcher = mock.patch('apps.accounts.google.id_token.verify_oauth2_token')
        self.verify = patcher.start()
        self.addCleanup(patcher.stop)
        self.verify.return_value = claims()

    def sign_in(self, credential='google-id-token'):
        self.client.get('/api/auth/csrf/')
        token = self.client.cookies['csrftoken'].value
        return self.client.post('/api/auth/google/', {'credential': credential}, format='json', HTTP_X_CSRFTOKEN=token)

    def test_first_sign_in_creates_account_and_session(self):
        response = self.sign_in()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['email'], 'asha@gmail.com')
        self.assertIsNone(response.data['user']['profile'])
        user = User.objects.get()
        self.assertEqual(user.google_sub, '1001')
        self.assertFalse(user.has_usable_password())
        self.assertEqual(self.client.get('/api/auth/session/').data['user']['email'], 'asha@gmail.com')
        # The token is checked against this app's client id.
        self.assertEqual(self.verify.call_args.args[2], CLIENT_ID)

    def test_returning_student_matched_by_google_id_even_after_email_change(self):
        self.sign_in()
        self.verify.return_value = claims(email='asha.new@gmail.com')
        self.sign_in()
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.get().email, 'asha.new@gmail.com')

    def test_links_existing_account_with_same_email(self):
        existing = User.objects.create_user('asha@gmail.com', 'old-password-1')
        self.sign_in()
        existing.refresh_from_db()
        self.assertEqual(existing.google_sub, '1001')
        self.assertEqual(User.objects.count(), 1)

    def test_rejects_invalid_unverified_or_foreign_tokens(self):
        self.verify.side_effect = ValueError('Wrong recipient')
        self.assertEqual(self.sign_in().status_code, 400)
        self.verify.side_effect = None
        self.verify.return_value = claims(email_verified=False)
        self.assertEqual(self.sign_in().status_code, 400)
        self.verify.return_value = claims(iss='https://evil.example')
        self.assertEqual(self.sign_in().status_code, 400)
        self.assertFalse(User.objects.exists())

    def test_requires_csrf_token(self):
        response = self.client.post('/api/auth/google/', {'credential': 'x'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_suspended_account_cannot_sign_in(self):
        self.sign_in()
        User.objects.update(is_active=False)
        self.client.post('/api/auth/logout/', HTTP_X_CSRFTOKEN=self.client.cookies['csrftoken'].value)
        self.assertEqual(self.sign_in().status_code, 403)

    def test_password_endpoints_are_gone(self):
        for path in ('/api/auth/login/', '/api/auth/register/', '/api/auth/password-reset/'):
            self.assertEqual(self.client.post(path, {}, format='json').status_code, 404)

    @override_settings(GOOGLE_CLIENT_ID='')
    def test_not_configured(self):
        response = self.sign_in()
        self.assertEqual(response.status_code, 400)
        self.assertIn('not configured', response.data['detail'])


class AccountTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('a@example.com')
        self.client.force_authenticate(self.user)

    def test_delete_account_requires_typed_confirmation(self):
        self.assertEqual(self.client.delete('/api/auth/account/', {'confirm': 'yes'}, format='json').status_code, 400)
        self.assertEqual(self.client.delete('/api/auth/account/', {'confirm': 'DELETE'}, format='json').status_code, 204)
        self.assertFalse(User.objects.exists())


class ProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('a@example.com', 'study-hard-42')
        self.client.force_authenticate(self.user)

    def test_requires_sign_in(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/profile/').status_code, 403)

    def test_missing_profile_means_onboarding(self):
        self.assertEqual(self.client.get('/api/profile/').status_code, 404)

    def test_onboarding_creates_then_put_replaces(self):
        created = self.client.put('/api/profile/', PROFILE, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['displayName'], 'Aarav')
        self.assertIn('createdAt', created.data)
        updated = self.client.put('/api/profile/', {**PROFILE, 'dailyGoalMinutes': 360}, format='json')
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data['dailyGoalMinutes'], 360)

    def test_patch_updates_privacy(self):
        self.client.put('/api/profile/', PROFILE, format='json')
        response = self.client.patch(
            '/api/profile/', {'privacy': {'showStats': False, 'showSubjects': False, 'showTargetYear': True}}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['privacy'], {'showStats': False, 'showSubjects': False, 'showTargetYear': True})

    def test_subjects_must_match_exam(self):
        response = self.client.put('/api/profile/', {**PROFILE, 'subjects': ['biology']}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('subjects', response.data['errors'])

    def test_switching_exam_revalidates_existing_subjects(self):
        self.client.put('/api/profile/', PROFILE, format='json')
        response = self.client.patch('/api/profile/', {'exam': 'NEET'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_rejects_out_of_range_values(self):
        for field, value in [('dailyGoalMinutes', 5), ('targetYear', 1999), ('avatarHue', 400), ('displayName', 'A')]:
            with self.subTest(field=field):
                response = self.client.put('/api/profile/', {**PROFILE, field: value}, format='json')
                self.assertEqual(response.status_code, 400)
