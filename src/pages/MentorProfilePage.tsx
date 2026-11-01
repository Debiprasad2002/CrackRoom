import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CalendarPlus, CheckCircle2, Clock, GraduationCap, Languages, ShieldCheck, Sparkles, Video } from 'lucide-react';
import type { MentorBooking, MentorDetail, MentorSlot } from '@/types';
import { cn } from '@/lib/cn';
import { useAsync } from '@/hooks/useAsync';
import { mentorshipService } from '@/services/mentorshipService';
import { USING_SAMPLE_DATA } from '@/services/config';
import { errorMessage } from '@/services/http';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Field, Textarea } from '@/components/ui/Field';
import { FormAlert } from '@/features/auth/AuthLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { MentorAvatar, SubjectChips, VerifiedTick, downloadIcs, timeLabel, whenLabel } from '@/features/mentorship/parts';

const dayKeyOf = (iso: string) => new Date(iso).toDateString();
const dayChip = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });

export default function MentorProfilePage() {
  const { mentorId = '' } = useParams();
  const mentor = useAsync(() => (USING_SAMPLE_DATA ? Promise.resolve(null) : mentorshipService.mentor(mentorId)), [mentorId]);

  return (
    <div className="space-y-6">
      <Link to="/mentorship" className="-my-2 inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm font-medium text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        All mentors
      </Link>
      {mentor.error ? (
        <Card>
          <ErrorState message={mentor.error.message} onRetry={mentor.retry} />
        </Card>
      ) : mentor.loading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]" aria-busy="true">
          <Skeleton className="h-96 rounded-[1.75rem]" />
          <Skeleton className="h-96 rounded-[1.75rem]" />
        </div>
      ) : !mentor.data ? (
        <Card>
          <EmptyState
            icon={<GraduationCap />}
            title="This mentor isn't available"
            description="They may have paused sessions, or the link is incorrect."
            action={<ButtonLink to="/mentorship" variant="secondary">See all mentors</ButtonLink>}
          />
        </Card>
      ) : (
        <MentorView mentor={mentor.data} />
      )}
    </div>
  );
}

function MentorView({ mentor }: { mentor: MentorDetail }) {
  return (
    // Phones: profile, booking, then the safety note. Desktop: booking in a sticky side column.
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="contents">
        <section className="surface relative overflow-hidden p-6 sm:p-8 lg:col-start-1 lg:row-start-1">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-44 [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
            style={{ background: `linear-gradient(135deg, hsl(${mentor.hue} 85% 94%), hsl(${(mentor.hue + 50) % 360} 90% 95%) 60%, transparent)` }}
            aria-hidden
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end">
            <MentorAvatar name={mentor.name} hue={mentor.hue} size="xl" verified={mentor.isVerified} className="sm:self-auto" />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[1.75rem] font-semibold leading-tight sm:text-[2.125rem]">
                {mentor.name}
                {mentor.isVerified && <VerifiedTick className="text-[1.5rem]" />}
              </h1>
              <p className="mt-1 text-fg-muted">{mentor.headline}</p>
            </div>
          </div>
          <dl className="relative mt-6 grid grid-cols-3 gap-3 border-y border-line py-4 text-center sm:text-left">
            <Stat label="Session" value={`${mentor.sessionMinutes} min`} />
            <Stat label="Held so far" value={String(mentor.sessionsDone)} />
            <Stat label="Open slots" value={String(mentor.slots.length)} />
          </dl>
          <div className="relative mt-6 space-y-5">
            <div>
              <h2 className="font-sans text-sm font-semibold">About</h2>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-fg-muted">{mentor.bio}</p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <div>
                <h2 className="font-sans text-sm font-semibold">Helps with</h2>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {mentor.exams.map((e) => (
                    <span key={e} className="inline-flex h-6 items-center rounded-md border border-violet-400/25 bg-violet-500/10 px-2 text-xs font-semibold text-violet-300">
                      {e}
                    </span>
                  ))}
                  <SubjectChips subjects={mentor.subjects} />
                </div>
              </div>
              <div>
                <h2 className="font-sans text-sm font-semibold">Speaks</h2>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-muted">
                  <Languages className="size-4 text-fg-subtle" aria-hidden />
                  {mentor.languages.join(', ')}
                </p>
              </div>
            </div>
          </div>
        </section>
        <Card className="order-last flex gap-3 p-5 lg:order-none lg:col-start-1 lg:row-start-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-mint-400" aria-hidden />
          <div className="text-sm text-fg-muted">
            <p className="font-medium text-fg">Safe, private sessions</p>
            <p className="mt-1">
              {mentor.isVerified ? 'CrackRoom has checked this mentor’s background. ' : 'This mentor has not been verified yet. '}
              Calls happen on a private link only you and your mentor receive. Never share passwords or payment details in a call.
            </p>
          </div>
        </Card>
      </div>
      <BookingPanel mentor={mentor} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-fg tabular">{value}</dd>
    </div>
  );
}

function BookingPanel({ mentor }: { mentor: MentorDetail }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const days = useMemo(() => {
    const map = new Map<string, MentorSlot[]>();
    for (const s of mentor.slots) map.set(dayKeyOf(s.startsAt), [...(map.get(dayKeyOf(s.startsAt)) ?? []), s]);
    return [...map.entries()];
  }, [mentor.slots]);
  const [day, setDay] = useState(days[0]?.[0] ?? '');
  const [slot, setSlot] = useState<MentorSlot | null>(null);
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<MentorBooking | null>(null);
  const isSelf = user?.mentorId === mentor.id;

  async function book(e: FormEvent) {
    e.preventDefault();
    if (!slot) return;
    if (topic.trim().length < 10) {
      setError('Tell your mentor a little more so they can prepare (at least 10 characters).');
      return;
    }
    setError(undefined);
    setFailure(undefined);
    setBusy(true);
    try {
      setBooked(await mentorshipService.book(slot.id, topic.trim()));
    } catch (err) {
      setFailure(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <aside className="lg:sticky lg:top-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <div className="surface overflow-hidden">
        <div className="px-5 py-4 text-white sm:px-6" style={{ background: 'linear-gradient(135deg, #1E1B4B, #5B21B6)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Book a session</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
            <Clock className="size-4" aria-hidden />
            {mentor.sessionMinutes}-minute private call
          </p>
        </div>

        {booked ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-6 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint-400/10 text-mint-400">
              <CheckCircle2 className="size-7" aria-hidden />
            </span>
            <p className="mt-4 text-lg font-semibold text-fg">You're booked</p>
            <p className="mt-1 text-sm text-fg-muted">
              {whenLabel(booked.startsAt)} with {mentor.name}. The call link appears in Mentorship 10 minutes before the start.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={() => downloadIcs(booked)}>
                <CalendarPlus aria-hidden />
                Add to calendar
              </Button>
              <Button variant="ghost" onClick={() => navigate('/mentorship')}>
                See your sessions
              </Button>
            </div>
          </motion.div>
        ) : isSelf ? (
          <div className="p-6 text-sm text-fg-muted">
            This is your public profile.{' '}
            <Link to="/mentorship/schedule" className="font-medium text-violet-300 hover:text-violet-700">
              Manage your schedule
            </Link>
            .
          </div>
        ) : days.length === 0 ? (
          <EmptyState className="py-10" icon={<Sparkles />} title="No open slots right now" description="New times appear here as soon as the mentor publishes them." />
        ) : (
          <form onSubmit={book} noValidate className="space-y-5 p-5 sm:p-6">
            {failure && <FormAlert>{failure}</FormAlert>}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-fg">1. Pick a day</legend>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
                {days.map(([key, slots]) => {
                  const d = new Date(slots[0].startsAt);
                  const on = key === day;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setDay(key);
                        setSlot(null);
                      }}
                      className={cn(
                        'flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition-colors',
                        on ? 'border-violet-500 bg-violet-500 text-white shadow-card' : 'border-line-strong bg-ink-800 text-fg hover:border-ink-500',
                      )}
                    >
                      <span className={cn('text-[11px] font-semibold uppercase tracking-wide', on ? 'text-white/80' : 'text-fg-subtle')}>{dayChip.format(d)}</span>
                      <span className="text-xl font-semibold leading-tight tabular">{d.getDate()}</span>
                      <span className={cn('text-[10px]', on ? 'text-white/80' : 'text-fg-subtle')}>{slots.length} open</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-fg">2. Pick a time</legend>
              <div className="grid grid-cols-3 gap-2">
                {(days.find(([k]) => k === day)?.[1] ?? []).map((s) => {
                  const on = slot?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSlot(s)}
                      className={cn(
                        'h-11 rounded-xl border text-sm font-medium tabular transition-colors',
                        on ? 'border-violet-500 bg-violet-500/10 text-violet-300 ring-1 ring-violet-500' : 'border-line-strong bg-ink-800 text-fg hover:border-ink-500',
                      )}
                    >
                      {timeLabel(s.startsAt)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="3. What should you work on?" error={error} hint="Your mentor reads this before the call.">
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  value={topic}
                  maxLength={300}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. My mock scores are stuck at 520. Help me plan the last 60 days for Biology."
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  className="min-h-24"
                />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={!slot || busy}>
              <Video aria-hidden />
              {busy ? 'Booking…' : slot ? `Book ${whenLabel(slot.startsAt)}` : 'Choose a time'}
            </Button>
            <p className="text-center text-xs text-fg-subtle">Free to book. Cancel up to 2 hours before the start.</p>
          </form>
        )}
      </div>
    </aside>
  );
}
