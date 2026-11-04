from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer

PAGE = 20

NotificationPage = inline_serializer('NotificationPage', {
    'results': NotificationSerializer(many=True),
    'unread': serializers.IntegerField(),
    'next': serializers.IntegerField(allow_null=True),
})


def inbox(user):
    """This student's notifications, leaving out anything moderated or from a closed account."""
    return Notification.objects.filter(
        Q(comment__isnull=True) | Q(comment__is_hidden=False),
        recipient=user,
        post__is_hidden=False,
        actor__is_active=True,
    )


class NotificationListView(APIView):
    """Newest first, 20 at a time, with the unread count. Pass `before=<id>` from the previous page's `next`."""

    @extend_schema(parameters=[OpenApiParameter('before', int)], responses=NotificationPage)
    def get(self, request):
        items = inbox(request.user)
        unread = items.filter(read_at__isnull=True).count()
        before = request.query_params.get('before')
        if before:
            if not before.isdigit():
                raise ValidationError({'before': ['Must be a notification id.']})
            items = items.filter(id__lt=int(before))
        page = list(items.select_related('actor__profile', 'post', 'comment').order_by('-id')[: PAGE + 1])
        return Response({
            'results': NotificationSerializer(page[:PAGE], many=True, context={'request': request}).data,
            'unread': unread,
            'next': page[PAGE - 1].id if len(page) > PAGE else None,
        })


class NotificationReadView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request, notification_id):
        updated = Notification.objects.filter(pk=notification_id, recipient=request.user)
        if not updated.exists():
            raise NotFound('This notification is no longer available.')
        updated.filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationReadAllView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        Notification.objects.filter(recipient=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)
