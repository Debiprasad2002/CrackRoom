from rest_framework.test import APITestCase

from apps.accounts.models import Profile, User

from .models import ChatMessage, Room, RoomMembership, RoomReport


def make_user(email, name='Student'):
    user = User.objects.create_user(email, 'study-hard-42')
    Profile.objects.create(user=user, display_name=name, exam='JEE', level='class12', subjects=['physics'], target_year=2027)
    return user


def make_room(**overrides):
    fields = dict(
        name='Kinematics Sprint', description='Graphs and relative motion.', exam='JEE', level='class11',
        subject='physics', mode='pomodoro', visibility='public',
    )
    fields.update(overrides)
    return Room.objects.create(**fields)


NEW_ROOM = {
    'name': 'Organic Night', 'description': 'Mechanisms after dinner.', 'exam': 'both', 'level': 'class12',
    'subject': 'chemistry', 'mode': 'silent', 'visibility': 'private', 'focusMinutes': 45, 'breakMinutes': 5,
    'capacity': 3, 'rules': ['Silent during focus', '  '],
}


class RoomDiscoveryTests(APITestCase):
    def setUp(self):
        self.user = make_user('a@example.com')
        self.client.force_authenticate(self.user)

    def test_requires_sign_in(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/rooms/').status_code, 403)

    def test_list_shape_matches_frontend_and_presence_is_real(self):
        make_room()
        room = self.client.get('/api/rooms/').data[0]
        self.assertEqual(room['host'], 'CrackRoom')
        self.assertEqual(room['focusMinutes'], 50)
        self.assertEqual(room['participants'], 0)
        self.assertFalse(room['isLive'])
        self.assertEqual(room['timer']['status'], 'idle')
        self.assertIsNone(room['inviteCode'])

    def test_filters_include_shared_scopes(self):
        make_room(name='Both exams', exam='both', level='all')
        make_room(name='NEET only', exam='NEET', subject='biology')
        names = {r['name'] for r in self.client.get('/api/rooms/?exam=JEE&level=class12').data}
        self.assertEqual(names, {'Both exams'})
        self.assertEqual(len(self.client.get('/api/rooms/?q=neet').data), 1)

    def test_inactive_rooms_are_hidden(self):
        room = make_room(is_active=False)
        self.assertEqual(self.client.get('/api/rooms/').data, [])
        self.assertEqual(self.client.get(f'/api/rooms/{room.slug}/').status_code, 404)


class HostingTests(APITestCase):
    def setUp(self):
        self.host = make_user('host@example.com', 'Meera')
        self.other = make_user('other@example.com')
        self.client.force_authenticate(self.host)

    def test_create_private_room(self):
        response = self.client.post('/api/rooms/', NEW_ROOM, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['host'], 'Meera')
        self.assertTrue(response.data['isHost'])
        self.assertTrue(response.data['isMember'])
        self.assertEqual(response.data['rules'], ['Silent during focus'])
        self.assertEqual(len(response.data['inviteCode']), 8)

    def test_onboarding_required_to_host(self):
        bare = User.objects.create_user('bare@example.com', 'study-hard-42')
        self.client.force_authenticate(bare)
        self.assertEqual(self.client.post('/api/rooms/', NEW_ROOM, format='json').status_code, 403)

    def test_hosting_limit(self):
        for i in range(5):
            make_room(name=f'Room {i}', host=self.host)
        self.assertEqual(self.client.post('/api/rooms/', NEW_ROOM, format='json').status_code, 400)

    def test_only_host_can_edit_or_close(self):
        room = make_room(host=self.host)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.patch(f'/api/rooms/{room.slug}/', {'name': 'Mine now'}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(f'/api/rooms/{room.slug}/').status_code, 403)
        self.client.force_authenticate(self.host)
        self.assertEqual(self.client.delete(f'/api/rooms/{room.slug}/').status_code, 204)
        room.refresh_from_db()
        self.assertFalse(room.is_active)

    def test_reset_invite_code(self):
        room = make_room(host=self.host, visibility='private')
        old = room.invite_code
        response = self.client.post(f'/api/rooms/{room.slug}/invite-code/')
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data['inviteCode'], old)


class MembershipAndChatTests(APITestCase):
    def setUp(self):
        self.host = make_user('host@example.com', 'Meera')
        self.student = make_user('s@example.com', 'Kabir')
        self.public = make_room(host=self.host)
        self.private = make_room(name='Circle', host=self.host, visibility='private', capacity=2)
        RoomMembership.objects.create(room=self.private, user=self.host, role='host')
        self.client.force_authenticate(self.student)

    def test_private_room_code_never_shown_to_others(self):
        data = self.client.get(f'/api/rooms/{self.private.slug}/').data
        self.assertIsNone(data['inviteCode'])
        self.assertFalse(data['isMember'])

    def test_join_private_needs_valid_code(self):
        url = f'/api/rooms/{self.private.slug}/join/'
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 403)
        self.assertEqual(self.client.post(url, {'inviteCode': 'WRONG123'}, format='json').status_code, 403)
        response = self.client.post(url, {'inviteCode': self.private.invite_code.lower()}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['isMember'])

    def test_private_room_capacity(self):
        RoomMembership.objects.create(room=self.private, user=make_user('x@example.com'))
        response = self.client.post(f'/api/rooms/{self.private.slug}/join/', {'inviteCode': self.private.invite_code}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_private_chat_is_members_only(self):
        url = f'/api/rooms/{self.private.slug}/messages/'
        ChatMessage.objects.create(room=self.private, author=self.host, body='Secret plan')
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.client.post(url, {'body': 'hi'}, format='json').status_code, 403)

    def test_public_chat_post_needs_join_then_polls(self):
        url = f'/api/rooms/{self.public.slug}/messages/'
        self.assertEqual(self.client.post(url, {'body': 'hello'}, format='json').status_code, 403)
        self.client.post(f'/api/rooms/{self.public.slug}/join/')
        first = self.client.post(url, {'body': '  hello  '}, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data['body'], 'hello')
        self.assertEqual(first.data['author'], 'Kabir')
        self.assertTrue(first.data['isOwn'])
        self.assertEqual(first.data['roomId'], self.public.slug)
        second = self.client.post(url, {'body': 'second'}, format='json')

        self.assertEqual([m['body'] for m in self.client.get(url).data], ['hello', 'second'])
        newer = self.client.get(f'{url}?after={first.data["id"]}').data
        self.assertEqual([m['id'] for m in newer], [second.data['id']])

    def test_hidden_messages_are_not_returned(self):
        ChatMessage.objects.create(room=self.public, author=self.host, body='removed', is_hidden=True)
        self.assertEqual(self.client.get(f'/api/rooms/{self.public.slug}/messages/').data, [])

    def test_blank_and_oversized_messages_rejected(self):
        self.client.post(f'/api/rooms/{self.public.slug}/join/')
        url = f'/api/rooms/{self.public.slug}/messages/'
        self.assertEqual(self.client.post(url, {'body': '   '}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'body': 'x' * 501}, format='json').status_code, 400)

    def test_host_cannot_leave_member_can(self):
        self.client.post(f'/api/rooms/{self.public.slug}/join/')
        self.assertEqual(self.client.post(f'/api/rooms/{self.public.slug}/leave/').status_code, 204)
        self.assertFalse(RoomMembership.objects.filter(room=self.public, user=self.student).exists())
        self.client.force_authenticate(self.host)
        self.assertEqual(self.client.post(f'/api/rooms/{self.private.slug}/leave/').status_code, 400)


class ReportTests(APITestCase):
    def setUp(self):
        self.student = make_user('s@example.com')
        self.room = make_room()
        self.client.force_authenticate(self.student)

    def test_report_once_while_open(self):
        url = f'/api/rooms/{self.room.slug}/report/'
        self.assertEqual(self.client.post(url, {'reason': 'spam', 'details': 'Ads'}, format='json').status_code, 201)
        self.assertEqual(self.client.post(url, {'reason': 'spam'}, format='json').status_code, 409)
        RoomReport.objects.update(status='dismissed')
        self.assertEqual(self.client.post(url, {'reason': 'other'}, format='json').status_code, 201)

    def test_report_message_must_belong_to_room(self):
        other_room = make_room(name='Other')
        message = ChatMessage.objects.create(room=other_room, author=self.student, body='hi')
        response = self.client.post(f'/api/rooms/{self.room.slug}/report/', {'reason': 'spam', 'messageId': message.id}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_invalid_reason(self):
        response = self.client.post(f'/api/rooms/{self.room.slug}/report/', {'reason': 'boring'}, format='json')
        self.assertEqual(response.status_code, 400)


class RoomDurationTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(make_user('host@example.com', 'Meera'))

    def test_hosts_choose_any_length_up_to_a_day(self):
        for focus, brk in [(60, 10), (120, 15), (24 * 60, 0), (95, 120)]:
            with self.subTest(focus=focus, brk=brk):
                response = self.client.post('/api/rooms/', {**NEW_ROOM, 'visibility': 'public', 'name': f'Marathon {focus}', 'focusMinutes': focus, 'breakMinutes': brk}, format='json')
                self.assertEqual(response.status_code, 201, response.data)
                self.assertEqual(response.data['timer']['focusSeconds'], focus * 60)
                Room.objects.all().update(is_active=False)

    def test_limits(self):
        for focus, brk in [(24 * 60 + 1, 10), (5, 10), (60, 121)]:
            with self.subTest(focus=focus, brk=brk):
                response = self.client.post('/api/rooms/', {**NEW_ROOM, 'focusMinutes': focus, 'breakMinutes': brk}, format='json')
                self.assertEqual(response.status_code, 400)
