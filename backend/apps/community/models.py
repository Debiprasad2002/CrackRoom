from django.conf import settings
from django.db import models
from django.db.models import Q


class Post(models.Model):
    """
    A thought shared with every student. Text only for now; photos and videos will add a
    media relation here rather than changing what a post is.
    """

    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    body = models.CharField(max_length=1000, blank=True)
    # Reshares always point at the original post, never at another reshare.
    reshare_of = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='reshares')
    is_reshare = models.BooleanField(default=False, help_text='Stays true if the original is later deleted.')
    is_hidden = models.BooleanField(default=False, help_text='Hidden by a moderator.')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-id']
        constraints = [
            models.UniqueConstraint(
                fields=['author', 'reshare_of'], condition=Q(is_reshare=True, reshare_of__isnull=False), name='one_reshare_per_post'
            )
        ]

    def __str__(self):
        return f'{self.author}: {self.body[:40]}'


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='post_comments')
    # The comment this one answers. Replies outlive it, and simply stop being threaded.
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    body = models.CharField(max_length=500)
    is_hidden = models.BooleanField(default=False, help_text='Hidden by a moderator.')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.author}: {self.body[:40]}'


class Reaction(models.Model):
    class Kind(models.TextChoices):
        LIKE = 'like', 'Like'
        FIRE = 'fire', 'Motivating'
        IDEA = 'idea', 'Helpful'

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    kind = models.CharField(max_length=8, choices=Kind.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # One reaction per student per post; reacting again changes it.
        constraints = [models.UniqueConstraint(fields=['post', 'user'], name='one_reaction_per_post')]


class PostReport(models.Model):
    class Reason(models.TextChoices):
        SPAM = 'spam', 'Spam or advertising'
        HARASSMENT = 'harassment', 'Harassment or bullying'
        INAPPROPRIATE = 'inappropriate', 'Inappropriate content'
        CHEATING = 'cheating', 'Sharing leaked papers or cheating'
        OTHER = 'other', 'Something else'

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        ACTIONED = 'actioned', 'Action taken'
        DISMISSED = 'dismissed', 'Dismissed'

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reports')
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True, related_name='reports')
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    reason = models.CharField(max_length=16, choices=Reason.choices)
    details = models.CharField(max_length=1000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['post', 'reporter'], condition=Q(status='open', comment__isnull=True), name='one_open_post_report'
            ),
            models.UniqueConstraint(
                fields=['comment', 'reporter'], condition=Q(status='open', comment__isnull=False), name='one_open_comment_report'
            ),
        ]
