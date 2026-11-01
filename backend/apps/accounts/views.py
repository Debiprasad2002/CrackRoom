from django.contrib.auth import login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .google import GoogleSignInError, user_for_claims, verify_credential
from .models import Profile
from .serializers import AccountDeleteSerializer, GoogleSignInSerializer, ProfileSerializer, SessionSerializer

SessionResponse = inline_serializer('SessionResponse', {'user': SessionSerializer(allow_null=True)})


def session_payload(request):
    user = request.user
    return {'user': SessionSerializer(user).data if user.is_authenticated else None}


def enforce_csrf(request):
    # DRF only checks CSRF for already-authenticated sessions. Sign-in is anonymous,
    # so check explicitly to block login CSRF.
    SessionAuthentication().enforce_csrf(request)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    """Sets the `csrftoken` cookie. Call once before the first unsafe request."""

    permission_classes = [AllowAny]
    throttle_classes = []  # Cheap, read-only, and needed before anything else works.

    @extend_schema(responses={204: None})
    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class SessionView(APIView):
    """Current session. Returns `user: null` rather than an error when signed out."""

    permission_classes = [AllowAny]
    # Every app start calls this; a rate limit here would lock students out of the whole app.
    throttle_classes = []

    @extend_schema(responses=SessionResponse)
    def get(self, request):
        return Response(session_payload(request))


class GoogleSignInView(APIView):
    """
    Signs in with the ID token from "Sign in with Google". The first sign-in creates the
    account; onboarding then creates the profile.
    """

    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    @extend_schema(request=GoogleSignInSerializer, responses=SessionResponse)
    def post(self, request):
        enforce_csrf(request)
        serializer = GoogleSignInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            claims = verify_credential(serializer.validated_data['credential'])
        except GoogleSignInError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        user = user_for_claims(claims)
        if not user.is_active:
            return Response({'detail': 'This account has been suspended.'}, status=status.HTTP_403_FORBIDDEN)
        login(request._request, user, backend='django.contrib.auth.backends.ModelBackend')
        request.user = user  # DRF caches the anonymous user from before login().
        return Response(session_payload(request))


class LogoutView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        enforce_csrf(request)
        logout(request._request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AccountView(APIView):
    throttle_scope = 'auth'

    @extend_schema(request=AccountDeleteSerializer, responses={204: None})
    def delete(self, request):
        """Permanently deletes the account and everything it owns. Send `{"confirm": "DELETE"}`."""
        serializer = AccountDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        logout(request._request)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileView(APIView):
    """The signed-in student's own profile. PUT creates it at the end of onboarding."""

    permission_classes = [IsAuthenticated]

    def get_object(self):
        return Profile.objects.filter(user=self.request.user).first()

    @extend_schema(responses=ProfileSerializer)
    def get(self, request):
        profile = self.get_object()
        if profile is None:
            return Response({'detail': 'Onboarding is not finished yet.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProfileSerializer(profile).data)

    @extend_schema(request=ProfileSerializer, responses=ProfileSerializer)
    def put(self, request):
        profile = self.get_object()
        serializer = ProfileSerializer(profile, data=request.data)
        serializer.is_valid(raise_exception=True)
        created = profile is None
        serializer.save(**({'user': request.user} if created else {}))
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @extend_schema(request=ProfileSerializer, responses=ProfileSerializer)
    def patch(self, request):
        profile = self.get_object()
        if profile is None:
            return Response({'detail': 'Onboarding is not finished yet.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
