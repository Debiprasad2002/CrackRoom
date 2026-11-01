from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.utils.crypto import constant_time_compare
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.public import public_profile
from apps.common.choices import Visibility

from .models import ChatMessage, Room, RoomMembership, RoomReport, new_invite_code
from .realtime import (
    apply_timer_action,
    broadcast,
    can_control_timer,
    disconnect_user,
    issue_ticket,
    member_key,
    participant_counts,
    timer_state,
)
from .serializers import (
    ChatMessageSerializer,
    JoinSerializer,
    RoomReportSerializer,
    RoomSerializer,
    TimerActionSerializer,
)

MAX_HOSTED_ROOMS = 5
MESSAGE_PAGE = 100

FILTER_PARAMS = [
    OpenApiParameter('exam', description='JEE or NEET; rooms for both exams are included.'),
    OpenApiParameter('level', description='class11, class12, dropper or other; all-class rooms are included.'),
    OpenApiParameter('subject'),
    OpenApiParameter('mode'),
    OpenApiParameter('visibility'),
    OpenApiParameter('q', description='Search name and description.'),
]


class RoomViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Study rooms. Private rooms are listed so students can find them, but reading or
    writing chat requires membership, which needs the host's invite code.
    """

    serializer_class = RoomSerializer
    lookup_field = 'slug'
    lookup_url_kwarg = 'room_id'
    pagination_class = None

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Room.objects.none()
        user = self.request.user
        member = RoomMembership.objects.filter(room=OuterRef('pk'), user=user)
        return (
            Room.objects.filter(is_active=True)
            .select_related('host__profile')
            .annotate(is_member=Exists(member))
        )

    def filter_queryset(self, queryset):
        if self.action != 'list':
            return queryset
        params = self.request.query_params
        if exam := params.get('exam'):
            queryset = queryset.filter(exam__in=[exam, 'both'])
        if level := params.get('level'):
            queryset = queryset.filter(level__in=[level, 'all'])
        for field in ('subject', 'mode', 'visibility'):
            if value := params.get(field):
                queryset = queryset.filter(**{field: value})
        if q := params.get('q', '').strip():
            queryset = queryset.filter(Q(name__icontains=q) | Q(description__icontains=q))
        return queryset

    def get_throttles(self):
        scopes = {'join': 'join', 'report': 'report'}
        if self.action == 'messages' and self.request.method == 'POST':
            self.throttle_scope = 'chat'
        else:
            self.throttle_scope = scopes.get(self.action)
        return super().get_throttles()

    @extend_schema(parameters=FILTER_PARAMS)
    def list(self, request, *args, **kwargs):
        rooms = list(self.filter_queryset(self.get_queryset()))
        context = {**self.get_serializer_context(), 'participants': participant_counts([r.id for r in rooms])}
        return Response(RoomSerializer(rooms, many=True, context=context).data)

    def require_host(self, room):
        if room.host_id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied('Only the host can change this room.')

    def require_member(self, room):
        if not room.is_member:
            raise PermissionDenied('Join this room first.')

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        if not hasattr(user, 'profile'):
            raise PermissionDenied('Finish onboarding before hosting a room.')
        if Room.objects.filter(host=user, is_active=True).count() >= MAX_HOSTED_ROOMS:
            raise ValidationError({'detail': f'You can host up to {MAX_HOSTED_ROOMS} rooms at a time.'})
        room = serializer.save(host=user)
        RoomMembership.objects.create(room=room, user=user, role=RoomMembership.Role.HOST)
        room.is_member = True

    def perform_update(self, serializer):
        self.require_host(serializer.instance)
        room = serializer.save()
        # A new rhythm changes where everyone is in the cycle.
        broadcast(room, {'type': 'timer', 'timer': timer_state(room)})

    def perform_destroy(self, room):
        self.require_host(room)
        # Kept for moderation history; hidden from everyone.
        room.is_active = False
        room.save(update_fields=['is_active', 'updated_at'])
        broadcast(room, {'type': 'closed'})

    @extend_schema(request=JoinSerializer, responses=RoomSerializer)
    @action(detail=True, methods=['post'])
    def join(self, request, room_id=None):
        room = self.get_object()
        if room.is_member:
            return Response(self.get_serializer(room).data)
        if room.visibility == Visibility.PRIVATE:
            serializer = JoinSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            code = serializer.validated_data.get('inviteCode', '').strip().upper()
            if not code or not constant_time_compare(code, room.invite_code):
                raise PermissionDenied('That invite code is not valid for this room.')
            if room.memberships.count() >= room.capacity:
                raise ValidationError({'detail': 'This room is full.'})
        RoomMembership.objects.get_or_create(room=room, user=request.user)
        room.is_member = True
        return Response(self.get_serializer(room).data)

    @extend_schema(request=None, responses={204: None})
    @action(detail=True, methods=['post'])
    def leave(self, request, room_id=None):
        room = self.get_object()
        if room.host_id == request.user.id:
            raise ValidationError({'detail': 'Hosts cannot leave their own room. Close the room instead.'})
        RoomMembership.objects.filter(room=room, user=request.user).delete()
        disconnect_user(room, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses=RoomSerializer)
    @action(detail=True, methods=['post'], url_path='invite-code')
    def reset_invite_code(self, request, room_id=None):
        """Issues a new invite code. Existing members stay; the old code stops working."""
        room = self.get_object()
        self.require_host(room)
        if room.visibility != Visibility.PRIVATE:
            raise ValidationError({'detail': 'Public rooms do not use invite codes.'})
        room.invite_code = new_invite_code()
        room.save(update_fields=['invite_code', 'updated_at'])
        return Response(self.get_serializer(room).data)

    @extend_schema(
        methods=['GET'],
        parameters=[OpenApiParameter('after', int, description='Only messages newer than this id.')],
        responses=ChatMessageSerializer(many=True),
    )
    @extend_schema(methods=['POST'], request=ChatMessageSerializer, responses={201: ChatMessageSerializer})
    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, room_id=None):
        """
        Room chat over plain HTTP. Poll with `?after=<last id>` until the WebSocket
        feed exists. Private rooms are members-only; posting always needs membership.
        """
        room = self.get_object()
        if request.method == 'POST':
            self.require_member(room)
            serializer = ChatMessageSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            message = serializer.save(room=room, author=request.user)
            # Others receive it with isOwn false; clients compare authorKey with their own key.
            broadcast(room, {'type': 'chat', 'message': ChatMessageSerializer(message).data})
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        if room.visibility == Visibility.PRIVATE:
            self.require_member(room)
        queryset = room.messages.filter(is_hidden=False).select_related('author__profile', 'room')
        after = request.query_params.get('after')
        if after:
            if not after.isdigit():
                raise ValidationError({'after': ['Must be a message id.']})
            queryset = queryset.filter(id__gt=int(after))[:MESSAGE_PAGE]
        else:
            # Latest page, returned oldest first so it can be appended in order.
            queryset = reversed(list(queryset.order_by('-id')[:MESSAGE_PAGE]))
        return Response(ChatMessageSerializer(queryset, many=True, context={'request': request}).data)

    @extend_schema(
        responses=inline_serializer(
            'SocketTicket',
            {'ticket': serializers.CharField(), 'url': serializers.CharField(), 'you': serializers.CharField()},
        )
    )
    @action(detail=True, methods=['get'], url_path='socket-ticket')
    def socket_ticket(self, request, room_id=None):
        """A one-minute ticket for opening the room's live socket. Members only."""
        room = self.get_object()
        self.require_member(room)
        return Response({
            'ticket': issue_ticket(request.user, room),
            'url': f'{settings.WEBSOCKET_PUBLIC_URL}/ws/rooms/{room.slug}/',
            'you': member_key(room, request.user.id),
        })

    @extend_schema(request=TimerActionSerializer, responses=inline_serializer('TimerState', {'status': serializers.CharField()}))
    @action(detail=True, methods=['post'])
    def timer(self, request, room_id=None):
        """Controls the shared timer: start, pause, resume, skip or reset."""
        room = self.get_object()
        if not can_control_timer(room, request.user, room.is_member):
            raise PermissionDenied("Only the host can run this room's timer.")
        serializer = TimerActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        apply_timer_action(room, serializer.validated_data['action'])
        state = timer_state(room)
        broadcast(room, {'type': 'timer', 'timer': state})
        return Response(state)

    @extend_schema(responses=inline_serializer('PublicProfile', {'name': serializers.CharField()}))
    @action(detail=True, methods=['get'], url_path=r'people/(?P<key>[0-9a-f]{12})')
    def person(self, request, room_id=None, key=None):
        """A roommate's public card, limited by their privacy settings. Members only."""
        room = self.get_object()
        self.require_member(room)
        for membership in room.memberships.select_related('user__profile'):
            if member_key(room, membership.user_id) == key:
                return Response({**public_profile(membership.user), 'isHost': room.host_id == membership.user_id})
        raise NotFound('This student is not in the room.')

    @extend_schema(request=RoomReportSerializer, responses={201: RoomReportSerializer})
    @action(detail=True, methods=['post'])
    def report(self, request, room_id=None):
        """Sends a report to moderators. The host is never told who reported."""
        room = self.get_object()
        serializer = RoomReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = None
        if message_id := serializer.validated_data.pop('messageId', None):
            message = ChatMessage.objects.filter(id=message_id, room=room).first()
            if message is None:
                raise NotFound('That message is not in this room.')
        if RoomReport.objects.filter(room=room, reporter=request.user, status=RoomReport.Status.OPEN).exists():
            return Response(
                {'detail': 'You have already reported this room. Moderators will review it.'},
                status=status.HTTP_409_CONFLICT,
            )
        serializer.save(room=room, reporter=request.user, message=message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
