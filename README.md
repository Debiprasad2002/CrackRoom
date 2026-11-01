# CrackRoom

**Study together. Crack it together.**

CrackRoom is a virtual study campus for JEE and NEET aspirants: live study rooms, a curated notes library, a focus timer, a study planner and progress tracking.

> **Two modes.** With `VITE_API_URL` set, CrackRoom runs on the Django server in [`backend/`](backend/README.md). That mode adds accounts, synced profiles, focus history and plans, live rooms with presence, a shared timer and chat, hosting and invite codes, reports, the notes library with protected PDFs, and sign-in with Google. Without it, the app runs as a device-only prototype on bundled sample data and says so wherever it matters.

## Tech stack

| Area | Choice |
|---|---|
| UI | React 18 + TypeScript (strict) |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 with design tokens in `tailwind.config.js` |
| Routing | React Router 6 (lazy-loaded pages) |
| Icons | Lucide |
| Motion | Motion (`motion/react`), honours `prefers-reduced-motion` |
| Fonts | Inter Variable (UI), Bricolage Grotesque Variable (headings), bundled locally |

Versions are pinned to run on **Node 18.17+**.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # strict TypeScript check
npm run build      # production build into dist/
npm run preview    # serve the production build
```

## Project structure

```
src/
  components/
    brand/        Logo and mark
    ui/           Button, Field, Dialog, Badge, Avatar, Toast, Choice, Feedback, Layout, ProgressRing
  data/           Catalogue (exams, subjects, chapters) and sample rooms/resources
  features/
    focus/        Timer engine (FocusContext), timer panel, header pill
    planner/      Planned sessions store
    profile/      Profile store and profile card
    progress/     Week chart, consistency grid, achievements
    rooms/        Room card, chat, report dialog, relevance ranking
    notes/        Resource card and row
  hooks/          useAsync, useNow
  layouts/        AppShell (sidebar, mobile top bar and tab bar)
  lib/            Dates, stats, storage, class helper
  pages/          One file per route
  services/       API boundary: roomsService, notesService, config, http
  types/          Shared data models
```

## Routes

| Path | Screen |
|---|---|
| `/signin` | Sign in with Google; the first sign-in creates the account (server mode only) |
| `/welcome` | Three-step onboarding (exam, level, target year, subjects, daily goal) |
| `/` | Home dashboard |
| `/rooms`, `/rooms/:roomId` | Room discovery (filters in the URL) and room view |
| `/notes`, `/notes/:resourceId` | Notes library and resource detail |
| `/planner` | Weekly study planner |
| `/progress` | Stats, weekly trend, consistency grid, achievements, history |
| `/focus` | Focus timer |
| `/profile` | Profile, preferences, privacy, local data |

## Connecting the Django backend

The API lives in [`backend/`](backend/README.md), with setup, endpoints and the ₹0 deployment guide.

1. Start Django (`python manage.py runserver` in `backend/`), then set `VITE_API_URL=/api` and `VITE_GOOGLE_CLIENT_ID=<your OAuth client ID>` in `.env` and run `npm run dev`.
2. Vite proxies `/api` and `/ws` to `http://127.0.0.1:8000`. In production, `vercel.json` proxies `/api`, and room sockets connect to Render directly. Session and CSRF cookies stay first-party, so no CORS is needed.
3. Everything goes through `src/services/`. The stores in `src/features/*/…Context.tsx` pick local storage or the server from `USING_SAMPLE_DATA`, so pages work the same in both modes.

**Server mode details:**

- Profile and planner changes apply instantly and roll back with an explanation if the server refuses them.
- Finished focus sessions go into a per-account outbox on the device, which syncs through an idempotent import. Going offline never loses a block.
- After sign-in, students are offered a one-time import of anything saved in the browser before they had an account.
- Live rooms (`src/features/rooms/live/`) use a WebSocket for presence and pushes. Chat falls back to polling while the socket is down.

All authorisation (publishing, admin, private-room access, timer control, downloads) is enforced on the server. The frontend only hides what it should not show.

## Design notes

- **Palette:** midnight navy surfaces (`ink-*`), electric violet brand accent, cyan for break and secondary states.
- **Subject colours** (`subj-*`) were checked as a categorical set for colour-vision deficiency and contrast on the card surface. Subjects are always labelled with text too, never by colour alone.
- **Accessibility:** every page has a skip link, visible focus rings, native `<dialog>` for modals, real radio and checkbox inputs behind the choice cards, labelled form errors, and screen-reader tables behind the charts.
