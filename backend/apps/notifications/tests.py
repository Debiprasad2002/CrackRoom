from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.community.models import Comment, Post
from apps.community.tests import make_student

from .models import Notification

LIST = '/api/notifications/'


class NotificationTests(APITestCase):
    def setUp(self):
        self.asha = make_student('a@example.com', 'Asha', avatar='rocket')
        self.kabir = make_student('k@example.com', 'Kabir')
        self.meera = make_student('m@example.com', 'Meera')
        self.post = Post.objects.create(author=self.asha, body='Finished rotational motion')

    def as_user(self, user):
        self.client.force_authenticate(user)

    def comment(self, user, body='Nice work', parent=None, post=None):
        self.as_user(user)
        payload = {'body': body}
        if parent is not None:
            payload['parentId'] = parent
        return self.client.post(f'/api/community/posts/{(post or self.post).id}/comments/', payload, format='json')

    def inbox(self, user):
        self.as_user(user)
        return self.client.get(LIST).data

    def test_comment_notifies_the_post_author(self):
        self.assertEqual(self.comment(self.kabir).status_code, 201)
        data = self.inbox(self.asha)
        self.assertEqual(data['unread'], 1)
        item = data['results'][0]
        self.assertEqual(item['kind'], 'comment')
        self.assertEqual(item['actor']['name'], 'Kabir')
        self.assertEqual(item['postId'], self.post.id)
        self.assertEqual(item['preview'], 'Nice work')
        self.assertFalse(item['read'])
        self.assertNotIn('email', str(data))

    def test_reply_notifies_the_comment_author_and_post_author(self):
        parent = self.comment(self.kabir).data['id']
        reply = self.comment(self.meera, 'Which book did you use?', parent=parent)
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(reply.data['parentId'], parent)
        self.assertEqual(reply.data['replyToName'], 'Kabir')
        for_kabir = self.inbox(self.kabir)['results']
        self.assertEqual([(n['kind'], n['actor']['name'], n['preview']) for n in for_kabir], [('reply', 'Meera', 'Which book did you use?')])
        self.assertEqual([n['kind'] for n in self.inbox(self.asha)['results']], ['comment', 'comment'])

    def test_replying_to_a_comment_on_your_own_post_sends_one_notification(self):
        parent = self.comment(self.asha, 'Thanks all').data['id']
        self.comment(self.kabir, 'Welcome', parent=parent)
        self.assertEqual([n['kind'] for n in self.inbox(self.asha)['results']], ['reply'])

    def test_no_notifications_to_yourself(self):
        parent = self.comment(self.asha, 'Adding a note').data['id']
        self.comment(self.asha, 'And another', parent=parent)
        self.client.post(f'/api/community/posts/{self.post.id}/react/', {'kind': 'like'}, format='json')
        self.assertEqual(self.inbox(self.asha)['results'], [])

    def test_reply_must_be_to_a_comment_on_the_same_post(self):
        other = Post.objects.create(author=self.meera, body='Another post')
        elsewhere = Comment.objects.create(post=other, author=self.meera, body='Elsewhere')
        self.assertEqual(self.comment(self.kabir, 'Hi', parent=elsewhere.id).status_code, 400)
        hidden = Comment.objects.create(post=self.post, author=self.meera, body='Gone', is_hidden=True)
        self.assertEqual(self.comment(self.kabir, 'Hi', parent=hidden.id).status_code, 400)
        self.assertEqual(self.comment(self.kabir, 'Hi', parent=999999).status_code, 400)
        self.assertEqual(Notification.objects.count(), 0)

    def test_reaction_notifies_once_however_often_it_is_toggled(self):
        self.as_user(self.kabir)
        url = f'/api/community/posts/{self.post.id}/react/'
        self.client.post(url, {'kind': 'like'}, format='json')
        self.client.post(url, {'kind': 'fire'}, format='json')
        self.client.delete(url)
        self.client.post(url, {'kind': 'idea'}, format='json')
        self.assertEqual([n['kind'] for n in self.inbox(self.asha)['results']], ['reaction'])

    def test_reshare_notifies_the_original_author(self):
        self.as_user(self.kabir)
        first = self.client.post(f'/api/community/posts/{self.post.id}/reshare/', {'body': ''}, format='json')
        self.assertEqual(first.status_code, 201)
        self.as_user(self.meera)
        self.client.post(f'/api/community/posts/{first.data["id"]}/reshare/', {'body': ''}, format='json')
        items = self.inbox(self.asha)['results']
        self.assertEqual([(n['kind'], n['actor']['name'], n['postId']) for n in items], [('reshare', 'Meera', self.post.id), ('reshare', 'Kabir', self.post.id)])
        self.assertEqual(self.inbox(self.kabir)['results'], [])

    def test_notifications_are_private(self):
        self.comment(self.kabir)
        item = Notification.objects.get()
        self.assertEqual(self.inbox(self.meera)['results'], [])
        self.as_user(self.meera)
        self.assertEqual(self.client.post(f'{LIST}{item.id}/read/').status_code, 404)
        self.client.post(f'{LIST}read-all/')
        item.refresh_from_db()
        self.assertIsNone(item.read_at)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(LIST).status_code, 403)

    def test_mark_one_and_all_read(self):
        self.comment(self.kabir)
        self.comment(self.meera)
        first, second = self.inbox(self.asha)['results']
        self.assertEqual(self.client.post(f'{LIST}{first["id"]}/read/').status_code, 204)
        data = self.inbox(self.asha)
        self.assertEqual(data['unread'], 1)
        self.assertEqual([n['read'] for n in data['results']], [True, False])
        self.assertEqual(self.client.post(f'{LIST}read-all/').status_code, 204)
        self.assertEqual(self.inbox(self.asha)['unread'], 0)

    def test_removed_content_disappears_from_the_list(self):
        comment_id = self.comment(self.kabir, 'Rude remark').data['id']
        self.comment(self.meera, 'Kind remark')
        self.assertEqual(self.inbox(self.asha)['unread'], 2)
        Comment.objects.filter(pk=comment_id).update(is_hidden=True)
        data = self.inbox(self.asha)
        self.assertEqual(data['unread'], 1)
        self.assertNotIn('Rude remark', str(data))
        self.as_user(self.meera)
        self.client.delete(f'/api/community/comments/{data["results"][0]["commentId"]}/')
        self.assertEqual(self.inbox(self.asha)['results'], [])
        self.comment(self.kabir, 'Back again')
        Post.objects.filter(pk=self.post.id).update(is_hidden=True)
        self.assertEqual(self.inbox(self.asha)['unread'], 0)

    def test_closed_accounts_do_not_appear(self):
        self.comment(self.kabir)
        User.objects.filter(pk=self.kabir.pk).update(is_active=False)
        self.assertEqual(self.inbox(self.asha)['results'], [])

    def test_pagination(self):
        for i in range(25):
            Notification.objects.create(recipient=self.asha, actor=self.kabir, kind='comment', post=self.post)
        first = self.inbox(self.asha)
        self.assertEqual(len(first['results']), 20)
        self.assertEqual(first['unread'], 25)
        second = self.client.get(f'{LIST}?before={first["next"]}').data
        self.assertEqual(len(second['results']), 5)
        self.assertIsNone(second['next'])
        self.assertEqual(self.client.get(f'{LIST}?before=abc').status_code, 400)

    def test_comment_list_shows_threads_without_extra_queries(self):
        parent = self.comment(self.kabir).data['id']
        for i in range(3):
            self.comment(self.meera, f'Reply {i}', parent=parent)
        self.as_user(self.asha)
        with self.assertNumQueries(2):
            comments = self.client.get(f'/api/community/posts/{self.post.id}/comments/').data
        self.assertEqual([c['parentId'] for c in comments], [None, parent, parent, parent])
        self.assertEqual(comments[1]['replyToName'], 'Kabir')

    def test_replies_survive_when_the_parent_is_deleted(self):
        parent = self.comment(self.kabir).data['id']
        self.comment(self.meera, 'Still here', parent=parent)
        self.as_user(self.kabir)
        self.assertEqual(self.client.delete(f'/api/community/comments/{parent}/').status_code, 204)
        comments = self.client.get(f'/api/community/posts/{self.post.id}/comments/').data
        self.assertEqual([(c['body'], c['parentId'], c['replyToName']) for c in comments], [('Still here', None, None)])

    def test_single_post_can_be_opened_from_a_notification(self):
        self.as_user(self.kabir)
        response = self.client.get(f'/api/community/posts/{self.post.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['body'], 'Finished rotational motion')
        Post.objects.filter(pk=self.post.id).update(is_hidden=True)
        self.assertEqual(self.client.get(f'/api/community/posts/{self.post.id}/').status_code, 404)
