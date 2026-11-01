from django.urls import path

from . import views

urlpatterns = [
    path('auth/csrf/', views.CsrfView.as_view(), name='auth-csrf'),
    path('auth/session/', views.SessionView.as_view(), name='auth-session'),
    path('auth/google/', views.GoogleSignInView.as_view(), name='auth-google'),
    path('auth/logout/', views.LogoutView.as_view(), name='auth-logout'),
    path('auth/account/', views.AccountView.as_view(), name='auth-account'),
    path('profile/', views.ProfileView.as_view(), name='profile'),
]
