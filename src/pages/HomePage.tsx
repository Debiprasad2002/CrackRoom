import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarPlus, CheckCircle2, Circle, DoorOpen, Flame, Pause, Play, Timer } from 'lucide-react';
import { SUBJECTS, levelLabel } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { dayKey, fmt, formatClock, formatMinutes, greeting } from '@/lib/date';
import { currentStreak, minutesByDay, weekSeries } from '@/lib/stats';
import { useAsync } from '@/hooks/useAsync';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { TrackCards } from '@/features/home/TrackCards';
import { useNow } from '@/hooks/useNow';
import { roomsService } from '@/services/roomsService';
import { notesService } from '@/services/notesService';
import { USING_SAMPLE_DATA } from '@/services/config';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/Layout';
import { EmptyState, ErrorState, PrototypeNote, Skeleton } from '@/components/ui/Feedback';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { remainingMs, useFocus } from '@/features/focus/FocusContext';
import { usePlanner } from '@/features/planner/PlannerContext';
import { RoomCard } from '@/features/rooms/RoomCard';
import { resourceRelevance, roomRelevance } from '@/features/rooms/roomMeta';
import { ResourceRow } from '@/features/notes/ResourceCard';
import { WeekChart } from '@/features/progress/WeekChart';

const LINES = [
  'Small, steady blocks beat heroic all-nighters.',
  'One chapter closed properly is worth three skimmed.',
  'Show up today. Consistency compounds.',
  'Hard problems are where the marks are hiding.',
  'Revise what you learned yesterday before starting something new.',
  'Protect your focus; the syllabus rewards it.',
  'You do not need a perfect day — just an honest one.',
];

function dailyLine() {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime();
  const day = Math.floor((Date.now() - start) / 86_400_000);
  return LINES[day % LINES.length];
}

export default function HomePage() {
  const { profile } = useRequiredProfile();
  const { sessions } = useFocus();
  const byDay = useMemo(() => minutesByDay(sessions), [sessions]);
  const todayMinutes = byDay.get(dayKey()) ?? 0;
  const streak = currentStreak(byDay);
  const firstName = profile.displayName.split(' ')[0];

  return (
    <div className="space-y-8 sm:space-y-10">
      <header>
        <p className="eyebrow">{fmt.date(new Date())}</p>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight sm:text-[2.125rem]">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1.5 text-fg-muted">{dailyLine()}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-fg-muted">
          <span className="font-medium text-fg">
            {profile.exam} {profile.targetYear}
          </span>
          <span className="h-3 w-px bg-line-strong" aria-hidden />
          <span>{levelLabel(profile.level)}</span>
          <span className="hidden h-3 w-px bg-line-strong sm:block" aria-hidden />
          <span className="flex basis-full flex-wrap items-center gap-3 sm:basis-auto">
            {profile.subjects.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', SUBJECTS[s].dot)} aria-hidden />
                {SUBJECTS[s].label}
              </span>
            ))}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TodayCard todayMinutes={todayMinutes} goal={profile.dailyGoalMinutes} sessionsToday={sessions.filter((s) => dayKey(new Date(s.completedAt)) === dayKey()).length} />
        <ContinueCard />
      </div>

      <QuickActions />

      <TrackCards />

      <RoomsForYou />

      <div className="grid grid-cols-1 gap-x-6 gap-y-10 lg:grid-cols-5">
        <NotesForYou className="lg:col-span-3" />
        <div className="space-y-10 lg:col-span-2">
          <TodayPlan />
          <Section title="This week" action={{ label: 'Progress', to: '/progress' }} id="home-week">
            <Card className="p-5">
              {sessions.length === 0 ? (
                <EmptyState
                  className="py-6"
                  icon={<Flame />}
                  title="Your week starts with one session"
                  description="Finish a focus block and your daily trend and streak will appear here."
                />
              ) : (
                <>
                  <div className="mb-5 flex items-baseline justify-between gap-3">
                    <p className="text-sm text-fg-muted">
                      <span className="text-2xl font-semibold text-fg tabular">{streak}</span> day{streak === 1 ? '' : 's'} streak
                    </p>
                    <p className="text-sm text-fg-muted tabular">
                      {formatMinutes(weekSeries(byDay).reduce((s, d) => s + d.minutes, 0))} this week
                    </p>
                  </div>
                  <WeekChart days={weekSeries(byDay)} goalMinutes={profile.dailyGoalMinutes} height={110} title="Focus minutes this week" />
                </>
              )}
            </Card>
          </Section>
        </div>
      </div>

      {USING_SAMPLE_DATA && (
        <PrototypeNote>
          Rooms and notes shown here are sample entries. Your focus sessions, plans and profile are stored in this browser only.
        </PrototypeNote>
      )}
    </div>
  );
}

function TodayCard({ todayMinutes, goal, sessionsToday }: { todayMinutes: number; goal: number; sessionsToday: number }) {
  const progress = todayMinutes / goal;
  const remaining = Math.max(0, goal - todayMinutes);
  const done = remaining === 0;
  const roomy = useMediaQuery('(min-width: 640px)');
  return (
    <Card className="flex flex-row items-center gap-4 p-4 sm:gap-6 sm:p-6 lg:col-span-2">
      <ProgressRing value={progress} size={roomy ? 136 : 96} stroke={roomy ? 10 : 8} label="Progress toward today's focus goal" color={done ? '#16A34A' : '#7C3AED'}>
        <span className="text-xl font-semibold leading-none text-fg tabular sm:text-[1.625rem]">{formatMinutes(todayMinutes)}</span>
        <span className="mt-1 text-[11px] text-fg-subtle sm:text-xs">of {formatMinutes(goal)}</span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Today's focus</p>
        <p className="mt-1.5 text-base font-semibold leading-snug text-fg sm:mt-2 sm:text-lg">
          {done ? 'Daily goal reached. Well done.' : todayMinutes === 0 ? 'Nothing logged yet today' : `${formatMinutes(remaining)} to go`}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm sm:mt-4 sm:gap-3 sm:pt-4 sm:text-base">
          <div>
            <dt className="text-xs text-fg-subtle">Completed</dt>
            <dd className="mt-0.5 font-semibold text-fg tabular">{formatMinutes(todayMinutes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Remaining</dt>
            <dd className="mt-0.5 font-semibold text-fg tabular">{formatMinutes(remaining)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Sessions</dt>
            <dd className="mt-0.5 font-semibold text-fg tabular">{sessionsToday}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

function ContinueCard() {
  const { timer, pause, resume } = useFocus();
  const { recentRoomId } = useRequiredProfile();
  const now = useNow(timer.status === 'running', 1000);
  const recent = useAsync(() => (recentRoomId ? roomsService.get(recentRoomId) : Promise.resolve(null)), [recentRoomId]);

  if (timer.status !== 'idle') {
    const isBreak = timer.phase === 'break';
    return (
      <Card className="relative flex flex-col overflow-hidden p-5 sm:p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full blur-2xl"
          style={{ background: isBreak ? 'rgba(8,145,178,0.10)' : 'rgba(124,58,237,0.10)' }}
          aria-hidden
        />
        <p className="eyebrow">{isBreak ? 'On a break' : timer.status === 'paused' ? 'Session paused' : 'Session in progress'}</p>
        <p className="mt-3 text-[2.75rem] font-semibold leading-none text-fg tabular">{formatClock(remainingMs(timer, now))}</p>
        <p className="mt-2 truncate text-sm text-fg-muted">
          {timer.subject ? SUBJECTS[timer.subject].label : 'General focus'}
          {timer.goal ? ` · ${timer.goal}` : ''}
        </p>
        <div className="mt-auto flex gap-2 pt-5">
          {timer.status === 'running' ? (
            <Button variant="secondary" onClick={pause}>
              <Pause aria-hidden />
              Pause
            </Button>
          ) : (
            <Button onClick={resume}>
              <Play aria-hidden />
              Resume
            </Button>
          )}
          <ButtonLink to="/focus" variant="ghost">
            Open timer
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const room = recent.data;
  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <p className="eyebrow">Continue your routine</p>
      {recent.loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : room ? (
        <>
          <p className="mt-3 text-lg font-semibold leading-snug text-fg">Return to {room.name}</p>
          <p className="mt-1 text-sm text-fg-muted">
            {room.focusMinutes}-minute blocks with {room.breakMinutes}-minute breaks.
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-lg font-semibold leading-snug text-fg">Start your first focus block</p>
          <p className="mt-1 text-sm text-fg-muted">25 minutes, one subject, phone away. That's the whole method.</p>
        </>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {room ? (
          <>
            <ButtonLink to={`/rooms/${room.id}`}>
              <DoorOpen aria-hidden />
              Rejoin room
            </ButtonLink>
            <ButtonLink to="/focus" variant="ghost">
              Solo timer
            </ButtonLink>
          </>
        ) : (
          <ButtonLink to="/focus">
            <Play aria-hidden />
            Start focusing
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}

function QuickActions() {
  const actions = [
    { to: '/rooms', icon: DoorOpen, title: 'Join a room', text: 'Study alongside others' },
    { to: '/focus', icon: Timer, title: 'Start a timer', text: 'Solo focus block' },
    { to: '/notes', icon: BookOpen, title: 'Browse notes', text: 'Curated by chapter' },
    { to: '/planner', icon: CalendarPlus, title: 'Plan a session', text: 'Set up your day' },
  ];
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {actions.map(({ to, icon: Icon, title, text }) => (
        <Link
          key={to}
          to={to}
          className="group flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-line bg-ink-800 p-3.5 shadow-card transition-[border-color,transform] active:scale-[0.98] hover:border-line-strong"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300 transition-colors group-hover:bg-violet-500/15">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-fg">{title}</span>
            <span className="mt-0.5 hidden text-xs leading-snug text-fg-subtle sm:block">{text}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

function RoomsForYou() {
  const { profile } = useRequiredProfile();
  const { data, loading, error, retry } = useAsync(() => roomsService.list(), []);
  const rooms = useMemo(
    () =>
      (data ?? [])
        .map((room) => ({ room, score: roomRelevance(room, profile) }))
        .filter((r) => r.score > 0 && r.room.visibility === 'public')
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((r) => r.room),
    [data, profile],
  );

  return (
    <Section title={`Study rooms for ${profile.exam} · ${levelLabel(profile.level)}`} action={{ label: 'All rooms', to: '/rooms' }} id="home-rooms">
      {error ? (
        <Card>
          <ErrorState onRetry={retry} />
        </Card>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className={cn('h-56 rounded-2xl', i === 2 && 'hidden lg:block')} />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <EmptyState icon={<DoorOpen />} title="No matching rooms yet" description="Browse every room or adjust your subjects in your profile." action={<ButtonLink to="/rooms" variant="secondary">Browse rooms</ButtonLink>} />
        </Card>
      ) : (
        // Phones swipe through the rooms; wider screens show them as a grid.
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
          {rooms.map((room, i) => (
            <div key={room.id} className={cn('w-[84%] shrink-0 snap-start sm:w-auto', i === 2 && 'sm:hidden lg:block')}>
              <RoomCard room={room} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function NotesForYou({ className }: { className?: string }) {
  const { profile } = useRequiredProfile();
  const { data, loading, error, retry } = useAsync(() => notesService.list(), []);
  const notes = useMemo(
    () =>
      (data ?? [])
        .map((r) => ({ r, score: resourceRelevance(r, profile) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || b.r.publishedAt.localeCompare(a.r.publishedAt))
        .slice(0, 5)
        .map((x) => x.r),
    [data, profile],
  );

  return (
    <Section title="Notes for you" action={{ label: 'Library', to: '/notes' }} className={className} id="home-notes">
      <Card className="p-2">
        {error ? (
          <ErrorState onRetry={retry} />
        ) : loading ? (
          <div className="space-y-1 p-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3.5 px-2 py-2.5">
                <Skeleton className="size-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <EmptyState icon={<BookOpen />} title="No notes for your subjects yet" description="New resources are added regularly." />
        ) : (
          <div className="divide-y divide-line">
            {notes.map((r) => (
              <ResourceRow key={r.id} resource={r} />
            ))}
          </div>
        )}
      </Card>
    </Section>
  );
}

function TodayPlan() {
  const { plans, toggleDone } = usePlanner();
  const { start, timer } = useFocus();
  const today = plans.filter((p) => p.date === dayKey());
  return (
    <Section title="Up next today" action={{ label: 'Planner', to: '/planner' }} id="home-plan">
      <Card className="p-2">
        {today.length === 0 ? (
          <EmptyState
            className="py-6"
            icon={<CalendarPlus />}
            title="No sessions planned today"
            description="Plan two or three blocks so you know exactly what to sit down to."
            action={
              <ButtonLink to="/planner" variant="secondary" size="sm">
                Plan today
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {today.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleDone(p.id)}
                  className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-full text-fg-subtle hover:text-fg"
                  aria-label={p.done ? `Mark "${p.title}" as not done` : `Mark "${p.title}" as done`}
                >
                  {p.done ? <CheckCircle2 className="size-5 text-mint-400" aria-hidden /> : <Circle className="size-5" aria-hidden />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-medium', p.done ? 'text-fg-subtle line-through' : 'text-fg')}>{p.title}</p>
                  <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
                    <span className={cn('size-1.5 rounded-full', SUBJECTS[p.subject].dot)} aria-hidden />
                    {SUBJECTS[p.subject].label} · {formatMinutes(p.minutes)}
                  </p>
                </div>
                {!p.done && timer.status === 'idle' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => start({ subject: p.subject, goal: p.title, focusMinutes: p.minutes, planId: p.id, roomId: null })}
                    aria-label={`Start ${p.title}`}
                  >
                    <Play aria-hidden />
                    Start
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {today.length > 0 && (
        <Link to="/planner" className="mt-1 inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg [@media(pointer:coarse)]:min-h-10">
          {today.filter((p) => p.done).length} of {today.length} done <ArrowRight className="size-3" aria-hidden />
        </Link>
      )}
    </Section>
  );
}
