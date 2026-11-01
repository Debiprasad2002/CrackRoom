from rest_framework.test import APITestCase

from apps.accounts.models import Profile, User

from .models import Post, PostReport


def make_student(email, name='Student', avatar=''):
    user = User.objects.create_user(email)
    Profile.objects.create(user=user, display_name=name, exam='JEE', level='class12', subjects=['physics'], target_year=2027, avatar=avatar)
    return user


class FeedTests(APITestCase):
    def setUp(self):
        self.asha = make_student('a@example.com', 'Asha', avatar='rocket')
        self.kabir = make_student('k@example.com', 'Kabir')
        self.client.force_authenticate(self.asha)

    def post(self, body):
        return self.client.post('/api/community/posts/', {'body': body}, format='json')

    def test_post_and_read_feed(self):
        response = self.post('  Finished rotational motion today!\n\n\n\nOnto gravitation.  ')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['body'], 'Finished rotational motion today!\n\nOnto gravitation.')
        self.assertEqual(response.data['author'], {'name': 'Asha', 'hue': 262, 'avatar': 'rocket', 'exam': 'JEE', 'level': 'Class 12', 'isYou': True})
        self.assertTrue(response.data['canDelete'])
        self.client.force_authenticate(self.kabir)
        feed = self.client.get('/api/community/posts/').data
        self.assertEqual(len(feed['results']), 1)
        self.assertFalse(feed['results'][0]['author']['isYou'])
        self.assertFalse(feed['results'][0]['canDelete'])
        self.assertNotIn('email', str(feed))

    def test_validation_and_onboarding(self):
        self.assertEqual(self.post('   ').status_code, 400)
        self.assertEqual(self.post('x' * 1001).status_code, 400)
        bare = User.objects.create_user('b@example.com')
        self.client.force_authenticate(bare)
        self.assertEqual(self.post('hello').status_code, 403)

    def test_pagination_newest_first(self):
        for i in range(25):
            Post.objects.create(author=self.kabir, body=f'post {i}')
        first = self.client.get('/api/community/posts/').data
        self.assertEqual(first['results'][0]['body'], 'post 24')
        self.assertEqual(len(first['results']), 20)
        second = self.client.get(f'/api/community/posts/?before={first["next"]}').data
        self.assertEqual([p['body'] for p in second['results']], [f'post {i}' for i in range(4, -1, -1)])
        self.assertIsNone(second['next'])

    def test_hidden_posts_are_not_shown(self):
        Post.objects.create(author=self.kabir, body='spam', is_hidden=True)
        self.assertEqual(self.client.get('/api/community/posts/').data['results'], [])

    def test_mine_filter(self):
        self.post('mine')
        Post.objects.create(author=self.kabir, body='theirs')
        self.assertEqual([p['body'] for p in self.client.get('/api/community/posts/?mine=1').data['results']], ['mine'])


class ReactionTests(APITestCase):
    def setUp(self):
        self.asha = make_student('a@example.com', 'Asha')
        self.post = Post.objects.create(author=make_student('k@example.com', 'Kabir'), body='Mock test tomorrow')
        self.client.force_authenticate(self.asha)
        self.url = f'/api/community/posts/{self.post.id}/react/'

    def test_react_change_and_remove(self):
        data = self.client.post(self.url, {'kind': 'fire'}, format='json').data
        self.assertEqual((data['reactions'], data['myReaction']), ({'like': 0, 'fire': 1, 'idea': 0}, 'fire'))
        data = self.client.post(self.url, {'kind': 'like'}, format='json').data
        self.assertEqual((data['reactions'], data['myReaction']), ({'like': 1, 'fire': 0, 'idea': 0}, 'like'))
        data = self.client.delete(self.url).data
        self.assertEqual((data['reactions']['like'], data['myReaction']), (0, None))

    def test_counts_from_many_students(self):
        for i in range(3):
            self.client.force_authenticate(make_student(f's{i}@example.com'))
            self.client.post(self.url, {'kind': 'idea'}, format='json')
        self.assertEqual(self.client.get('/api/community/posts/').data['results'][0]['reactions']['idea'], 3)

    def test_invalid_kind_and_hidden_post(self):
        self.assertEqual(self.client.post(self.url, {'kind': 'angry'}, format='json').status_code, 400)
        Post.objects.filter(pk=self.post.pk).update(is_hidden=True)
        self.assertEqual(self.client.post(self.url, {'kind': 'like'}, format='json').status_code, 404)


class ReshareTests(APITestCase):
    def setUp(self):
        self.kabir = make_student('k@example.com', 'Kabir')
        self.original = Post.objects.create(author=self.kabir, body='Revise NCERT line by line.')
        self.asha = make_student('a@example.com', 'Asha')
        self.client.force_authenticate(self.asha)

    def reshare(self, post_id, body=''):
        return self.client.post(f'/api/community/posts/{post_id}/reshare/', {'body': body}, format='json')

    def test_reshare_with_comment_embeds_original(self):
        response = self.reshare(self.original.id, 'So true.')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['body'], 'So true.')
        self.assertTrue(response.data['isReshare'])
        self.assertEqual(response.data['resharedFrom']['author']['name'], 'Kabir')
        feed = self.client.get('/api/community/posts/').data['results']
        self.assertEqual(next(p for p in feed if p['id'] == self.original.id)['reshareCount'], 1)

    def test_reshare_of_reshare_points_to_original_once(self):
        first = self.reshare(self.original.id).data
        self.client.force_authenticate(make_student('t@example.com', 'Tanvi'))
        second = self.reshare(first['id']).data
        self.assertEqual(second['resharedFrom']['id'], self.original.id)
        self.assertEqual(self.reshare(self.original.id).status_code, 400)  # Already reshared.

    def test_deleted_original_shows_removed_card(self):
        reshared = self.reshare(self.original.id).data
        self.client.force_authenticate(self.kabir)
        self.assertEqual(self.client.delete(f'/api/community/posts/{self.original.id}/').status_code, 204)
        post = next(p for p in self.client.get('/api/community/posts/').data['results'] if p['id'] == reshared['id'])
        self.assertEqual(post['resharedFrom'], {'removed': True})


class ModerationTests(APITestCase):
    def setUp(self):
        self.kabir = make_student('k@example.com', 'Kabir')
        self.post = Post.objects.create(author=self.kabir, body='Selling leaked papers')
        self.client.force_authenticate(make_student('a@example.com', 'Asha'))

    def test_only_author_or_staff_delete(self):
        self.assertEqual(self.client.delete(f'/api/community/posts/{self.post.id}/').status_code, 403)
        staff = User.objects.create_user('staff@example.com', is_staff=True)
        self.client.force_authenticate(staff)
        self.assertEqual(self.client.delete(f'/api/community/posts/{self.post.id}/').status_code, 204)

    def test_report_once_and_not_own(self):
        url = f'/api/community/posts/{self.post.id}/report/'
        self.assertEqual(self.client.post(url, {'reason': 'cheating'}, format='json').status_code, 201)
        self.assertEqual(self.client.post(url, {'reason': 'cheating'}, format='json').status_code, 409)
        self.assertEqual(PostReport.objects.count(), 1)
        self.client.force_authenticate(self.kabir)
        self.assertEqual(self.client.post(url, {'reason': 'spam'}, format='json').status_code, 400)


class AvatarTests(APITestCase):
    def test_choose_and_validate_avatar(self):
        user = make_student('a@example.com')
        self.client.force_authenticate(user)
        self.assertEqual(self.client.patch('/api/profile/', {'avatar': 'dna'}, format='json').data['avatar'], 'dna')
        self.assertEqual(self.client.patch('/api/profile/', {'avatar': 'bookworm'}, format='json').data['avatar'], 'bookworm')
        self.assertEqual(self.client.patch('/api/profile/', {'avatar': 'not-a-preset'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/profile/', {'avatar': ''}, format='json').data['avatar'], '')


class CommentTests(APITestCase):
    def setUp(self):
        self.kabir = make_student('k@example.com', 'Kabir')
        self.post = Post.objects.create(author=self.kabir, body='Starting the bio class')
        self.asha = make_student('a@example.com', 'Asha', avatar='bookworm')
        self.client.force_authenticate(self.asha)
        self.url = f'/api/community/posts/{self.post.id}/comments/'

    def comment(self, body):
        return self.client.post(self.url, {'body': body}, format='json')

    def test_comment_and_list_in_order_with_count(self):
        first = self.comment('  Count me in!  ')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data['body'], 'Count me in!')
        self.assertEqual(first.data['author']['avatar'], 'bookworm')
        self.assertTrue(first.data['canDelete'])
        self.comment('Which chapter first?')
        self.assertEqual([c['body'] for c in self.client.get(self.url).data], ['Count me in!', 'Which chapter first?'])
        self.assertEqual(self.client.get('/api/community/posts/').data['results'][0]['commentCount'], 2)

    def test_validation(self):
        self.assertEqual(self.comment('   ').status_code, 400)
        self.assertEqual(self.comment('x' * 501).status_code, 400)
        Post.objects.filter(pk=self.post.pk).update(is_hidden=True)
        self.assertEqual(self.comment('hello').status_code, 404)

    def test_who_can_delete(self):
        comment_id = self.comment('Nice').data['id']
        stranger = make_student('s@example.com')
        self.client.force_authenticate(stranger)
        self.assertFalse(self.client.get(self.url).data[0]['canDelete'])
        self.assertEqual(self.client.delete(f'/api/community/comments/{comment_id}/').status_code, 403)
        # The post author can tidy their own thread.
        self.client.force_authenticate(self.kabir)
        self.assertTrue(self.client.get(self.url).data[0]['canDelete'])
        self.assertEqual(self.client.delete(f'/api/community/comments/{comment_id}/').status_code, 204)

    def test_hidden_comments_and_reports(self):
        comment_id = self.comment('Selling answer keys').data['id']
        self.client.force_authenticate(self.kabir)
        url = f'/api/community/comments/{comment_id}/report/'
        self.assertEqual(self.client.post(url, {'reason': 'cheating'}, format='json').status_code, 201)
        self.assertEqual(self.client.post(url, {'reason': 'cheating'}, format='json').status_code, 409)
        # Reporting a comment does not count as reporting the post itself.
        self.client.force_authenticate(make_student('t@example.com'))
        self.client.post(url, {'reason': 'spam'}, format='json')
        self.assertEqual(self.client.post(f'/api/community/posts/{self.post.id}/report/', {'reason': 'spam'}, format='json').status_code, 201)
        from .models import Comment
        Comment.objects.filter(pk=comment_id).update(is_hidden=True)
        self.assertEqual(self.client.get(self.url).data, [])
        self.assertEqual(self.client.get('/api/community/posts/').data['results'][0]['commentCount'], 0)
