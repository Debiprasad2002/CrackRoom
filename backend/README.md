# CrackRoom API

Django REST API and real-time server for CrackRoom. JSON field names match the frontend types in `src/types/index.ts`.

| Area | Choice |
|---|---|
| Framework | Django 5.2 LTS, Django REST Framework 3.16 |
| Real time | Django Channels 4 with WebSockets, served by Daphne (ASGI) |
| Auth | Sign in with Google (ID token verified with `google-auth`), then Django sessions (HttpOnly cookie) with CSRF tokens; signed one-minute tickets for sockets |
| Database | SQLite locally, Supabase Postgres in production |
| Files | Local disk locally, private Cloudflare R2 bucket in production |
| Docs | OpenAPI schema at `/api/schema/`, Swagger UI at `/api/docs/` (public in DEBUG, staff-only otherwise) |

## Run it locally

Python 3.11+.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env
python manage.py migrate
python manage.py seed_demo      # optional: sample rooms and notes
python manage.py createsuperuser
python manage.py runserver      # http://127.0.0.1:8000, HTTP and WebSockets
```

Then in the repo root, set `VITE_API_URL=/api` in `.env` and run `npm run dev`. Vite proxies `/api` and `/ws` to Django, so cookies are same-origin.

- Admin: http://127.0.0.1:8000/admin/
- API docs: http://127.0.0.1:8000/api/docs/
- Tests: `python manage.py test apps` (including the WebSocket flow)
- Sign-in needs `GOOGLE_CLIENT_ID` in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in the root `.env`, with `http://localhost:5173` and `http://localhost` listed as authorised JavaScript origins for that client in Google Cloud Console. `createsuperuser` accounts sign in to admin with a password.

`seed_demo` refuses to run unless `DJANGO_DEBUG=1`. Its rooms are hosted by "CrackRoom", not invented students. Each published note gets a one-page PDF that says it is a development placeholder.

## API

Every endpoint except health, CSRF, session, Google sign-in and logout requires a signed-in user.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health/` | Liveness and database check |
| GET | `/api/auth/csrf/` | Sets the `csrftoken` cookie |
| GET | `/api/auth/session/` | `{ user: { email, isStaff, profile } \| null }` |
| POST | `/api/auth/google/` | `{ credential }` (the Google ID token) → signs in; the first sign-in creates the account |
| POST | `/api/auth/logout/` | Ends the session |
| DELETE | `/api/auth/account/` | `{ confirm: "DELETE" }` → deletes the account and its data |
| GET / PUT / PATCH | `/api/profile/` | Own profile. `404` means onboarding is unfinished; `PUT` creates it |
| GET / POST | `/api/rooms/` | List (filters: `exam`, `level`, `subject`, `mode`, `visibility`, `q`) / host a room |
| GET / PATCH / DELETE | `/api/rooms/:id/` | Detail / host edits / host closes |
| POST | `/api/rooms/:id/join/` | `{ inviteCode }` for private rooms |
| POST | `/api/rooms/:id/leave/` | Leave; closes your open sockets for the room |
| POST | `/api/rooms/:id/invite-code/` | Host issues a new code |
| POST | `/api/rooms/:id/timer/` | `{ action: start \| pause \| resume \| skip \| reset }` for the shared timer |
| GET | `/api/rooms/:id/socket-ticket/` | `{ ticket, url, you }` for opening the live socket |
| GET | `/api/rooms/:id/people/:key/` | A roommate's public card, limited by their privacy settings |
| GET / POST | `/api/rooms/:id/messages/` | Chat history and sending; `?after=<last id>` for catch-up |
| POST | `/api/rooms/:id/report/` | `{ reason, details?, messageId? }` → moderation queue |
| GET | `/api/mentors/` | Active mentors (filters: `exam`, `subject`) with real counts and next open slot |
| GET | `/api/mentors/:id/` | Profile and bookable slots for the next 3 weeks |
| POST | `/api/mentorship/slots/:slotId/book/` | `{ topic }` → books a 1:1 session |
| GET | `/api/mentorship/bookings/` | Your sessions; the call link appears only on active bookings |
| POST | `/api/mentorship/bookings/:id/cancel/` | Cancel up to 2 hours before the start |
| GET / PATCH | `/api/mentorship/me/` | Mentors only: own profile, call link and schedule |
| POST | `/api/mentorship/me/slots/` | Mentors only: `{ startsAt: [...] }` publishes slots |
| DELETE | `/api/mentorship/me/slots/:slotId/` | Mentors only: removes a slot (cancelling any booking on it) |
| GET / POST | `/api/community/posts/` | Feed, newest first (`before=<id>` for the next page, `mine=1` for your own) / post `{ body }` |
| GET / DELETE | `/api/community/posts/:id/` | One post (notifications link here) / author or staff deletes it |
| POST | `/api/community/posts/:id/reshare/` | `{ body? }` reshares the original post, optionally with a comment |
| POST / DELETE | `/api/community/posts/:id/react/` | `{ kind: like \| fire \| idea }` sets your reaction; DELETE removes it |
| POST | `/api/community/posts/:id/report/` | `{ reason, details? }` → moderation queue |
| GET / POST | `/api/community/posts/:id/comments/` | A post's comments, oldest first / add `{ body }` (up to 500 characters) |
| DELETE | `/api/community/comments/:id/` | The commenter, the post's author or staff removes a comment |
| POST | `/api/community/comments/:id/report/` | `{ reason }` → moderation queue |
| GET | `/api/notifications/` | Your notifications, newest first, with the `unread` count (`before=<id>` for the next page) |
| POST | `/api/notifications/:id/read/` | Marks one as read |
| POST | `/api/notifications/read-all/` | Marks all as read |
| GET | `/api/resources/` | Published notes (filters: `exam`, `level`, `subject`, `chapter`, `language`, `q`) |
| GET | `/api/resources/:id/` | One published note |
| GET | `/api/resources/:id/file/` | Opens the PDF; `?download=1` saves it |
| GET / POST | `/api/focus-sessions/` | Own focus log (`?from=&to=` as yyyy-mm-dd) |
| DELETE | `/api/focus-sessions/:id/` | Remove a logged session |
| POST | `/api/focus-sessions/import/` | Bulk import; idempotent by `clientId` (the device outbox uses it too) |
| GET / POST / PATCH / DELETE | `/api/plans/`, `/api/plans/:id/` | Planner |
| POST | `/api/plans/import/` | Bulk import, idempotent by `clientId` |

Errors always include a readable `detail`. Validation errors also include field-level `errors`.

### Live rooms

`WS /ws/rooms/:id/?ticket=<ticket>`, for room members only. Messages are JSON:

- **Server → client:** `snapshot { people, timer }`, `presence { people }`, `timer { timer }`, `chat { message }`, `closed`, `pong`
- **Client → server:** `status { status: ready | focusing | break | paused }`, `ping` (every 25 s)

Chat and timer changes go through the REST endpoints, so they share the API's validation, permissions and rate limits; the server then pushes them to every open socket. The shared timer is stored as a cycle (an anchor time plus the room's focus and break lengths), and every client derives the current phase from it, so no background worker is needed.

**Timer control:** the host runs a hosted room's timer. In rooms run by CrackRoom (no host), any member can run it.

**Presence:** a student counts while a socket is open and pinging. Room listings report `participants` (students present right now) and `isLive` (the timer is running and someone is present).

**Focus time:** focus time a student spends in a room is logged to their history by the client, with an id derived from the block. Several tabs, or retries, therefore count once.

Close codes: `4401` ticket invalid or expired (the client fetches a new one), `4403` not a member, `4404` room closed.

## Rules enforced on the server

- Students only ever receive **published** notes. A note cannot be published without a PDF; a database constraint enforces this.
- Uploads must be real PDFs (magic bytes checked) and stay under the size limit. Storage paths are random.
- PDFs are reachable only through `/file/`, which checks the session. On R2 it redirects to a signed URL that expires after 5 minutes.
- Publishing, archiving and returning to draft need the `resources.publish_resource` permission. Give it to an editor group in admin.
- Private rooms list their metadata but keep chat, presence and sockets members-only. Only the host ever sees the invite code. Capacity caps private-room membership.
- Sockets need a signed ticket that expires after a minute, and an `Origin` from the configured frontend.
- Other students see your display name and avatar. Exam and class are always visible; subjects, target year and stats appear only if you allow them under Privacy. Email addresses and account ids are never sent to other students: rooms identify people by a per-room key.
- Focus sessions and plans are scoped to their owner. Another student's record returns `404`, not `403`.
- Community posts are text for now, up to 1,000 characters (20 an hour per student). Moderators hide posts or act on reports in admin under **Community**.
- Reports are anonymous to the host, limited to one open report per room per student, and reviewed in admin.
- Google sign-in tokens must be signed by Google, issued for this app's client ID, unexpired and carry a verified email. Accounts are matched by Google's permanent account id, so a changed Gmail address keeps the same CrackRoom account.
- Rate limits: auth endpoints 30/min per IP (generous, because hostels and coaching centres share IPs), chat 20/min, joins 30/hour, reports 10/hour.

## Onboarding a mentor

1. In admin, open **Mentorship → Mentors → Add** and enter their Gmail, name, headline, bio, exams, subjects, languages and session length. They do not need to have signed in first.
2. Tick **Verified** after checking their background and results. Unverified mentors are listed without the tick.
3. Publish their times, either from the **Slots** section of the same admin page or by the mentor under **Mentorship → Your mentor schedule**. To use that page, they sign in with the same Gmail and finish onboarding (choosing "Other" as their stage is fine).

### Calendar invites and Meet links

Each booking creates a Google Calendar event with its own Meet link, from one CrackRoom Google account, and Google emails the invite to the student and mentor. Cancelling a booking cancels the event. Guests cannot see each other's email address.

Setup, once:

1. Create a Gmail for CrackRoom. In the CrackRoom Google Cloud project, enable the **Google Calendar API** and create an OAuth client of type **Desktop app**.
2. Put its ID and secret in `backend/.env` as `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET`, then run `python manage.py connect_google_calendar` and sign in with the CrackRoom Gmail.
3. On Render, set `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` and the printed `GOOGLE_CALENDAR_REFRESH_TOKEN`.

A booking never depends on Google. If an invite fails, the mentor's backup call link is used, the failure is logged, and staff can use **Retry Google Calendar invite** on the Bookings page in admin.

Booking rules are enforced on the server:
- At most one active booking per slot, guaranteed by a database constraint.
- Students can hold 2 upcoming sessions, and one per mentor.
- Students must book at least 30 minutes ahead and can cancel up to 2 hours before.
- The call link is only sent to the booked student.

## Deploy for ₹0

| Part | Service | Free tier notes |
|---|---|---|
| Frontend | Vercel | Serves the site and proxies `/api/*` to Render. The Hobby plan is for non-commercial use; move to Pro once you charge money |
| API and sockets | Render web service | Sleeps after 15 idle minutes; waking takes about a minute. No shell, so the build creates the admin |
| Database | Supabase (Postgres only) | 500 MB; the project pauses after a week without activity |
| PDFs (optional) | Cloudflare R2 | 10 GB, no egress fees; may ask for a card to enable |
| Sign-in | Google Identity Services | Free |

1. **Supabase:** create a project in the Mumbai region with a letters-and-numbers database password. Copy the **Session pooler** connection string from Connect (Render's free tier has no IPv6), fill in the password, and add `?sslmode=require`.
2. **Vercel:** import the repo and deploy with no changes; `.env.production` and `vercel.json` already hold the settings. Note the site's address.
3. **Render:** New → Blueprint → select this repo. `render.yaml` creates `crackroom-api`. Fill in:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the string from step 1 |
   | `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://<your-app>.vercel.app` |
   | `DJANGO_SUPERUSER_EMAIL` | your email, for signing in to admin |
   | `DJANGO_SUPERUSER_PASSWORD` | a long password for admin |

   The build runs migrations, creates the admin, and adds the public starter rooms. If Render gives the service an address other than `crackroom-api.onrender.com`, update `vercel.json` and push.
4. **Google:** in Cloud Console, add `https://<your-app>.vercel.app` to the OAuth client's authorised JavaScript origins, and publish the consent screen so any Google account can sign in.
5. **Keep it awake (optional):** a free cron pinger such as cron-job.org can hit `https://crackroom-api.onrender.com/api/health/` every 10 minutes. That avoids cold starts and keeps Supabase from pausing.

**Notes PDFs:** Render's disk is wiped on every restart, so do not upload PDFs until R2 is set up. Create a private bucket and an R2 API token with *Object Read & Write* on that bucket, then add `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in Render's Environment tab.

Sockets connect straight to Render (`wss://<service>.onrender.com`), because Vercel rewrites cannot carry WebSockets. The ticket endpoint tells the browser where to connect. It uses `RENDER_EXTERNAL_HOSTNAME` automatically; override it with `DJANGO_WEBSOCKET_PUBLIC_URL` on a custom domain.

The in-memory channel layer requires exactly one server process, which is what the free plan runs. Before scaling out, set `REDIS_URL` (Upstash has a free tier).

Admin is served from the Render URL itself: `https://crackroom-api.onrender.com/admin/`.

## Not built yet

- **Video and voice:** embedding `meet.jit.si` is limited to short demo calls; production use needs Jitsi as a Service (8x8 JaaS has a free tier) or a self-hosted Jitsi.
- **Blocking users:** reports and moderation exist; per-user blocking does not.
- **Installable app (PWA):** a manifest and service worker would let students install CrackRoom without app-store fees.
