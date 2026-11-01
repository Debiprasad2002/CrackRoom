from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.rooms.models import Room

from .models import FocusSession, PlannedSession


def session_payload(**overrides):
    data = {
        'subject': 'physics', 'goal': 'Finish kinematics DPP', 'minutes': 25,
        'completedAt': timezone.now().isoformat(), 'roomId': None, 'partial': False,
    }
    data.update(overrides)
    return data


class FocusSessionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('a@example.com', 'study-hard-42')
        self.other = User.objects.create_user('b@example.com', 'study-hard-42')
        self.client.force_authenticate(self.user)

    def test_record_and_list(self):
        room = Room.objects.create(name='Sprint', description='x', exam='JEE', level='all', subject='physics', mode='pomodoro')
        response = self.client.post('/api/focus-sessions/', session_payload(roomId=room.slug), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['roomId'], room.slug)
        self.assertNotIn('clientId', response.data)
        listed = self.client.get('/api/focus-sessions/').data
        self.assertEqual(len(listed), 1)
        self.assertEqual(set(listed[0]), {'id', 'subject', 'goal', 'minutes', 'completedAt', 'roomId', 'partial'})

    def test_long_room_blocks_are_accepted(self):
        response = self.client.post('/api/focus-sessions/', session_payload(minutes=180), format='json')
        self.assertEqual(response.status_code, 201)

    def test_subject_can_be_null(self):
        response = self.client.post('/api/focus-sessions/', session_payload(subject=None), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data['subject'])

    def test_validation(self):
        future = (timezone.now() + timedelta(hours=1)).isoformat()
        for overrides in ({'minutes': 0}, {'minutes': 24 * 60 + 1}, {'completedAt': future}, {'roomId': 'no-such-room'}):
            with self.subTest(overrides=overrides):
                self.assertEqual(self.client.post('/api/focus-sessions/', session_payload(**overrides), format='json').status_code, 400)

    def test_retry_with_client_id_does_not_duplicate(self):
        first = self.client.post('/api/focus-sessions/', session_payload(clientId='abc123'), format='json')
        again = self.client.post('/api/focus-sessions/', session_payload(clientId='abc123'), format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(first.data['id'], again.data['id'])
        self.assertEqual(FocusSession.objects.count(), 1)

    def test_students_only_see_their_own(self):
        FocusSession.objects.create(user=self.other, minutes=30, completed_at=timezone.now())
        theirs = FocusSession.objects.get()
        self.assertEqual(self.client.get('/api/focus-sessions/').data, [])
        self.assertEqual(self.client.get(f'/api/focus-sessions/{theirs.id}/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/focus-sessions/{theirs.id}/').status_code, 404)

    def test_sessions_are_not_editable(self):
        created = self.client.post('/api/focus-sessions/', session_payload(), format='json').data
        self.assertEqual(self.client.patch(f'/api/focus-sessions/{created["id"]}/', {'minutes': 200}, format='json').status_code, 405)

    def test_date_range(self):
        now = timezone.now()
        FocusSession.objects.create(user=self.user, minutes=30, completed_at=now - timedelta(days=10))
        FocusSession.objects.create(user=self.user, minutes=30, completed_at=now)
        start = (timezone.localdate() - timedelta(days=2)).isoformat()
        self.assertEqual(len(self.client.get(f'/api/focus-sessions/?from={start}').data), 1)
        self.assertEqual(self.client.get('/api/focus-sessions/?from=yesterday').status_code, 400)

    def test_import_is_idempotent(self):
        items = [session_payload(clientId=f'local-{i}', minutes=20 + i) for i in range(3)]
        first = self.client.post('/api/focus-sessions/import/', items, format='json')
        self.assertEqual(first.data, {'imported': 3, 'skipped': 0})
        second = self.client.post('/api/focus-sessions/import/', items + [session_payload(clientId='local-9')], format='json')
        self.assertEqual(second.data, {'imported': 1, 'skipped': 3})
        self.assertEqual(FocusSession.objects.filter(user=self.user).count(), 4)

    def test_import_requires_client_ids(self):
        response = self.client.post('/api/focus-sessions/import/', [session_payload()], format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(FocusSession.objects.exists())


class PlannerTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('a@example.com', 'study-hard-42')
        self.client.force_authenticate(self.user)

    def test_crud(self):
        today = timezone.localdate().isoformat()
        created = self.client.post(
            '/api/plans/', {'date': today, 'subject': 'chemistry', 'title': ' Mole concept DPP ', 'minutes': 60}, format='json'
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['title'], 'Mole concept DPP')
        self.assertFalse(created.data['done'])
        url = f'/api/plans/{created.data["id"]}/'
        self.assertTrue(self.client.patch(url, {'done': True}, format='json').data['done'])
        self.assertEqual(self.client.get(f'/api/plans/?from={today}&to={today}').data[0]['id'], created.data['id'])
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(PlannedSession.objects.exists())

    def test_validation(self):
        base = {'date': timezone.localdate().isoformat(), 'subject': 'physics', 'title': 'x', 'minutes': 30}
        for overrides in ({'subject': 'history'}, {'title': '   '}, {'minutes': 1000}, {'date': '20-10-2026'}):
            with self.subTest(overrides=overrides):
                self.assertEqual(self.client.post('/api/plans/', {**base, **overrides}, format='json').status_code, 400)

    def test_other_students_plans_are_invisible(self):
        other = User.objects.create_user('b@example.com', 'study-hard-42')
        plan = PlannedSession.objects.create(user=other, date=timezone.localdate(), subject='physics', title='x', minutes=30)
        self.assertEqual(self.client.get('/api/plans/').data, [])
        self.assertEqual(self.client.patch(f'/api/plans/{plan.id}/', {'done': True}, format='json').status_code, 404)
