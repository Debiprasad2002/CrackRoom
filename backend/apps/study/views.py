from datetime import date

from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import FocusSession, PlannedSession
from .serializers import FocusSessionSerializer, PlannedSessionSerializer

MAX_IMPORT = 2000

ImportResult = inline_serializer('ImportResult', {'imported': serializers.IntegerField(), 'skipped': serializers.IntegerField()})
RANGE_PARAMS = [
    OpenApiParameter('from', date, description='First day to include (yyyy-mm-dd).'),
    OpenApiParameter('to', date, description='Last day to include (yyyy-mm-dd).'),
]


def parse_day(value, name):
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({name: ['Use the yyyy-mm-dd format.']})


class OwnedRecordsMixin:
    """Every record belongs to one student; nobody can read or change anyone else's."""

    model = None
    date_field = None
    pagination_class = None

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return self.model.objects.none()
        queryset = self.model.objects.filter(user=self.request.user)
        params = self.request.query_params
        if start := params.get('from'):
            queryset = queryset.filter(**{f'{self.date_field}__gte': parse_day(start, 'from')})
        if end := params.get('to'):
            queryset = queryset.filter(**{f'{self.date_field}__lte': parse_day(end, 'to')})
        return queryset

    @extend_schema(parameters=RANGE_PARAMS)
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # Retrying a request with the same clientId returns the stored record instead of a duplicate.
        client_id = request.data.get('clientId') if isinstance(request.data, dict) else None
        if client_id:
            existing = self.model.objects.filter(user=request.user, client_id=client_id).first()
            if existing:
                return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @extend_schema(responses=ImportResult)
    @action(detail=False, methods=['post'], url_path='import')
    def import_records(self, request):
        """
        Bulk upload of records kept on a device before the student had an account.
        Each item needs a `clientId`; items already imported are skipped, so this is safe to repeat.
        """
        if not isinstance(request.data, list):
            raise ValidationError({'detail': 'Send a JSON array of records.'})
        if len(request.data) > MAX_IMPORT:
            raise ValidationError({'detail': f'Import at most {MAX_IMPORT} records at a time.'})
        serializer = self.get_serializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)

        items = serializer.validated_data
        if any(not item.get('client_id') for item in items):
            raise ValidationError({'detail': 'Every imported record needs a clientId.'})
        known = set(
            self.model.objects.filter(user=request.user, client_id__in=[i['client_id'] for i in items])
            .values_list('client_id', flat=True)
        )
        fresh, seen = [], set()
        for item in items:
            if item['client_id'] in known or item['client_id'] in seen:
                continue
            seen.add(item['client_id'])
            fresh.append(self.model(user=request.user, **item))
        with transaction.atomic():
            self.model.objects.bulk_create(fresh)
        return Response({'imported': len(fresh), 'skipped': len(items) - len(fresh)}, status=status.HTTP_201_CREATED)


class FocusSessionViewSet(
    OwnedRecordsMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """The focus log. Sessions are not editable once recorded, but can be deleted."""

    model = FocusSession
    date_field = 'completed_at__date'
    serializer_class = FocusSessionSerializer
    lookup_url_kwarg = 'session_id'

    def get_queryset(self):
        return super().get_queryset().select_related('room')


class PlannedSessionViewSet(OwnedRecordsMixin, viewsets.ModelViewSet):
    model = PlannedSession
    date_field = 'date'
    serializer_class = PlannedSessionSerializer
    lookup_url_kwarg = 'plan_id'
