from datetime import timedelta
from unittest.mock import patch

import requests
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.google import user_for_claims
from apps.accounts.models import User
from apps.notifications.models import Notification

from . import google_calendar
from .admin import MentorForm
from .models import Booking, Mentor
from .tests import make_mentor, make_student, slot

CONNECTED = dict(GOOGLE_CALENDAR_CLIENT_ID='id', GOOGLE_CALENDAR_CLIENT_SECRET='secret', GOOGLE_CALENDAR_REFRESH_TOKEN='token')
TOPIC = {'topic': 'Help me plan organic chemistry revision'}
MEET = 'https://meet.google.com/new-link-abc'


class FakeResponse:
    def __init__(self, status=200, data=None):
        self.status_code = status
        self.ok = status < 400
        self._data = data or {}

    def json(self):
        return self._data


class FakeGoogle:
    """Stands in for Google's servers, and records what CrackRoom asked for."""

    def __init__(self, event=None, status=200, get_events=None):
        self.event = event or {'id': 'evt', 'hangoutLink': MEET}
        self.status = status
        self.get_events = list(get_events or [])
        self.calls = []

    def __call__(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        if method == 'GET':
            return FakeResponse(200, self.get_events.pop(0) if self.get_events else self.event)
        if method == 'DELETE':
            return FakeResponse(self.status)
        return FakeResponse(self.status, self.event)


class CalendarCase(APITestCase):
    def setUp(self):
        google_calendar._token.update(value='access', expires=9e12)
        self.mentor = make_mentor(meeting_url='https://meet.google.com/backup-link')
        self.student = make_student('student@example.com', 'Asha')
        self.slot = slot(self.mentor)
        self.client.force_authenticate(self.student)

    def book(self):
        return self.client.post(f'/api/mentorship/slots/{self.slot.id}/book/', TOPIC, format='json')


@override_settings(**CONNECTED)
class InviteTests(CalendarCase):
    def book_with(self, google):
        with patch('apps.mentorship.google_calendar.requests.request', google), patch('apps.mentorship.google_calendar.time.sleep'):
            return self.book()

    def test_booking_creates_event_inviting_both_and_returns_the_meet_link(self):
        google = FakeGoogle()
        response = self.book_with(google)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['meetingUrl'], MEET)
        self.assertTrue(response.data['inviteSent'])

        method, _url, kwargs = google.calls[0]
        self.assertEqual(method, 'POST')
        self.assertEqual(kwargs['params'], {'conferenceDataVersion': 1, 'sendUpdates': 'all'})
        body = kwargs['json']
        self.assertEqual([a['email'] for a in body['attendees']], ['student@example.com', 'mentor@example.com'])
        self.assertFalse(body['guestsCanSeeOtherGuests'])
        self.assertEqual(body['conferenceData']['createRequest']['conferenceSolutionKey']['type'], 'hangoutsMeet')
        self.assertIn('Asha', body['summary'])
        self.assertIn('organic chemistry', body['description'])
        self.assertNotIn('@', body['summary'] + body['description'])
        # Google's event ids accept only a-v and 0-9.
        self.assertRegex(body['id'], r'^[a-v0-9]{5,}$')

    def test_event_times_match_the_slot(self):
        google = FakeGoogle()
        self.book_with(google)
        body = google.calls[0][2]['json']
        self.assertEqual(body['start']['dateTime'], self.slot.starts_at.isoformat())
        self.assertEqual(body['end']['dateTime'], (self.slot.starts_at + timedelta(minutes=30)).isoformat())

    def test_waits_for_a_link_google_is_still_creating(self):
        google = FakeGoogle(event={'id': 'evt'}, get_events=[{'id': 'evt'}, {'id': 'evt', 'hangoutLink': MEET}])
        self.assertEqual(self.book_with(google).data['meetingUrl'], MEET)

    def test_google_failure_keeps_the_booking_and_uses_the_backup_link(self):
        for google in [FakeGoogle(status=500), self._raises(requests.ConnectionError())]:
            with self.subTest(google=google):
                Booking.objects.all().delete()
                response = self.book_with(google)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data['meetingUrl'], 'https://meet.google.com/backup-link')
                self.assertFalse(response.data['inviteSent'])
                self.assertEqual(Booking.objects.get().status, 'booked')

    @staticmethod
    def _raises(error):
        def google(*args, **kwargs):
            raise error
        return google

    def test_retry_reuses_the_event_instead_of_inviting_twice(self):
        Booking.objects.create(slot=self.slot, student=self.student, topic=TOPIC['topic'])
        booking = Booking.objects.get()
        google = FakeGoogle(status=409)
        with patch('apps.mentorship.google_calendar.requests.request', google):
            self.assertTrue(google_calendar.send_invite(booking))
        self.assertEqual([c[0] for c in google.calls], ['POST', 'GET'])
        booking.refresh_from_db()
        self.assertEqual(booking.meet_url, MEET)

    def test_student_cancel_cancels_the_event_and_hides_the_link(self):
        google = FakeGoogle()
        booking_id = self.book_with(google).data['id']
        with patch('apps.mentorship.google_calendar.requests.request', google):
            response = self.client.post(f'/api/mentorship/bookings/{booking_id}/cancel/')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['meetingUrl'])
        method, url, kwargs = google.calls[-1]
        self.assertEqual((method, kwargs['params']), ('DELETE', {'sendUpdates': 'all'}))
        self.assertTrue(url.endswith('/evt'))

    def test_mentor_removing_the_slot_cancels_the_event(self):
        google = FakeGoogle()
        self.book_with(google)
        self.client.force_authenticate(self.mentor.user)
        with patch('apps.mentorship.google_calendar.requests.request', google):
            self.assertEqual(self.client.delete(f'/api/mentorship/me/slots/{self.slot.id}/').status_code, 204)
        self.assertEqual(google.calls[-1][0], 'DELETE')

    def test_google_failure_does_not_block_cancelling(self):
        google = FakeGoogle()
        booking_id = self.book_with(google).data['id']
        with patch('apps.mentorship.google_calendar.requests.request', FakeGoogle(status=500)):
            response = self.client.post(f'/api/mentorship/bookings/{booking_id}/cancel/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'cancelled')

    def test_mentor_sees_the_meet_link_but_other_students_do_not(self):
        self.book_with(FakeGoogle())
        self.client.force_authenticate(self.mentor.user)
        own = self.client.get('/api/mentorship/me/').data['slots'][0]['booking']
        self.assertEqual(own['meetingUrl'], MEET)
        self.assertTrue(own['inviteSent'])
        self.assertNotIn('student@example.com', str(own))
        self.client.force_authenticate(make_student('other@example.com'))
        self.assertNotIn(MEET, str(self.client.get(f'/api/mentors/{self.mentor.slug}/').data))
        self.assertEqual(self.client.get('/api/mentorship/bookings/').data, [])


class NotConnectedTests(CalendarCase):
    def test_bookings_work_with_no_google_calls(self):
        with patch('apps.mentorship.google_calendar.requests.request') as google, patch('apps.mentorship.google_calendar.requests.post') as token:
            response = self.book()
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data['inviteSent'])
        google.assert_not_called()
        token.assert_not_called()


class BookingNotificationTests(CalendarCase):
    def inbox(self, user):
        self.client.force_authenticate(user)
        return self.client.get('/api/notifications/').data

    def test_mentor_is_told_about_a_booking(self):
        self.book()
        data = self.inbox(self.mentor.user)
        self.assertEqual(data['unread'], 1)
        item = data['results'][0]
        self.assertEqual((item['kind'], item['actor']['name'], item['link'], item['postId']), ('booking', 'Asha', '/mentorship/schedule', None))
        self.assertIn('organic chemistry', item['preview'])
        self.assertNotIn('student@example.com', str(item))

    def test_mentor_is_told_when_the_student_cancels(self):
        booking_id = self.book().data['id']
        self.client.post(f'/api/mentorship/bookings/{booking_id}/cancel/')
        self.assertEqual([n['kind'] for n in self.inbox(self.mentor.user)['results']], ['cancel', 'booking'])

    def test_student_is_told_when_the_mentor_cancels_by_the_mentor_name(self):
        self.book()
        self.client.force_authenticate(self.mentor.user)
        self.client.delete(f'/api/mentorship/me/slots/{self.slot.id}/')
        item = self.inbox(self.student)['results'][0]
        self.assertEqual((item['kind'], item['actor']['name'], item['link']), ('cancel', 'Dr. Meera', '/mentorship'))
        self.assertEqual(Notification.objects.filter(recipient=self.student).count(), 1)


class OlderMentorRecordTests(APITestCase):
    """Hand-typed values from the old admin form once blanked the whole mentorship page."""

    def setUp(self):
        self.mentor = make_mentor(exams='JEE, neet', subjects=['Physics', 'nonsense', 'physics'], languages=5)
        self.client.force_authenticate(make_student('s@example.com'))

    def test_list_and_profile_always_send_clean_lists(self):
        for data in [self.client.get('/api/mentors/').data[0], self.client.get(f'/api/mentors/{self.mentor.slug}/').data]:
            self.assertEqual(data['exams'], ['JEE', 'NEET'])
            self.assertEqual(data['subjects'], ['physics'])
            self.assertEqual(data['languages'], [])

    def test_filters_match_the_cleaned_values(self):
        self.assertEqual(len(self.client.get('/api/mentors/?exam=NEET').data), 1)
        self.assertEqual(len(self.client.get('/api/mentors/?subject=physics').data), 1)
        self.assertEqual(self.client.get('/api/mentors/?subject=biology').data, [])

    def test_mentor_schedule_sends_clean_lists(self):
        self.client.force_authenticate(self.mentor.user)
        self.assertEqual(self.client.get('/api/mentorship/me/').data['subjects'], ['physics'])

    def test_admin_form_ticks_the_matching_boxes(self):
        form = MentorForm(instance=self.mentor)
        self.assertEqual(form.initial['exams'], ['JEE', 'NEET'])
        self.assertEqual(form.initial['subjects'], ['physics'])


class MentorFormTests(APITestCase):
    def data(self, **overrides):
        return {
            'email': 'New.Mentor@Gmail.com', 'display_name': 'Swati Nayak', 'slug': '', 'headline': 'AIIMS Delhi', 'bio': 'Biology mentor.',
            'exams': ['NEET'], 'subjects': ['biology'], 'languages': ['English'], 'session_minutes': 30, 'meeting_url': '', 'avatar_hue': 262,
            'is_verified': True, 'is_active': True, **overrides,
        }

    def create(self):
        form = MentorForm(self.data())
        self.assertTrue(form.is_valid(), form.errors)
        return form.save()

    def test_creates_an_account_from_the_email_and_a_slug_from_the_name(self):
        form = MentorForm(self.data())
        self.assertTrue(form.is_valid(), form.errors)
        mentor = form.save()
        self.assertEqual(mentor.user.email, 'new.mentor@gmail.com')
        self.assertFalse(mentor.user.has_usable_password())
        self.assertTrue(mentor.slug.startswith('swati-nayak'))
        self.assertEqual(mentor.exams, ['NEET'])

    def test_uses_an_existing_account_with_that_email(self):
        existing = make_student('new.mentor@gmail.com')
        mentor = self.create()
        self.assertEqual(mentor.user, existing)
        self.assertEqual(User.objects.count(), 1)

    def test_refuses_a_second_mentor_with_the_same_email(self):
        self.create()
        form = MentorForm(self.data(display_name='Someone Else'))
        self.assertFalse(form.is_valid())
        self.assertIn('email', form.errors)

    def test_email_cannot_be_changed_afterwards(self):
        mentor = self.create()
        form = MentorForm(self.data(email='attacker@gmail.com'), instance=mentor)
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.save().user.email, 'new.mentor@gmail.com')

    def test_mentor_signing_in_with_google_joins_the_prepared_account(self):
        mentor = self.create()
        user = user_for_claims({'sub': 'g-1', 'email': 'new.mentor@gmail.com'})
        self.assertEqual(user, mentor.user)
        self.assertEqual(Mentor.objects.get().user.google_sub, 'g-1')

    def test_admin_add_page_loads_and_slots_take_the_session_length(self):
        admin_user = User.objects.create_superuser('boss@example.com', 'pass-for-tests-1')
        self.client.force_login(admin_user)
        self.assertEqual(self.client.get('/admin/mentorship/mentor/add/').status_code, 200)
        start = timezone.localtime(timezone.now() + timedelta(days=2))
        response = self.client.post('/admin/mentorship/mentor/add/', {
            **self.data(session_minutes=45), 'is_verified': 'on', 'is_active': 'on',
            'slots-TOTAL_FORMS': 1, 'slots-INITIAL_FORMS': 0, 'slots-MIN_NUM_FORMS': 0, 'slots-MAX_NUM_FORMS': 1000,
            'slots-0-starts_at_0': start.strftime('%Y-%m-%d'), 'slots-0-starts_at_1': '18:00:00',
        })
        self.assertEqual(response.status_code, 302, getattr(response, 'context', None) and response.context['errors'])
        self.assertEqual(Mentor.objects.get().slots.get().minutes, 45)
        self.assertEqual(self.client.get(f'/admin/mentorship/mentor/{Mentor.objects.get().pk}/change/').status_code, 200)
        self.assertEqual(self.client.get('/admin/mentorship/booking/').status_code, 200)
