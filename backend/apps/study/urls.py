from rest_framework.routers import DefaultRouter

from .views import FocusSessionViewSet, PlannedSessionViewSet

router = DefaultRouter()
router.include_root_view = False
router.register('focus-sessions', FocusSessionViewSet, basename='focus-session')
router.register('plans', PlannedSessionViewSet, basename='plan')

urlpatterns = router.urls
