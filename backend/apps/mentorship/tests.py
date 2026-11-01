from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import Profile, User

from .models import Booking, Mentor, Slot


def make_student(email, name='Student'):
    user = User.objects.create_user(email)
    Profile.objects.create(user=user, display_name=name, exam='NEET', level='class12', subjects=['biology'], target_year=2027)
    return user


def make_mentor(email='mentor@example.com', **overrides):
    user = User.objects.create_user(email)
    fields = dict(
        user=user, display_name='Dr. Meera', headline='AIIMS Delhi · NEET 2022', bio='Biology mentor.',
        exams=['NEET'], subjects=['biology'], languages=['English', 'Hindi'], session_minutes=30,
        meeting_url='https://meet.google.com/abc-defg-hij', is_verified=True,
    )
    fields.update(overrides)
    return Mentor.objects.create(**fields)


def slot(mentor, hours=24, minutes=30):
    return Slot.objects.create(mentor=mentor, starts_at=timezone.now() + timedelta(hours=hours), minutes=minutes)


TOPIC = {'topic': 'Plan my Human Physiology revision before the mock test.'}


class DiscoveryTests(APITestCase):
    def setUp(self):
        self.mentor = make_mentor()
        self.client.force_authenticate(make_student('s@example.com'))

    def test_list_reports_real_figures_and_hides_private_fields(self):
        first = slot(self.mentor, hours=5)
        slot(self.mentor, hours=30)
        slot(self.mentor, hours=24 * 40)  # Beyond the booking window.
        data = self.client.get('/api/mentors/').data[0]
        self.assertEqual(data['openSlots'], 2)
        self.assertEqual(data['nextSlot'], first.starts_at.isoformat())
        self.assertEqual(data['sessionsDone'], 0)
        self.assertNotIn('meetingUrl', data)
        self.assertNotIn('email', data)

    def test_filters_and_hidden_mentors(self):
        make_mentor('jee@example.com', display_name='Arjun', exams=['JEE'], subjects=['physics'])
        make_mentor('off@example.com', display_name='Hidden', is_active=False)
        self.assertEqual([m['name'] for m in self.client.get('/api/mentors/?exam=JEE').data], ['Arjun'])
        self.assertEqual(len(self.client.get('/api/mentors/?subject=biology').data), 1)
        self.assertNotIn('Hidden', [m['name'] for m in self.client.get('/api/mentors/').data])

    def test_detail_lists_only_bookable_slots(self):
        open_one = slot(self.mentor, hours=6)
        held = slot(self.mentor, hours=7)
        Booking.objects.create(slot=held, student=make_student('o@example.com'), topic='x' * 12)
        slot(self.mentor, hours=0.2)  # Too soon.
        Slot.objects.create(mentor=self.mentor, starts_at=timezone.now() + timedelta(hours=9), minutes=30, is_cancelled=True)
        data = self.client.get(f'/api/mentors/{self.mentor.slug}/').data
        self.assertEqual([s['id'] for s in data['slots']], [open_one.id])
        self.assertIn('bio', data)

    def test_requires_sign_in(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/mentors/').status_code, 403)


class BookingTests(APITestCase):
    def setUp(self):
        self.mentor = make_mentor()
        self.student = make_student('s@example.com', 'Riya')
        self.client.force_authenticate(self.student)

    def book(self, s, data=TOPIC):
        return self.client.post(f'/api/mentorship/slots/{s.id}/book/', data, format='json')

    def test_book_and_see_meeting_link(self):
        s = slot(self.mentor)
        response = self.book(s)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['mentor']['name'], 'Dr. Meera')
        self.assertEqual(response.data['meetingUrl'], 'https://meet.google.com/abc-defg-hij')
        self.assertTrue(response.data['canCancel'])
        self.assertEqual(len(self.client.get('/api/mentorship/bookings/').data), 1)

    def test_slot_cannot_be_booked_twice(self):
        s = slot(self.mentor)
        self.book(s)
        self.client.force_authenticate(make_student('t@example.com'))
        response = self.book(s)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Someone just booked', response.data['detail'])

    def test_rules(self):
        self.assertEqual(self.book(slot(self.mentor, hours=0.25)).status_code, 400)  # Too soon.
        self.assertEqual(self.book(slot(self.mentor), {'topic': 'help'}).status_code, 400)  # Too vague.
        self.assertEqual(self.client.post('/api/mentorship/slots/999/book/', TOPIC, format='json').status_code, 404)

    def test_upcoming_limits(self):
        other = make_mentor('m2@example.com', display_name='Kabir')
        third = make_mentor('m3@example.com', display_name='Sana')
        self.assertEqual(self.book(slot(self.mentor, hours=10)).status_code, 201)
        self.assertEqual(self.book(slot(self.mentor, hours=30)).status_code, 400)  # Same mentor twice.
        self.assertEqual(self.book(slot(other, hours=10)).status_code, 201)
        response = self.book(slot(third, hours=10))
        self.assertEqual(response.status_code, 400)
        self.assertIn('2 upcoming sessions', response.data['detail'])

    def test_mentor_cannot_book_self_and_onboarding_required(self):
        self.client.force_authenticate(self.mentor.user)
        self.assertEqual(self.book(slot(self.mentor)).status_code, 403)  # Mentor has no student profile.
        Profile.objects.create(user=self.mentor.user, display_name='M', exam='NEET', level='other', subjects=['biology'], target_year=2027)
        self.assertEqual(self.book(slot(self.mentor, hours=40)).status_code, 400)

    def test_cancel_window_and_link_hidden_after_cancel(self):
        soon = slot(self.mentor, hours=1)
        later = slot(make_mentor('m2@example.com', display_name='Kabir'), hours=5)
        soon_id = self.book(soon).data['id']
        later_booking = self.book(later).data
        self.assertFalse(self.client.get('/api/mentorship/bookings/').data[0]['canCancel'])
        self.assertEqual(self.client.post(f'/api/mentorship/bookings/{soon_id}/cancel/').status_code, 400)
        cancelled = self.client.post(f'/api/mentorship/bookings/{later_booking["id"]}/cancel/')
        self.assertEqual(cancelled.data['status'], 'cancelled')
        self.assertIsNone(cancelled.data['meetingUrl'])
        # The freed slot can be booked again.
        self.client.force_authenticate(make_student('t@example.com'))
        self.assertEqual(self.book(later).status_code, 201)

    def test_cannot_cancel_someone_elses_booking(self):
        booking_id = self.book(slot(self.mentor)).data['id']
        self.client.force_authenticate(make_student('t@example.com'))
        self.assertEqual(self.client.post(f'/api/mentorship/bookings/{booking_id}/cancel/').status_code, 404)

    def test_sessions_done_counts_past_bookings(self):
        past = Slot.objects.create(mentor=self.mentor, starts_at=timezone.now() - timedelta(days=1), minutes=30)
        Booking.objects.create(slot=past, student=self.student, topic='x' * 12)
        self.assertEqual(self.client.get('/api/mentors/').data[0]['sessionsDone'], 1)


class MentorToolsTests(APITestCase):
    def setUp(self):
        self.mentor = make_mentor()
        self.client.force_authenticate(self.mentor.user)

    def at(self, hours):
        return (timezone.now() + timedelta(hours=hours)).replace(microsecond=0).isoformat()

    def test_students_are_refused(self):
        self.client.force_authenticate(make_student('s@example.com'))
        self.assertEqual(self.client.get('/api/mentorship/me/').status_code, 403)
        self.assertEqual(self.client.post('/api/mentorship/me/slots/', {'startsAt': [self.at(5)]}, format='json').status_code, 403)

    def test_session_flags_mentors(self):
        self.client.force_authenticate(None)
        self.client.force_login(self.mentor.user)
        self.assertEqual(self.client.get('/api/auth/session/').data['user']['mentorId'], self.mentor.slug)

    def test_publish_slots_and_see_bookings(self):
        response = self.client.post('/api/mentorship/me/slots/', {'startsAt': [self.at(5), self.at(6)]}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual([s['minutes'] for s in response.data], [30, 30])
        first = Slot.objects.order_by('starts_at').first()
        Booking.objects.create(slot=first, student=make_student('s@example.com', 'Riya'), topic='Genetics doubts, 12 questions')
        me = self.client.get('/api/mentorship/me/').data
        self.assertEqual(me['slots'][0]['booking']['studentName'], 'Riya')
        self.assertIsNone(me['slots'][1]['booking'])

    def test_slot_validation(self):
        self.client.post('/api/mentorship/me/slots/', {'startsAt': [self.at(5)]}, format='json')
        cases = [[self.at(0.1)], [self.at(24 * 70)], [self.at(10), self.at(10.2)], [(timezone.now() + timedelta(hours=5, minutes=10)).isoformat()]]
        for starts in cases:
            with self.subTest(starts=starts):
                self.assertEqual(self.client.post('/api/mentorship/me/slots/', {'startsAt': starts}, format='json').status_code, 400)

    def test_removing_a_booked_slot_cancels_the_booking(self):
        s = slot(self.mentor)
        booking = Booking.objects.create(slot=s, student=make_student('s@example.com'), topic='x' * 12)
        self.assertEqual(self.client.delete(f'/api/mentorship/me/slots/{s.id}/').status_code, 204)
        booking.refresh_from_db()
        self.assertEqual((booking.status, booking.cancelled_by), ('cancelled', 'mentor'))

    def test_edit_profile_but_not_verification(self):
        response = self.client.patch(
            '/api/mentorship/me/', {'headline': 'AIIMS Delhi · AIR 412', 'isVerified': False, 'meetingUrl': 'not a url'}, format='json'
        )
        self.assertEqual(response.status_code, 400)
        response = self.client.patch('/api/mentorship/me/', {'headline': 'AIIMS Delhi · AIR 412', 'isVerified': False}, format='json')
        self.assertEqual(response.status_code, 200)
        self.mentor.refresh_from_db()
        self.assertTrue(self.mentor.is_verified)
        self.assertEqual(self.mentor.headline, 'AIIMS Delhi · AIR 412')
