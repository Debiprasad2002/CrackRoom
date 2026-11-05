import http.server
import secrets
import urllib.parse
import webbrowser

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
SCOPE = 'https://www.googleapis.com/auth/calendar.events'
PORT = 8765
REDIRECT_URI = f'http://localhost:{PORT}/'


class Command(BaseCommand):
    help = 'Signs in to the CrackRoom Google account once and prints the refresh token to put on the server.'

    def handle(self, *args, **options):
        client_id, client_secret = settings.GOOGLE_CALENDAR_CLIENT_ID, settings.GOOGLE_CALENDAR_CLIENT_SECRET
        if not client_id or not client_secret:
            raise CommandError('Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in backend/.env first.')

        state = secrets.token_urlsafe(24)
        url = AUTH_URL + '?' + urllib.parse.urlencode({
            'client_id': client_id,
            'redirect_uri': REDIRECT_URI,
            'response_type': 'code',
            'scope': SCOPE,
            'access_type': 'offline',
            # Google only returns a refresh token when it asks for consent again.
            'prompt': 'consent',
            'state': state,
        })
        self.stdout.write('\nSign in with the CrackRoom Gmail, not your personal one.')
        self.stdout.write(f'If no browser opens, visit:\n{url}\n')
        webbrowser.open(url)

        params = self._wait_for_google()
        if params.get('state') != state:
            raise CommandError('The answer did not match this request. Please run the command again.')
        if 'code' not in params:
            raise CommandError(f'Google did not give access: {params.get("error", "unknown error")}.')

        response = requests.post(TOKEN_URL, timeout=15, data={
            'client_id': client_id,
            'client_secret': client_secret,
            'code': params['code'],
            'grant_type': 'authorization_code',
            'redirect_uri': REDIRECT_URI,
        })
        token = response.json().get('refresh_token') if response.ok else None
        if not token:
            raise CommandError(f'Google did not return a refresh token ({response.status_code}).')

        self.stdout.write(self.style.SUCCESS('\nConnected. Copy this value into GOOGLE_CALENDAR_REFRESH_TOKEN on Render:'))
        self.stdout.write(f'\n{token}\n')
        self.stdout.write('Treat it like a password: it goes only into Render, never into chat or Git.')

    def _wait_for_google(self) -> dict:
        received = {}

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                received.update(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'CrackRoom is connected. You can close this tab and go back to the terminal.')

            def log_message(self, *args):
                pass

        with http.server.HTTPServer(('localhost', PORT), Handler) as server:
            server.handle_request()
        return received
