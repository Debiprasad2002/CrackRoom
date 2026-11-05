from .models import Notification


def notify(kind, actor, recipient_id, post=None, comment=None, booking=None):
    """Records a notification, unless the student would be notifying themselves."""
    if recipient_id == actor.id:
        return
    if kind == Notification.Kind.REACTION:
        Notification.objects.get_or_create(kind=kind, actor=actor, recipient_id=recipient_id, post=post)
        return
    Notification.objects.create(kind=kind, actor=actor, recipient_id=recipient_id, post=post, comment=comment, booking=booking)
