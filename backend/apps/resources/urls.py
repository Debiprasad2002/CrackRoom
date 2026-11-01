from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ResourceFileView, ResourceViewSet

router = DefaultRouter()
router.include_root_view = False
router.register('resources', ResourceViewSet, basename='resource')

urlpatterns = [
    path('resources/<slug:resource_id>/file/', ResourceFileView.as_view(), name='resource-file'),
    *router.urls,
]
