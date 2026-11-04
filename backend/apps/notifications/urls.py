from django.urls import path

from . import views

urlpatterns = [
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/read-all/', views.NotificationReadAllView.as_view(), name='notifications-read-all'),
    path('notifications/<int:notification_id>/read/', views.NotificationReadView.as_view(), name='notification-read'),
]
