from django.core.files.storage import FileSystemStorage
from django.db.models import Q
from django.http import FileResponse, HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.utils.text import slugify
from django.views.decorators.clickjacking import xframe_options_sameorigin
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import NotFound
from rest_framework.views import APIView

from .models import Resource
from .serializers import ResourceSerializer

FILTER_PARAMS = [
    OpenApiParameter('exam', description='JEE or NEET; resources for both exams are included.'),
    OpenApiParameter('level', description='Class or stage; all-class resources are included.'),
    OpenApiParameter('subject'),
    OpenApiParameter('chapter'),
    OpenApiParameter('language'),
    OpenApiParameter('q', description='Search title, description and chapter.'),
]


def published_resources():
    """The only queryset students can ever reach. Drafts and archived notes never leave the server."""
    return Resource.objects.filter(status=Resource.Status.PUBLISHED)


class ResourceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ResourceSerializer
    lookup_field = 'slug'
    lookup_url_kwarg = 'resource_id'
    pagination_class = None

    def get_queryset(self):
        queryset = published_resources()
        if self.action != 'list':
            return queryset
        params = self.request.query_params
        if exam := params.get('exam'):
            queryset = queryset.filter(exam__in=[exam, 'both'])
        if level := params.get('level'):
            queryset = queryset.filter(level__in=[level, 'all'])
        for field in ('subject', 'chapter', 'language'):
            if value := params.get(field):
                queryset = queryset.filter(**{field: value})
        if q := params.get('q', '').strip():
            queryset = queryset.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(chapter__icontains=q))
        return queryset

    @extend_schema(parameters=FILTER_PARAMS)
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


@method_decorator(xframe_options_sameorigin, name='dispatch')
class ResourceFileView(APIView):
    """
    Opens a published PDF for a signed-in student. Local storage streams the file; R2
    answers with a redirect to a signed URL that expires within minutes.
    Add `?download=1` to save instead of view.
    """

    @extend_schema(
        parameters=[OpenApiParameter('download', bool)],
        responses={(200, 'application/pdf'): bytes, 302: None},
    )
    def get(self, request, resource_id):
        resource = published_resources().filter(slug=resource_id).exclude(file='').first()
        if resource is None:
            raise NotFound('This file is not available.')
        download = request.query_params.get('download') in {'1', 'true'}
        filename = f'{slugify(resource.title) or "notes"}.pdf'
        disposition = f'{"attachment" if download else "inline"}; filename="{filename}"'
        storage = resource.file.storage

        if isinstance(storage, FileSystemStorage):
            response = FileResponse(resource.file.open('rb'), content_type='application/pdf')
            response['Content-Disposition'] = disposition
        else:
            url = storage.url(
                resource.file.name,
                parameters={'ResponseContentDisposition': disposition, 'ResponseContentType': 'application/pdf'},
            )
            response = HttpResponseRedirect(url)
        response['Cache-Control'] = 'private, no-store'
        return response
