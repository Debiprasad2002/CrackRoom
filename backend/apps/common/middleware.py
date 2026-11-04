from django.db import connection
from django.http import JsonResponse

HEALTH_PATH = '/api/health/'


class HealthCheckMiddleware:
    """
    Answers the health check before anything can reject the request. Hosting platforms and
    uptime pingers may call with an internal Host header or over plain HTTP, and a brief
    database outage should not get the web process restarted, so this always returns 200
    and reports the database separately. The query also counts as database activity, which
    keeps a free Supabase project from pausing.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path != HEALTH_PATH:
            return self.get_response(request)
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
            database = 'ok'
        except Exception:
            database = 'unavailable'
        return JsonResponse({'status': 'ok', 'database': database})
