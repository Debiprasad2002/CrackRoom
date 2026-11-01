"""Sign in with Google: verify the ID token the browser received and map it to a user."""

from django.conf import settings
from django.db import transaction
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from .models import User

GOOGLE_ISSUERS = {'accounts.google.com', 'https://accounts.google.com'}

# Reuses one HTTP session, which also caches Google's public signing keys.
_transport = google_requests.Request()


class GoogleSignInError(Exception):
    pass


def verify_credential(credential: str) -> dict:
    """
    Checks the token's signature against Google's keys, that it was issued for this app's
    client ID, by Google, is unexpired, and carries a verified email. Returns its claims.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleSignInError('Google sign-in is not configured on the server.')
    try:
        claims = id_token.verify_oauth2_token(credential, _transport, settings.GOOGLE_CLIENT_ID, clock_skew_in_seconds=10)
    except ValueError:
        raise GoogleSignInError('Google could not confirm this sign-in. Please try again.')
    if claims.get('iss') not in GOOGLE_ISSUERS:
        raise GoogleSignInError('Google could not confirm this sign-in. Please try again.')
    if not claims.get('email') or not claims.get('email_verified'):
        raise GoogleSignInError('Your Google account needs a verified email address.')
    return claims


@transaction.atomic
def user_for_claims(claims: dict) -> User:
    """
    Finds the student by their permanent Google id. A first sign-in links to an existing
    account with the same email (Google has verified it), or creates a new account.
    """
    sub = claims['sub']
    email = claims['email'].lower()
    user = User.objects.select_for_update().filter(google_sub=sub).first()
    if user is None:
        user = User.objects.select_for_update().filter(email__iexact=email, google_sub__isnull=True).first()
        if user is None:
            user = User(email=email)
            user.set_unusable_password()
        user.google_sub = sub
        user.save()
    elif user.email != email:
        # The student changed their Google address; keep ours in step if it is free.
        if not User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            user.email = email
            user.save(update_fields=['email'])
    return user
