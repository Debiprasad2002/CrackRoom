from django.conf import settings
from django.db import models
from django.db.models import Q


class Notification(models.Model):
    """
    Something another student did that this student should hear about. The text is worked out
    when it is read, so a deleted or moderated post or comment never lingers in someone's list.
    """

    class Kind(models.TextChoices):
        REPLY = 'reply', 'Replied to your comment'
        COMMENT = 'comment', 'Commented on your post'
        REACTION = 'reaction', 'Reacted to your post'
        RESHARE = 'reshare', 'Reshared your post'

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    kind = models.CharField(max_length=8, choices=Kind.choices)
    post = models.ForeignKey('community.Post', on_delete=models.CASCADE, related_name='+')
    comment = models.ForeignKey('community.Comment', on_delete=models.CASCADE, null=True, blank=True, related_name='+')
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-id']
        indexes = [models.Index(fields=['recipient', '-id'], name='notification_inbox')]
        constraints = [
            # Tapping a reaction on and off should not ping the author every time.
            models.UniqueConstraint(fields=['recipient', 'actor', 'post'], condition=Q(kind='reaction'), name='one_reaction_notification'),
        ]

    def __str__(self):
        return f'{self.kind} for {self.recipient}'
