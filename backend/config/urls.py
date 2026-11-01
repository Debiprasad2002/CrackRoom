from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.common.views import health

admin.site.site_header = 'CrackRoom admin'
admin.site.site_title = 'CrackRoom admin'
admin.site.index_title = 'Content and moderation'

api_patterns = [
    path('health/', health, name='health'),
    path('', include('apps.accounts.urls')),
    path('', include('apps.rooms.urls')),
    path('', include('apps.resources.urls')),
    path('', include('apps.study.urls')),
    path('', include('apps.mentorship.urls')),
    path('', include('apps.community.urls')),
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(api_patterns)),
]
