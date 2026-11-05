import { useMemo, useState, type ReactNode } from 'react';
import { CalendarCheck, CalendarClock, GraduationCap, MessageSquareText, Sparkles, Target, Users, Video } from 'lucide-react';
import type { Exam, MentorBooking, Subject } from '@/types';
import { SUBJECTS } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { useAsync } from '@/hooks/useAsync';
import { useNow } from '@/hooks/useNow';
import { mentorshipService } from '@/services/mentorshipService';
import { USING_SAMPLE_DATA } from '@/services/config';
import { errorMessage } from '@/services/http';
import { ButtonLink, Button } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/Layout';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { BookingCard, MentorCard, whenLabel } from '@/features/mentorship/parts';

export default function MentorshipPage() {
  if (USING_SAMPLE_DATA) {
    return (
      <div className="space-y-8">
        <Hero mentors={null} openSlots={null} />
        <Card>
          <EmptyState
            icon={<GraduationCap />}
            title="Mentorship needs the CrackRoom server"
            description="Booking real people cannot work on sample data. Connect the API to see mentors and their open slots."
          />
        </Card>
      </div>
    );
  }
  return <LiveMentorship />;
}

function LiveMentorship() {
  const { profile } = useRequiredProfile();
  const mentors = useAsync(() => mentorshipService.mentors(), []);
  const [exam, setExam] = useState<Exam | ''>(profile.exam);
  const [subject, setSubject] = useState<Subject | ''>('');

  const visible = useMemo(
    () =>
      (mentors.data ?? [])
        .filter((m) => (!exam || m.exams.includes(exam)) && (!subject || m.subjects.includes(subject)))
        // Verified mentors with the soonest opening first.
        .sort((a, b) => Number(b.isVerified) - Number(a.isVerified) || (a.nextSlot ?? '9').localeCompare(b.nextSlot ?? '9')),
    [mentors.data, exam, subject],
  );
  const openSlots = (mentors.data ?? []).reduce((sum, m) => sum + m.openSlots, 0);
  const subjects: Subject[] = exam === 'NEET' ? ['physics', 'chemistry', 'biology'] : exam === 'JEE' ? ['physics', 'chemistry', 'mathematics'] : ['physics', 'chemistry', 'mathematics', 'biology'];

  return (
    <div className="space-y-10">
      <Hero mentors={mentors.data?.length ?? null} openSlots={mentors.data ? openSlots : null} />

      <YourSessions />

      <Section title="Choose your mentor" id="mentor-list">
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter mentors">
          {(['', 'JEE', 'NEET'] as const).map((value) => (
            <Chip key={value || 'all'} on={exam === value} onClick={() => { setExam(value); setSubject(''); }}>
              {value || 'All exams'}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden />
          <Chip on={subject === ''} onClick={() => setSubject('')}>
            All subjects
          </Chip>
          {subjects.map((s) => (
            <Chip key={s} on={subject === s} onClick={() => setSubject(s)}>
              <span className={cn('size-1.5 rounded-full', subject === s ? 'bg-white' : SUBJECTS[s].dot)} aria-hidden />
              {SUBJECTS[s].label}
            </Chip>
          ))}
        </div>

        {mentors.error ? (
          <Card>
            <ErrorState message={mentors.error.message} onRetry={mentors.retry} />
          </Card>
        ) : mentors.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : (mentors.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<Sparkles />}
              title="Mentors are being onboarded"
              description="We are verifying toppers and teachers before they can take sessions. Check back soon."
            />
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState icon={<Users />} title="No mentors for this filter yet" description="Try another subject or exam." />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((m) => (
              <MentorCard key={m.id} mentor={m} />
            ))}
          </div>
        )}
      </Section>

      <HowItWorks />
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium transition-colors sm:h-9',
        on ? 'border-violet-500 bg-violet-500 text-white shadow-card' : 'border-line-strong bg-ink-800 text-fg-muted hover:border-ink-500 hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

/** Dark, rich hero: the one place in the light app that feels like a members' lounge. */
function Hero({ mentors, openSlots }: { mentors: number | null; openSlots: number | null }) {
  const { user } = useAuth();
  return (
    <section
      className="relative overflow-hidden rounded-[1.75rem] px-5 py-8 text-white shadow-pop sm:px-10 sm:py-12"
      style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #3B1A7A 48%, #6D28D9 100%)' }}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full opacity-60 blur-3xl" style={{ background: 'radial-gradient(circle, #A78BFA, transparent 65%)' }} aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-10 size-80 rounded-full opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, #F59E0B, transparent 65%)' }} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        aria-hidden
      />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="text-[2rem] font-semibold leading-[1.05] text-white sm:text-[2.75rem]">
            1:1 Mentorship
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-base">
            A private video session with a verified mentor who has been where you are. Bring your plan, your doubts or your mock
            results — leave with a clear next step.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
            {[
              [Target, 'Personal study plan'],
              [MessageSquareText, 'Doubt clearing'],
              [Video, 'Private video call'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Target;
              return (
                <li key={label as string} className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <I className="size-4" aria-hidden />
                  </span>
                  {label as string}
                </li>
              );
            })}
          </ul>
          {user?.mentorId && (
            <ButtonLink to="/mentorship/schedule" variant="secondary" className="mt-6 border-white/20 bg-white/10 text-white hover:bg-white/20">
              <CalendarClock aria-hidden />
              Your mentor schedule
            </ButtonLink>
          )}
        </div>
        {mentors != null && openSlots != null && (
          <dl className="grid grid-cols-2 gap-3 sm:max-w-sm lg:w-72">
            <Stat value={mentors} label={mentors === 1 ? 'mentor' : 'mentors'} />
            <Stat value={openSlots} label="open slots, next 3 weeks" />
          </dl>
        )}
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
      <dd className="text-3xl font-semibold tabular">{value}</dd>
      <dt className="mt-0.5 text-xs leading-snug text-white/70">{label}</dt>
    </div>
  );
}

function YourSessions() {
  const notify = useToast();
  const bookings = useAsync(() => mentorshipService.bookings(), []);
  const [list, setList] = useState<MentorBooking[] | null>(null);
  const [cancelling, setCancelling] = useState<MentorBooking | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(true, 30_000);
  const all = list ?? bookings.data ?? [];
  const upcoming = all.filter((b) => b.status === 'booked' && Date.parse(b.startsAt) + b.minutes * 60_000 > now);
  const past = all.filter((b) => !upcoming.includes(b)).reverse().slice(0, 5);

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    try {
      const updated = await mentorshipService.cancel(cancelling.id);
      setList(all.map((b) => (b.id === updated.id ? updated : b)));
      notify({ title: 'Session cancelled', description: 'The slot is open again for other students.' });
      setCancelling(null);
    } catch (e) {
      notify({ tone: 'error', title: 'Not cancelled', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  if (bookings.loading || bookings.error || all.length === 0) return null;

  return (
    <Section title="Your sessions" id="your-sessions">
      <div className="space-y-3">
        {upcoming.length === 0 ? (
          <Card className="flex items-center gap-3 p-5 text-sm text-fg-muted">
            <CalendarCheck className="size-5 text-fg-subtle" aria-hidden />
            No upcoming sessions. Pick a mentor below to book your next one.
          </Card>
        ) : (
          upcoming.map((b) => <BookingCard key={b.id} booking={b} now={now} onCancel={() => setCancelling(b)} />)
        )}
        {past.length > 0 && (
          <details className="group rounded-2xl border border-line bg-ink-850 px-4 py-1 sm:px-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-fg-muted">
              Past and cancelled sessions
              <span className="text-xs text-fg-subtle group-open:hidden">Show</span>
              <span className="hidden text-xs text-fg-subtle group-open:inline">Hide</span>
            </summary>
            <div className="space-y-3 pb-4 pt-2">
              {past.map((b) => (
                <BookingCard key={b.id} booking={b} now={now} />
              ))}
            </div>
          </details>
        )}
      </div>
      <Dialog
        open={cancelling != null}
        onClose={() => setCancelling(null)}
        size="sm"
        title="Cancel this session?"
        description={cancelling ? `${cancelling.mentor.name} · ${whenLabel(cancelling.startsAt)}. The slot opens up for other students.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={confirmCancel} disabled={busy}>
              {busy ? 'Cancelling…' : 'Cancel session'}
            </Button>
          </>
        }
      />
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Users, title: 'Pick a mentor', text: 'Filter by exam and subject. Verified mentors carry the violet tick.' },
    { icon: CalendarCheck, title: 'Book a slot', text: 'Choose a time and tell them what you want to work on.' },
    { icon: Video, title: 'Meet 1:1', text: 'You both get a Google Calendar invite by email. You can also join from here, from 10 minutes before.' },
  ];
  return (
    <section aria-labelledby="how-mentorship-works">
      <h2 id="how-mentorship-works" className="mb-3 text-base font-semibold">
        How it works
      </h2>
      <ol className="grid gap-3 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="surface relative p-5">
            <span className="absolute right-4 top-3 font-display text-4xl font-semibold text-ink-600">{i + 1}</span>
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
              <Icon className="size-5" aria-hidden />
            </span>
            <p className="mt-3 font-semibold text-fg">{title}</p>
            <p className="mt-1 text-sm text-fg-muted">{text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-fg-subtle">You can hold two upcoming sessions at a time and cancel up to 2 hours before the start.</p>
    </section>
  );
}
