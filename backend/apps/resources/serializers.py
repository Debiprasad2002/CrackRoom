from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers

from .models import Resource


class ResourceSerializer(serializers.ModelSerializer):
    """
    Mirrors the frontend `Resource` type. `fileUrl` is a same-site API path, not a storage
    URL: every open or download goes back through the authorised file endpoint.
    """

    id = serializers.CharField(source='slug')
    fileType = serializers.SerializerMethodField()
    publishedAt = serializers.SerializerMethodField()
    fileUrl = serializers.SerializerMethodField()

    class Meta:
        model = Resource
        fields = [
            'id', 'title', 'description', 'exam', 'level', 'subject', 'chapter', 'language',
            'fileType', 'pages', 'publishedAt', 'source', 'status', 'fileUrl',
        ]
        read_only_fields = fields

    def get_fileType(self, resource) -> str:
        return 'PDF'

    def get_publishedAt(self, resource) -> str | None:
        return timezone.localdate(resource.published_at).isoformat() if resource.published_at else None

    def get_fileUrl(self, resource) -> str | None:
        return reverse('resource-file', kwargs={'resource_id': resource.slug}) if resource.file else None
