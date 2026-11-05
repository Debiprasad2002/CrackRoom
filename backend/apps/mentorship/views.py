from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification
from apps.notifications.services import notify

from . import google_calendar
from .models import Booking, Mentor, Slot
from .rules import (
    BOOKING_LEAD,
    MAX_UPCOMING_PER_STUDENT,
    SLOT_HORIZON,
    annotated_mentors,
    clean_exams,
    clean_subjects,
    open_slots,
    overlaps,
    student_can_cancel,
)
from .serializers import (
    BookingSerializer,
    BookSerializer,
    CreateSlotsSerializer,
    MentorCardSerializer,
    MentorDetailSerializer,
    MentorSelfSerializer,
    MentorSlotSerializer,
)


class MentorViewSet(viewsets.ReadOnlyModelViewSet):
    """Verified and active mentors. Filters: `exam`, `subject`."""

    lookup_field = 'slug'
    lookup_url_kwarg = 'mentor_id'
    pagination_class = None
    serializer_class = MentorCardSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Mentor.objects.none()
        return annotated_mentors().order_by('-is_verified', 'display_name')

    @extend_schema(parameters=[OpenApiParameter('exam'), OpenApiParameter('subject')])
    def list(self, request, *args, **kwargs):
        mentors = list(self.get_queryset())
        exam, subject = request.query_params.get('exam'), request.query_params.get('subject')
        # Lists are tiny JSON arrays; filtering here works the same on SQLite and Postgres.
        if exam:
            mentors = [m for m in mentors if exam in clean_exams(m.exams)]
        if subject:
            mentors = [m for m in mentors if subject in clean_subjects(m.subjects)]
        return Response(MentorCardSerializer(mentors, many=True).data)

    @extend_schema(responses=MentorDetailSerializer)
    def retrieve(self, request, *args, **kwargs):
        mentor = self.get_object()
        slots = open_slots().filter(mentor=mentor).order_by('starts_at')
        return Response(MentorDetailSerializer(mentor, context={'slots': slots}).data)


class BookSlotView(APIView):
    throttle_scope = 'booking'

    @extend_schema(request=BookSerializer, responses={201: BookingSerializer})
    def post(self, request, slot_id):
        serializer = BookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not hasattr(user, 'profile'):
            raise PermissionDenied('Finish onboarding before booking a mentor.')
        now = timezone.now()
        try:
            with transaction.atomic():
                # Lock the slot so two students pressing "Book" together cannot both win.
                slot = Slot.objects.select_for_update().select_related('mentor').filter(pk=slot_id).first()
                if slot is None or slot.is_cancelled or not slot.mentor.is_active:
                    raise NotFound('This slot is no longer available.')
                if slot.mentor.user_id == user.id:
                    raise ValidationError({'detail': 'You cannot book your own slot.'})
                if slot.starts_at < now + BOOKING_LEAD:
                    raise ValidationError({'detail': 'This slot starts too soon to book. Pick a later time.'})
                if slot.bookings.filter(status=Booking.Status.BOOKED).exists():
                    raise ValidationError({'detail': 'Someone just booked this slot. Pick another time.'})
                upcoming = Booking.objects.filter(student=user, status=Booking.Status.BOOKED, slot__starts_at__gte=now)
                if upcoming.count() >= MAX_UPCOMING_PER_STUDENT:
                    raise ValidationError(
                        {'detail': f'You can hold {MAX_UPCOMING_PER_STUDENT} upcoming sessions at a time. Finish or cancel one first.'}
                    )
                if upcoming.filter(slot__mentor=slot.mentor).exists():
                    raise ValidationError({'detail': 'You already have an upcoming session with this mentor.'})
                booking = Booking.objects.create(slot=slot, student=user, topic=serializer.validated_data['topic'])
                notify(Notification.Kind.BOOKING, user, slot.mentor.user_id, booking=booking)
        except IntegrityError:
            raise ValidationError({'detail': 'Someone just booked this slot. Pick another time.'})
        # Outside the transaction: a slow or failing Google must not hold the slot lock or undo the booking.
        google_calendar.send_invite(booking)
        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


class MyBookingsView(APIView):
    """The student's sessions, soonest first: upcoming, then the most recent past ones."""

    @extend_schema(responses=BookingSerializer(many=True))
    def get(self, request):
        bookings = (
            Booking.objects.filter(student=request.user)
            .select_related('slot__mentor')
            .order_by('slot__starts_at')
        )
        return Response(BookingSerializer(bookings, many=True).data)


class CancelBookingView(APIView):
    @extend_schema(request=None, responses=BookingSerializer)
    def post(self, request, booking_id):
        booking = Booking.objects.select_related('slot__mentor').filter(pk=booking_id, student=request.user).first()
        if booking is None:
            raise NotFound('Booking not found.')
        if not student_can_cancel(booking):
            raise ValidationError({'detail': 'Sessions can be cancelled up to 2 hours before they start.'})
        booking.status = Booking.Status.CANCELLED
        booking.cancelled_by = Booking.CancelledBy.STUDENT
        booking.cancelled_at = timezone.now()
        with transaction.atomic():
            booking.save(update_fields=['status', 'cancelled_by', 'cancelled_at'])
            notify(Notification.Kind.CANCEL, request.user, booking.slot.mentor.user_id, booking=booking)
        google_calendar.cancel_invite(booking)
        return Response(BookingSerializer(booking).data)


def mentor_for(request) -> Mentor:
    mentor = getattr(request.user, 'mentor_profile', None)
    if mentor is None:
        raise PermissionDenied('Only mentors can do this.')
    return mentor


def mentor_slots(mentor):
    active = Prefetch('bookings', queryset=Booking.objects.select_related('student__profile'))
    since = timezone.now() - timedelta(hours=2)
    return mentor.slots.filter(is_cancelled=False, starts_at__gte=since).prefetch_related(active).order_by('starts_at')


class MentorSelfView(APIView):
    """A mentor's own profile and schedule."""

    @extend_schema(responses=MentorSelfSerializer)
    def get(self, request):
        mentor = mentor_for(request)
        return Response({**MentorSelfSerializer(mentor).data, 'slots': MentorSlotSerializer(mentor_slots(mentor), many=True).data})

    @extend_schema(request=MentorSelfSerializer, responses=MentorSelfSerializer)
    def patch(self, request):
        mentor = mentor_for(request)
        serializer = MentorSelfSerializer(mentor, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MentorSlotsView(APIView):
    throttle_scope = 'booking'

    @extend_schema(request=CreateSlotsSerializer, responses={201: MentorSlotSerializer(many=True)})
    def post(self, request):
        """Publishes one or more start times at the mentor's session length."""
        mentor = mentor_for(request)
        serializer = CreateSlotsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        starts = sorted(set(serializer.validated_data['startsAt']))
        for start in starts:
            if start < now + BOOKING_LEAD:
                raise ValidationError({'detail': 'Slots must start at least 30 minutes from now.'})
            if start > now + SLOT_HORIZON:
                raise ValidationError({'detail': 'Slots can be published up to 60 days ahead.'})
        for earlier, later in zip(starts, starts[1:]):
            if later < earlier + timedelta(minutes=mentor.session_minutes):
                raise ValidationError({'detail': 'Two of these times overlap.'})
        with transaction.atomic():
            created = []
            for start in starts:
                if overlaps(mentor, start, mentor.session_minutes):
                    raise ValidationError({'detail': f'{timezone.localtime(start):%d %b, %I:%M %p} overlaps a slot you already have.'})
                created.append(Slot.objects.create(mentor=mentor, starts_at=start, minutes=mentor.session_minutes))
        return Response(MentorSlotSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


class MentorSlotDetailView(APIView):
    @extend_schema(request=None, responses={204: None})
    def delete(self, request, slot_id):
        """Removes a slot. A booked slot is cancelled for the student too."""
        mentor = mentor_for(request)
        slot = mentor.slots.filter(pk=slot_id, is_cancelled=False).first()
        if slot is None:
            raise NotFound('Slot not found.')
        if slot.starts_at <= timezone.now():
            raise ValidationError({'detail': 'This session has already started.'})
        active = list(slot.bookings.filter(status=Booking.Status.BOOKED))
        with transaction.atomic():
            slot.bookings.filter(status=Booking.Status.BOOKED).update(
                status=Booking.Status.CANCELLED, cancelled_by=Booking.CancelledBy.MENTOR, cancelled_at=timezone.now()
            )
            slot.is_cancelled = True
            slot.save(update_fields=['is_cancelled'])
            for booking in active:
                notify(Notification.Kind.CANCEL, request.user, booking.student_id, booking=booking)
        for booking in active:
            google_calendar.cancel_invite(booking)
        return Response(status=status.HTTP_204_NO_CONTENT)
