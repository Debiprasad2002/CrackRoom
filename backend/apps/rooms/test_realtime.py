from datetime import timedelta

from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from config.asgi import application

from .models import RoomMembership, RoomPresence
from .realtime import apply_timer_action, issue_ticket, timer_state
from .tests import make_room, make_user

ORIGIN = [(b'origin', b'http://localhost:5173')]


class TimerMathTests(TestCase):
    def setUp(self):
        self.room = make_room(focus_minutes=25, break_minutes=5)
        self.t0 = timezone.now()

    def at(self, seconds):
        return timer_state(self.room, self.t0 + timedelta(seconds=seconds))

    def test_cycles_focus_then_break_then_focus(self):
        apply_timer_action(self.room, 'start', self.t0)
        self.assertEqual((self.at(0)['phase'], self.at(0)['remainingSeconds']), ('focus', 1500))
        self.assertEqual((self.at(1500)['phase'], self.at(1500)['remainingSeconds']), ('break', 300))
        self.assertEqual((self.at(1800 + 60)['phase'], self.at(1860)['remainingSeconds']), ('focus', 1440))

    def test_pause_freezes_and_resume_continues(self):
        apply_timer_action(self.room, 'start', self.t0)
        apply_timer_action(self.room, 'pause', self.t0 + timedelta(seconds=600))
        self.assertEqual(self.at(5000)['remainingSeconds'], 900)
        apply_timer_action(self.room, 'resume', self.t0 + timedelta(seconds=5000))
        self.assertEqual(self.at(5100)['remainingSeconds'], 800)

    def test_skip_jumps_to_next_phase(self):
        apply_timer_action(self.room, 'start', self.t0)
        apply_timer_action(self.room, 'skip', self.t0 + timedelta(seconds=10))
        self.assertEqual(self.at(10)['phase'], 'break')
        apply_timer_action(self.room, 'skip', self.t0 + timedelta(seconds=20))
        self.assertEqual((self.at(20)['phase'], self.at(20)['remainingSeconds']), ('focus', 1500))

    def test_reset(self):
        apply_timer_action(self.room, 'start', self.t0)
        apply_timer_action(self.room, 'reset', self.t0)
        self.assertEqual(self.at(100)['status'], 'idle')


class TimerApiTests(TestCase):
    def setUp(self):
        self.host = make_user('host@example.com', 'Meera')
        self.member = make_user('m@example.com', 'Kabir')
        self.hosted = make_room(host=self.host)
        self.official = make_room(name='Official')
        for room in (self.hosted, self.official):
            RoomMembership.objects.create(room=room, user=self.member)
        self.client = APIClient()

    def test_only_host_runs_a_hosted_room(self):
        self.client.force_authenticate(self.member)
        response = self.client.post(f'/api/rooms/{self.hosted.slug}/timer/', {'action': 'start'}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(self.client.get(f'/api/rooms/{self.hosted.slug}/').data['canControlTimer'])
        self.client.force_authenticate(self.host)
        response = self.client.post(f'/api/rooms/{self.hosted.slug}/timer/', {'action': 'start'}, format='json')
        self.assertEqual(response.data['status'], 'running')

    def test_members_share_rooms_without_a_host(self):
        self.client.force_authenticate(self.member)
        self.assertTrue(self.client.get(f'/api/rooms/{self.official.slug}/').data['canControlTimer'])
        self.assertEqual(self.client.post(f'/api/rooms/{self.official.slug}/timer/', {'action': 'start'}, format='json').status_code, 200)
        outsider = make_user('o@example.com')
        self.client.force_authenticate(outsider)
        self.assertEqual(self.client.post(f'/api/rooms/{self.official.slug}/timer/', {'action': 'pause'}, format='json').status_code, 403)

    def test_invalid_action(self):
        self.client.force_authenticate(self.host)
        self.assertEqual(self.client.post(f'/api/rooms/{self.hosted.slug}/timer/', {'action': 'explode'}, format='json').status_code, 400)

    def test_socket_ticket_members_only(self):
        self.client.force_authenticate(make_user('o@example.com'))
        self.assertEqual(self.client.get(f'/api/rooms/{self.official.slug}/socket-ticket/').status_code, 403)
        self.client.force_authenticate(self.member)
        data = self.client.get(f'/api/rooms/{self.official.slug}/socket-ticket/').data
        self.assertTrue(data['ticket'])
        self.assertEqual(data['url'], f'/ws/rooms/{self.official.slug}/')
        self.assertEqual(len(data['you']), 12)


class PublicProfileTests(TestCase):
    def setUp(self):
        from apps.study.models import FocusSession

        self.member = make_user('m@example.com', 'Kabir')
        self.other = make_user('o@example.com', 'Riya')
        self.room = make_room()
        for user in (self.member, self.other):
            RoomMembership.objects.create(room=self.room, user=user)
        now = timezone.now()
        for days_ago in (0, 1, 2, 5):
            FocusSession.objects.create(user=self.other, minutes=30, completed_at=now - timedelta(days=days_ago))
        self.client = APIClient()
        self.client.force_authenticate(self.member)
        key = self.client.get(f'/api/rooms/{self.room.slug}/socket-ticket/').data['you']
        self.client.force_authenticate(self.other)
        self.other_key = self.client.get(f'/api/rooms/{self.room.slug}/socket-ticket/').data['you']
        self.client.force_authenticate(self.member)
        self.member_key = key

    def card(self):
        return self.client.get(f'/api/rooms/{self.room.slug}/people/{self.other_key}/')

    def test_respects_privacy_settings(self):
        profile = self.other.profile
        profile.privacy = {'showStats': True, 'showSubjects': False, 'showTargetYear': False}
        profile.save()
        data = self.card().data
        self.assertEqual(data['name'], 'Riya')
        self.assertIsNone(data['subjects'])
        self.assertIsNone(data['targetYear'])
        self.assertEqual(data['stats'], {'streak': 3, 'minutes': 120, 'sessions': 4})
        self.assertNotIn('email', data)

        profile.privacy = {'showStats': False, 'showSubjects': True, 'showTargetYear': True}
        profile.save()
        data = self.card().data
        self.assertIsNone(data['stats'])
        self.assertEqual((data['subjects'], data['targetYear']), (['physics'], 2027))

    def test_members_only_and_unknown_keys(self):
        self.assertEqual(self.client.get(f'/api/rooms/{self.room.slug}/people/000000000000/').status_code, 404)
        self.client.force_authenticate(make_user('x@example.com'))
        self.assertEqual(self.card().status_code, 403)


class RoomSocketTests(TransactionTestCase):
    def setUp(self):
        self.member = make_user('m@example.com', 'Kabir')
        self.other = make_user('o@example.com', 'Riya')
        self.room = make_room()
        RoomMembership.objects.create(room=self.room, user=self.member)
        RoomMembership.objects.create(room=self.room, user=self.other)

    def socket(self, user, ticket=None, origin=ORIGIN):
        ticket = ticket if ticket is not None else issue_ticket(user, self.room)
        return WebsocketCommunicator(application, f'/ws/rooms/{self.room.slug}/?ticket={ticket}', headers=origin)

    async def test_rejects_missing_ticket_foreign_origin_and_non_members(self):
        bad = self.socket(self.member, ticket='forged')
        connected, code = await bad.connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4401)

        foreign = self.socket(self.member, origin=[(b'origin', b'https://evil.example')])
        connected, _ = await foreign.connect()
        self.assertFalse(connected)

        outsider = await sync_to_async(make_user)('x@example.com')
        connected, code = await self.socket(outsider).connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4403)

    async def test_presence_chat_and_timer_flow(self):
        first = self.socket(self.member)
        self.assertTrue((await first.connect())[0])
        snapshot = await first.receive_json_from()
        self.assertEqual(snapshot['type'], 'snapshot')
        self.assertEqual([p['name'] for p in snapshot['people']], ['Kabir'])
        self.assertEqual((await first.receive_json_from())['type'], 'presence')

        second = self.socket(self.other)
        self.assertTrue((await second.connect())[0])
        await second.receive_json_from()  # snapshot
        presence = await first.receive_json_from()
        self.assertEqual({p['name'] for p in presence['people']}, {'Kabir', 'Riya'})
        await second.receive_json_from()  # same presence broadcast

        await second.send_json_to({'type': 'status', 'status': 'focusing'})
        update = await first.receive_json_from()
        self.assertEqual({p['name']: p['status'] for p in update['people']}['Riya'], 'focusing')
        await second.receive_json_from()

        # REST writes reach every open socket.
        client = APIClient()
        await sync_to_async(client.force_authenticate)(self.member)
        await sync_to_async(client.post)(f'/api/rooms/{self.room.slug}/messages/', {'body': 'Starting now'}, format='json')
        chat = await second.receive_json_from()
        self.assertEqual((chat['type'], chat['message']['body'], chat['message']['isOwn']), ('chat', 'Starting now', False))
        await first.receive_json_from()

        await sync_to_async(client.post)(f'/api/rooms/{self.room.slug}/timer/', {'action': 'start'}, format='json')
        timer = await second.receive_json_from()
        self.assertEqual((timer['type'], timer['timer']['status']), ('timer', 'running'))
        await first.receive_json_from()

        listing = await sync_to_async(client.get)('/api/rooms/')
        self.assertEqual(listing.data[0]['participants'], 2)
        self.assertTrue(listing.data[0]['isLive'])

        # Leaving closes that student's socket and updates everyone else.
        other_client = APIClient()
        await sync_to_async(other_client.force_authenticate)(self.other)
        await sync_to_async(other_client.post)(f'/api/rooms/{self.room.slug}/leave/')
        self.assertEqual((await second.receive_output())['type'], 'websocket.close')
        await second.disconnect()
        after = await first.receive_json_from()
        self.assertEqual([p['name'] for p in after['people']], ['Kabir'])

        await first.disconnect()
        self.assertFalse(await sync_to_async(RoomPresence.objects.exists)())
