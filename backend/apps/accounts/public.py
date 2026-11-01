from datetime import timedelta

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone


def current_streak(days: set, today) -> int:
    """Consecutive days with a session, ending today (or yesterday while today is still open)."""
    cursor = today if today in days else today - timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def public_profile(user) -> dict:
    """What other students may see, decided by the student's own privacy settings."""
    profile = getattr(user, 'profile', None)
    if profile is None:
        return {'name': user.display_name, 'hue': None, 'avatar': '', 'exam': None, 'level': None, 'targetYear': None, 'subjects': None, 'stats': None}
    privacy = profile.privacy or {}
    data = {
        'name': profile.display_name,
        'hue': profile.avatar_hue,
        'avatar': profile.avatar,
        'exam': profile.exam,
        'level': profile.level,
        'targetYear': profile.target_year if privacy.get('showTargetYear') else None,
        'subjects': profile.subjects if privacy.get('showSubjects') else None,
        'stats': None,
    }
    if privacy.get('showStats'):
        sessions = user.focus_sessions.all()
        totals = sessions.aggregate(minutes=Sum('minutes'), count=Count('id'))
        days = set(
            sessions.annotate(day=TruncDate('completed_at', tzinfo=timezone.get_current_timezone()))
            .values_list('day', flat=True)
            .distinct()
        )
        data['stats'] = {
            'streak': current_streak(days, timezone.localdate()),
            'minutes': totals['minutes'] or 0,
            'sessions': totals['count'],
        }
    return data
