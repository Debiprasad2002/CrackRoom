from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.include_root_view = False
router.register('mentors', views.MentorViewSet, basename='mentor')

urlpatterns = [
    path('mentorship/slots/<int:slot_id>/book/', views.BookSlotView.as_view(), name='mentorship-book'),
    path('mentorship/bookings/', views.MyBookingsView.as_view(), name='mentorship-bookings'),
    path('mentorship/bookings/<int:booking_id>/cancel/', views.CancelBookingView.as_view(), name='mentorship-cancel'),
    path('mentorship/me/', views.MentorSelfView.as_view(), name='mentorship-me'),
    path('mentorship/me/slots/', views.MentorSlotsView.as_view(), name='mentorship-my-slots'),
    path('mentorship/me/slots/<int:slot_id>/', views.MentorSlotDetailView.as_view(), name='mentorship-my-slot'),
    *router.urls,
]
