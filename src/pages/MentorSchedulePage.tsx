import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, CalendarPlus, Clock3, ExternalLink, EyeOff, Trash2, UserRound } from 'lucide-react';
import type { Exam, Language, MentorOwnSlot, MentorSelf, Subject } from '@/types';
import { SUBJECTS } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { dayKey } from '@/lib/date';
import { useAsync } from '@/hooks/useAsync';
import { mentorshipService } from '@/services/mentorshipService';
import { ApiError, errorMessage } from '@/services/http';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, PageHeader, Section } from '@/components/ui/Layout';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Choice';
import { useToast } from '@/components/ui/Toast';
import { FormAlert } from '@/features/auth/AuthLayout';
import { timeLabel } from '@/features/mentorship/parts';

// Half-hour start times from 6 am to 10:30 pm.
const TIMES = Array.from({ length: 34 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});
const dayHeading = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

function addDaysKey(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export default function MentorSchedulePage() {
  const me = useAsync(() => mentorshipService.me(), []);
  const [slots, setSlots] = useState<MentorOwnSlot[] | null>(null);

  if (me.error) {
    const notMentor = me.error instanceof ApiError && me.error.status === 403;
    return (
      <Card>
        {notMentor ? (
          <EmptyState
            icon={<UserRound />}
            title="This page is for mentors"
            description="If you'd like to mentor students on CrackRoom, contact the team to be verified."
            action={<ButtonLink to="/mentorship" variant="secondary">Back to mentorship</ButtonLink>}
          />
        ) : (
          <ErrorState message={me.error.message} onRetry={me.retry} />
        )}
      </Card>
    );
  }
  if (me.loading || !me.data) return <PageSkeleton />;

  const all = slots ?? me.data.slots;
  return (
    <div className="space-y-8">
      <Link to="/mentorship" className="-my-2 inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm font-medium text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Mentorship
      </Link>
      <PageHeader
        title="Your mentor schedule"
        description="Publish the times you're free. Students book them and tell you what they want to cover."
        eyebrow={
          <div className="flex flex-wrap gap-2">
            {me.data.isVerified ? (
              <Badge tone="violet">
                <BadgeCheck aria-hidden />
                Verified
              </Badge>
            ) : (
              <Badge tone="amber">Verification pending</Badge>
            )}
            {!me.data.isActive && (
              <Badge tone="rose">
                <EyeOff aria-hidden />
                Hidden from students
              </Badge>
            )}
          </div>
        }
        actions={
          <ButtonLink to={`/mentorship/${me.data.id}`} variant="secondary">
            <ExternalLink aria-hidden />
            Public profile
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-8">
          <PublishSlots minutes={me.data.sessionMinutes} onPublished={(created) => setSlots([...all, ...created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)))} />
          <Upcoming slots={all} onRemoved={(id) => setSlots(all.filter((s) => s.id !== id))} />
        </div>
        <ProfileForm mentor={me.data} />
      </div>
    </div>
  );
}

function PublishSlots({ minutes, onPublished }: { minutes: number; onPublished: (slots: MentorOwnSlot[]) => void }) {
  const notify = useToast();
  const [date, setDate] = useState(addDaysKey(1));
  const [times, setTimes] = useState<string[]>([]);
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  function toggle(t: string) {
    setTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()));
  }

  async function publish() {
    setBusy(true);
    setFailure(undefined);
    try {
      // The browser's local time is the mentor's time; the server stores UTC.
      const created = await mentorshipService.publishSlots(times.map((t) => new Date(`${date}T${t}:00`).toISOString()));
      onPublished(created);
      setTimes([]);
      notify({ tone: 'success', title: `${created.length} ${created.length === 1 ? 'slot' : 'slots'} published`, description: 'Students can book them now.' });
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Publish free times" id="publish-slots">
      <Card className="space-y-5 p-5 sm:p-6">
        {failure && <FormAlert>{failure}</FormAlert>}
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Day" className="w-full sm:w-56">
            {({ id }) => (
              <Input id={id} type="date" min={dayKey()} max={addDaysKey(60)} value={date} onChange={(e) => setDate(e.target.value)} className="[color-scheme:light]" />
            )}
          </Field>
          <p className="flex items-center gap-1.5 pb-3 text-sm text-fg-muted">
            <Clock3 className="size-4 text-fg-subtle" aria-hidden />
            Each slot is {minutes} minutes
          </p>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-fg">Start times</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {TIMES.map((t) => {
              const on = times.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t)}
                  className={cn(
                    'h-10 rounded-xl border text-[13px] font-medium tabular transition-colors',
                    on ? 'border-violet-500 bg-violet-500 text-white' : 'border-line-strong bg-ink-800 text-fg-muted hover:border-ink-500 hover:text-fg',
                  )}
                >
                  {to12h(t)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg-subtle">{times.length ? `${times.length} selected` : 'Tap the times you are free'}</p>
          <Button onClick={publish} disabled={!times.length || busy}>
            <CalendarPlus aria-hidden />
            {busy ? 'Publishing…' : times.length ? `Publish ${times.length} ${times.length === 1 ? 'slot' : 'slots'}` : 'Publish slots'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

function Upcoming({ slots, onRemoved }: { slots: MentorOwnSlot[]; onRemoved: (id: number) => void }) {
  const notify = useToast();
  const [removing, setRemoving] = useState<MentorOwnSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => {
    const map = new Map<string, MentorOwnSlot[]>();
    for (const s of slots) {
      const key = new Date(s.startsAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.values()];
  }, [slots]);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await mentorshipService.removeSlot(removing.id);
      onRemoved(removing.id);
      notify({ title: removing.booking ? 'Session cancelled' : 'Slot removed', description: removing.booking ? `${removing.booking.studentName} can see it was cancelled.` : undefined });
      setRemoving(null);
    } catch (e) {
      notify({ tone: 'error', title: 'Not removed', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Upcoming" id="upcoming-slots">
      {groups.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarPlus />} title="No slots published" description="Publish a few evening times above. Students see them straight away." />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group[0].startsAt}>
              <h3 className="mb-2 px-1 text-sm font-semibold text-fg-muted">{dayHeading.format(new Date(group[0].startsAt))}</h3>
              <Card className="divide-y divide-line p-1.5">
                {group.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-3">
                    <span className="w-20 shrink-0 text-sm font-semibold text-fg tabular">{timeLabel(s.startsAt)}</span>
                    {s.booking ? (
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar name={s.booking.studentName} hue={s.booking.studentHue ?? undefined} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-fg">
                            {s.booking.studentName}
                            {s.booking.studentExam && <span className="font-normal text-fg-subtle"> · {s.booking.studentExam}</span>}
                          </p>
                          <p className="line-clamp-2 text-xs text-fg-muted">“{s.booking.topic}”</p>
                          {s.booking.meetingUrl && (
                            <a href={s.booking.meetingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-8 items-center text-xs font-semibold text-violet-300 hover:text-violet-700">
                              {s.booking.inviteSent ? 'Open Meet link (also in your calendar invite)' : 'Open your call link'}
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="flex-1 text-sm text-fg-subtle">Open</span>
                    )}
                    <Button variant="ghost" size="icon" className="shrink-0 text-fg-subtle" onClick={() => setRemoving(s)} aria-label={s.booking ? 'Cancel this session' : 'Remove this slot'}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={removing != null}
        onClose={() => setRemoving(null)}
        size="sm"
        title={removing?.booking ? 'Cancel a booked session?' : 'Remove this slot?'}
        description={removing?.booking ? `${removing.booking.studentName} booked this time. They will see it was cancelled by you.` : 'Students will no longer be able to book it.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Keep
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? 'Removing…' : removing?.booking ? 'Cancel session' : 'Remove slot'}
            </Button>
          </>
        }
      />
    </Section>
  );
}

const LENGTHS = ['20', '30', '45', '60'];
const LANGUAGES: Language[] = ['English', 'Hindi', 'Hinglish'];

function ProfileForm({ mentor }: { mentor: MentorSelf }) {
  const notify = useToast();
  const [headline, setHeadline] = useState(mentor.headline);
  const [bio, setBio] = useState(mentor.bio);
  const [meetingUrl, setMeetingUrl] = useState(mentor.meetingUrl);
  const [length, setLength] = useState(String(mentor.sessionMinutes));
  const [exams, setExams] = useState<Exam[]>(mentor.exams);
  const [subjects, setSubjects] = useState<Subject[]>(mentor.subjects);
  const [languages, setLanguages] = useState<Language[]>(mentor.languages);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await mentorshipService.updateMe({ headline: headline.trim(), bio: bio.trim(), meetingUrl: meetingUrl.trim(), sessionMinutes: Number(length), exams, subjects, languages });
      notify({ tone: 'success', title: 'Profile saved', description: 'New slots use the updated session length.' });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else notify({ tone: 'error', title: 'Not saved', description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="xl:sticky xl:top-8">
      <Section title="Profile and call link" id="mentor-profile">
        <Card className="p-5 sm:p-6">
          <form onSubmit={save} noValidate className="space-y-4">
            <Field label="Headline" error={errors.headline} hint="Your college and result, in one line.">
              {({ id, describedBy, invalid }) => <Input id={id} value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />}
            </Field>
            <Field label="About you" error={errors.bio}>
              {({ id, describedBy, invalid }) => <Textarea id={id} value={bio} maxLength={1200} onChange={(e) => setBio(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} className="min-h-28" />}
            </Field>
            <Field label="Backup meeting link" error={errors.meetingUrl} hint="Each booking normally gets its own Meet link by email. This Google Meet or Zoom link is used only if that fails.">
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="url" inputMode="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/…" aria-describedby={describedBy} aria-invalid={invalid} />
              )}
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-fg">Session length (min)</p>
              <Segmented label="Session length in minutes" value={length} options={LENGTHS.map((v) => ({ value: v, label: v }))} onChange={setLength} />
            </div>
            <ToggleGroup label="Exams" error={errors.exams} options={(['JEE', 'NEET'] as Exam[]).map((v) => ({ value: v, label: v }))} value={exams} onChange={setExams} />
            <ToggleGroup
              label="Subjects"
              error={errors.subjects}
              options={(Object.keys(SUBJECTS) as Subject[]).map((v) => ({ value: v, label: SUBJECTS[v].label }))}
              value={subjects}
              onChange={setSubjects}
            />
            <ToggleGroup label="Languages" error={errors.languages} options={LANGUAGES.map((v) => ({ value: v, label: v }))} value={languages} onChange={setLanguages} />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </Card>
      </Section>
    </aside>
  );
}

function ToggleGroup<T extends string>({ label, options, value, onChange, error }: { label: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; error?: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-fg">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={cn(
                'h-10 rounded-xl border px-3.5 text-sm font-medium transition-colors',
                on ? 'border-violet-400/60 bg-violet-500/10 text-violet-300' : 'border-line-strong text-fg-muted hover:border-ink-500',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-rose-400">{error}</p>}
    </fieldset>
  );
}
