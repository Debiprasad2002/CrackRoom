"""
CrackRoom API settings.

Everything deployment-specific comes from environment variables (see .env.example).
With no variables set, the project runs locally on SQLite and local file storage.
"""

import os
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {'1', 'true', 'yes', 'on'}


def env_list(name: str, default: str = '') -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(',') if item.strip()]


DEBUG = env_bool('DJANGO_DEBUG', False)

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is off.')
    SECRET_KEY = 'insecure-local-development-key-only'

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
# Render sets this for the service's own hostname.
if render_host := os.environ.get('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(render_host)

# The frontend reaches the API through a same-site proxy (Vite in development,
# Vercel rewrites in production), so the browser treats session cookies as first-party.
# The proxy's public origin must be trusted for CSRF checks on unsafe requests.
CSRF_TRUSTED_ORIGINS = env_list('DJANGO_CSRF_TRUSTED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')

INSTALLED_APPS = [
    'daphne',  # ASGI runserver with WebSocket support; must come before staticfiles.
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    'rest_framework',
    'drf_spectacular',
    'apps.common',
    'apps.accounts',
    'apps.rooms',
    'apps.resources',
    'apps.study',
    'apps.mentorship',
    'apps.community',
    'apps.notifications',
]

MIDDLEWARE = [
    'apps.common.middleware.HealthCheckMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# Database: SQLite locally, Supabase Postgres (or any Postgres) through DATABASE_URL.
# An empty DATABASE_URL (as copied from .env.example) also means SQLite.
DATABASES = {
    'default': dj_database_url.parse(
        os.environ.get('DATABASE_URL') or f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        # Persistent connections do not suit ASGI; Supabase's pooler keeps connects cheap.
        conn_max_age=int(os.environ.get('DATABASE_CONN_MAX_AGE', '0')),
        conn_health_checks=True,
    )
}

# --- Real-time rooms -------------------------------------------------------------------
# One server process can use the in-memory layer. Set REDIS_URL (e.g. Upstash free tier)
# before running more than one process.
if redis_url := os.environ.get('REDIS_URL'):
    CHANNEL_LAYERS = {
        'default': {'BACKEND': 'channels_redis.core.RedisChannelLayer', 'CONFIG': {'hosts': [redis_url]}}
    }
else:
    CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}

# Sockets can be opened from the frontend's origins and from the API's own hosts.
WEBSOCKET_ALLOWED_ORIGINS = CSRF_TRUSTED_ORIGINS + ALLOWED_HOSTS

# Where browsers open sockets. Vercel rewrites cannot carry WebSockets, so in production
# the frontend connects straight to Render. Empty means "same origin as the page".
WEBSOCKET_PUBLIC_URL = os.environ.get('DJANGO_WEBSOCKET_PUBLIC_URL', '')
if not WEBSOCKET_PUBLIC_URL and render_host:
    WEBSOCKET_PUBLIC_URL = f'wss://{render_host}'

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

if 'test' in sys.argv:
    # Real hashers are deliberately slow; tests only need passwords to round-trip.
    PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
    # Rate limits count in the cache; a dummy cache keeps tests independent of each other.
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}}

LANGUAGE_CODE = 'en-in'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- File storage -----------------------------------------------------------------
# Notes PDFs are private. Locally they live in MEDIA_ROOT and are streamed by an
# authorised view. With R2 configured they live in a private bucket and the same view
# redirects to a short-lived signed URL.
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/media/'  # Never routed: files are only reachable through the API.

R2_BUCKET = os.environ.get('R2_BUCKET', '')
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
if R2_BUCKET:
    STORAGES['default'] = {
        'BACKEND': 'storages.backends.s3.S3Storage',
        'OPTIONS': {
            'bucket_name': R2_BUCKET,
            'endpoint_url': f'https://{os.environ["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com',
            'access_key': os.environ['R2_ACCESS_KEY_ID'],
            'secret_key': os.environ['R2_SECRET_ACCESS_KEY'],
            'region_name': 'auto',
            'signature_version': 's3v4',
            'default_acl': None,
            'querystring_auth': True,
            'querystring_expire': int(os.environ.get('R2_SIGNED_URL_SECONDS', '300')),
            'file_overwrite': False,
        },
    }

RESOURCE_MAX_UPLOAD_MB = int(os.environ.get('RESOURCE_MAX_UPLOAD_MB', '25'))

# --- Sign in with Google -------------------------------------------------------------
# The OAuth client ID is public (it is also in the frontend); there is no client secret here.
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')

# Calendar invites and Meet links for mentorship, sent from one CrackRoom Google account.
# Without these, bookings still work and use the mentor's own call link.
GOOGLE_CALENDAR_CLIENT_ID = os.environ.get('GOOGLE_CALENDAR_CLIENT_ID', '')
GOOGLE_CALENDAR_CLIENT_SECRET = os.environ.get('GOOGLE_CALENDAR_CLIENT_SECRET', '')
# Tests must never send real invites.
GOOGLE_CALENDAR_REFRESH_TOKEN = '' if 'test' in sys.argv else os.environ.get('GOOGLE_CALENDAR_REFRESH_TOKEN', '')

# --- Sessions, cookies and security ------------------------------------------------
SESSION_COOKIE_AGE = int(timedelta(days=30).total_seconds())
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
# The SPA reads the CSRF cookie and echoes it in the X-CSRFToken header.
CSRF_COOKIE_HTTPONLY = False

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = env_bool('DJANGO_SECURE_SSL_REDIRECT', True)
    SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_HSTS_SECONDS', '0'))
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'same-origin'

# --- Django REST framework ------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.SessionAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser'],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/min',
        'user': '240/min',
        # Per IP: generous, because many students can share one network.
        'auth': '30/min',
        'chat': '20/min',
        'join': '30/hour',
        'report': '10/hour',
        'booking': '30/hour',
        'community_post': '20/hour',
        'community_comment': '60/hour',
    },
    'EXCEPTION_HANDLER': 'apps.common.exceptions.exception_handler',
}
if DEBUG:
    REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'].append('rest_framework.renderers.BrowsableAPIRenderer')

SPECTACULAR_SETTINGS = {
    'TITLE': 'CrackRoom API',
    'DESCRIPTION': 'REST API for the CrackRoom study campus.',
    'VERSION': '0.1.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'ENUM_NAME_OVERRIDES': {
        'ExamEnum': 'apps.common.choices.Exam',
        'ExamScopeEnum': 'apps.common.choices.ExamScope',
        'LevelEnum': 'apps.common.choices.Level',
        'LevelScopeEnum': 'apps.common.choices.LevelScope',
        'SubjectEnum': 'apps.common.choices.Subject',
        'RoomSubjectEnum': 'apps.common.choices.RoomSubject',
        'LanguageEnum': 'apps.common.choices.Language',
    },
    'SERVE_PERMISSIONS': ['rest_framework.permissions.AllowAny'] if DEBUG else ['rest_framework.permissions.IsAdminUser'],
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': os.environ.get('DJANGO_LOG_LEVEL', 'INFO')},
}
