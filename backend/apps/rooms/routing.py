from django.urls import path

from .consumers import RoomConsumer

websocket_urlpatterns = [
    path('ws/rooms/<slug:room_id>/', RoomConsumer.as_asgi()),
]
