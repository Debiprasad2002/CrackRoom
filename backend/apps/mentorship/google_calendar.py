"""
Creates a Google Calendar event with a Meet link for each booking, from one CrackRoom Google
account, so students and mentors never have to give CrackRoom access to their own calendars.

Nothing here may break a booking. If Google is unavailable the booking still stands, the mentor's
own call link is used instead, and staff can retry the invite from admin.
"""

import logging
import time
from datetime import timedelta
from urllib.parse import quote

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

TOKEN_URL = 'https://oauth2.googleapis.com/token'
EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
TIMEOUT = 10
# Google creates the Meet link just after the event, so it can be missing from the first answer.
LINK_CHECKS = 3
LINK_CHECK_DELAY = 1

_token = {'value': '', 'expires': 0.0}


class CalendarError(Exception):
    pass


def is_configured() -> bool:
    return bool(settings.GOOGLE_CALENDAR_CLIENT_ID and settings.GOOGLE_CALENDAR_CLIENT_SECRET and settings.GOOGLE_CALENDAR_REFRESH_TOKEN)


def _access_token() -> str:
    if _token['value'] and time.time() < _token['expires']:
        return _token['value']
    response = requests.post(TOKEN_URL, timeout=TIMEOUT, data={
        'client_id': settings.GOOGLE_CALENDAR_CLIENT_ID,
        'client_secret': settings.GOOGLE_CALENDAR_CLIENT_SECRET,
        'refresh_token': settings.GOOGLE_CALENDAR_REFRESH_TOKEN,
        'grant_type': 'refresh_token',
    })
    if not response.ok:
        raise CalendarError(f'Google refused the calendar token ({response.status_code}).')
    data = response.json()
    _token.update(value=data['access_token'], expires=time.time() + data.get('expires_in', 3600) - 60)
    return _token['value']


def _call(method: str, url: str, **kwargs) -> requests.Response:
    return requests.request(method, url, timeout=TIMEOUT, headers={'Authorization': f'Bearer {_access_token()}'}, **kwargs)


def _event_id(booking) -> str:
    # Google allows only a-v and 0-9 here. A fixed id per booking means a retry cannot create a second event.
    return f'crackroombooking{booking.id}'


def _event_body(booking) -> dict:
    slot = booking.slot
    mentor = slot.mentor
    end = slot.starts_at + timedelta(minutes=slot.minutes)
    return {
        'id': _event_id(booking),
        'summary': f'CrackRoom mentorship: {booking.student.display_name} with {mentor.display_name}',
        'description': f'Topic: {booking.topic}\n\nManage this session in CrackRoom, under Mentorship.',
        'start': {'dateTime': slot.starts_at.isoformat(), 'timeZone': settings.TIME_ZONE},
        'end': {'dateTime': end.isoformat(), 'timeZone': settings.TIME_ZONE},
        'attendees': [{'email': booking.student.email}, {'email': mentor.user.email}],
        # Students are promised that their email stays private, so guests cannot see each other's address.
        'guestsCanSeeOtherGuests': False,
        'guestsCanInviteOthers': False,
        'guestsCanModify': False,
        'conferenceData': {
            'createRequest': {'requestId': _event_id(booking), 'conferenceSolutionKey': {'type': 'hangoutsMeet'}},
        },
    }


def _meet_link(event_url: str, event: dict) -> str:
    for attempt in range(LINK_CHECKS):
        if event.get('hangoutLink'):
            return event['hangoutLink']
        if attempt + 1 == LINK_CHECKS:
            break
        time.sleep(LINK_CHECK_DELAY)
        response = _call('GET', event_url)
        if not response.ok:
            break
        event = response.json()
    return ''


def _create_event(booking) -> tuple[str, str]:
    """Returns the event id and Meet link, picking up the existing event if this is a retry."""
    event_url = f'{EVENTS_URL}/{quote(_event_id(booking))}'
    response = _call('POST', EVENTS_URL, params={'conferenceDataVersion': 1, 'sendUpdates': 'all'}, json=_event_body(booking))
    if response.status_code == 409:
        response = _call('GET', event_url)
    if not response.ok:
        raise CalendarError(f'Google refused the calendar event ({response.status_code}).')
    event = response.json()
    return event['id'], _meet_link(event_url, event)


def send_invite(booking) -> bool:
    """Invites the student and mentor, and stores the Meet link. Returns whether the invite exists."""
    if not is_configured():
        return False
    try:
        event_id, link = _create_event(booking)
    except (CalendarError, requests.RequestException, KeyError, ValueError) as error:
        logger.error('Calendar invite failed for booking %s: %s', booking.id, error)
        return False
    booking.calendar_event_id = event_id
    booking.meet_url = link
    booking.save(update_fields=['calendar_event_id', 'meet_url'])
    return True


def cancel_invite(booking) -> None:
    """Cancels the event, and Google tells both people. A failure is logged and never blocks the cancellation."""
    if not booking.calendar_event_id or not is_configured():
        return
    try:
        response = _call('DELETE', f'{EVENTS_URL}/{quote(booking.calendar_event_id)}', params={'sendUpdates': 'all'})
        # 404 and 410 mean it is already gone, which is what we wanted.
        if not response.ok and response.status_code not in {404, 410}:
            raise CalendarError(f'Google refused to cancel the event ({response.status_code}).')
    except (CalendarError, requests.RequestException, KeyError, ValueError) as error:
        logger.error('Calendar cancellation failed for booking %s: %s', booking.id, error)
