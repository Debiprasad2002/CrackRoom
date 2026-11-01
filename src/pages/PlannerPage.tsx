import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Circle, Play, Plus, Trash2 } from 'lucide-react';
import type { Subject } from '@/types';
import { SUBJECTS } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { addDays, dayKey, fmt, formatMinutes, fromDayKey, startOfWeek } from '@/lib/date';
import { minutesByDay } from '@/lib/stats';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Layout';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, PrototypeNote } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Choice';
import { useToast } from '@/components/ui/Toast';
import { usePlanner } from '@/features/planner/PlannerContext';
import { useFocus } from '@/features/focus/FocusContext';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { USING_SAMPLE_DATA } from '@/services/config';

export default function PlannerPage() {
  const { plans, toggleDone, removePlan } = usePlanner();
  const { sessions, timer, start } = useFocus();
  const notify = useToast();
  const navigate = useNavigate();
  const today = dayKey();
  const [selected, setSelected] = useState(today);
  const [adding, setAdding] = useState(false);

  const weekStart = startOfWeek(fromDayKey(selected));
  const week = Array.from({ length: 7 }, (_, i) => dayKey(addDays(weekStart, i)));
  const byDay = useMemo(() => minutesByDay(sessions), [sessions]);

  const weekPlans = plans.filter((p) => week.includes(p.date));
  const plannedMinutes = weekPlans.reduce((s, p) => s + p.minutes, 0);
  const doneCount = weekPlans.filter((p) => p.done).length;
  const focusedMinutes = week.reduce((s, d) => s + (byDay.get(d) ?? 0), 0);
  const dayPlans = plans.filter((p) => p.date === selected);

  function shiftWeek(n: number) {
    setSelected(dayKey(addDays(fromDayKey(selected), n * 7)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study planner"
        description="Plan your blocks by subject, then tick them off — or start one straight into the timer."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            Plan a session
          </Button>
        }
      />

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(-1)} aria-label="Previous week">
            <ChevronLeft aria-hidden />
          </Button>
          <div className="text-center">
            <p className="text-sm font-semibold text-fg">
              {fmt.short(weekStart)} – {fmt.short(addDays(weekStart, 6))}
            </p>
            {!week.includes(today) && (
              <button type="button" onClick={() => setSelected(today)} className="-my-1 py-2 text-xs font-medium text-violet-300 hover:text-violet-700">
                Back to this week
              </button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(1)} aria-label="Next week">
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2" role="group" aria-label="Choose a day">
          {week.map((d) => {
            const date = fromDayKey(d);
            const count = plans.filter((p) => p.date === d).length;
            const done = plans.filter((p) => p.date === d && p.done).length;
            const isSel = d === selected;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={isSel}
                aria-label={`${fmt.date(date)}, ${count} planned, ${done} done`}
                onClick={() => setSelected(d)}
                className={cn(
                  'flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border py-2 transition-colors',
                  isSel ? 'border-violet-400/60 bg-violet-500/10' : 'border-transparent hover:bg-ink-750',
                )}
              >
                <span className={cn('text-[11px] font-medium uppercase tracking-wide', d === today ? 'text-violet-300' : 'text-fg-subtle')}>
                  {fmt.weekday(date).slice(0, 3)}
                </span>
                <span className={cn('text-lg font-semibold tabular', isSel ? 'text-fg' : 'text-fg-muted')}>{date.getDate()}</span>
                <span className="flex h-1.5 gap-0.5" aria-hidden>
                  {Array.from({ length: Math.min(count, 4) }, (_, i) => (
                    <span key={i} className={cn('size-1.5 rounded-full', i < done ? 'bg-mint-400' : 'bg-fg-subtle/60')} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="day-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="day-heading" className="text-base font-semibold">
              {selected === today ? 'Today' : fmt.weekday(fromDayKey(selected))}, {fmt.short(fromDayKey(selected))}
            </h2>
            {dayPlans.length > 0 && (
              <p className="text-sm text-fg-subtle tabular">
                {formatMinutes(dayPlans.reduce((s, p) => s + p.minutes, 0))} planned
              </p>
            )}
          </div>
          <Card className="p-2">
            {dayPlans.length === 0 ? (
              <EmptyState
                icon={<CalendarPlus />}
                title="Nothing planned for this day"
                description="Two or three focused blocks are plenty. Pick the chapters before you sit down."
                action={
                  <Button variant="secondary" onClick={() => setAdding(true)}>
                    <Plus aria-hidden />
                    Plan a session
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {dayPlans.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-1.5 py-2 sm:gap-3 sm:px-3 sm:py-3">
                    <button
                      type="button"
                      onClick={() => toggleDone(p.id)}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-fg-subtle hover:text-fg"
                      aria-label={p.done ? `Mark "${p.title}" as not done` : `Mark "${p.title}" as done`}
                    >
                      {p.done ? <CheckCircle2 className="size-5 text-mint-400" aria-hidden /> : <Circle className="size-5" aria-hidden />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn('line-clamp-2 font-medium leading-snug sm:truncate', p.done ? 'text-fg-subtle line-through' : 'text-fg')}>{p.title}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                        <span className={cn('size-1.5 rounded-full', SUBJECTS[p.subject].dot)} aria-hidden />
                        {SUBJECTS[p.subject].label} · {formatMinutes(p.minutes)}
                      </p>
                    </div>
                    {!p.done && p.date === today && timer.status === 'idle' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="shrink-0 max-sm:w-10 max-sm:px-0"
                        aria-label={`Start "${p.title}"`}
                        onClick={() => {
                          start({ subject: p.subject, goal: p.title, focusMinutes: p.minutes, planId: p.id, roomId: null });
                          navigate('/focus');
                        }}
                      >
                        <Play aria-hidden />
                        <span className="hidden sm:inline">Start</span>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-10 shrink-0 text-fg-subtle"
                      aria-label={`Delete "${p.title}"`}
                      onClick={() => {
                        removePlan(p.id);
                        notify({ title: 'Session removed from plan' });
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <aside>
          <h2 className="mb-3 text-base font-semibold">This week</h2>
          <Card className="p-5">
            <dl className="space-y-4">
              <div>
                <dt className="text-xs text-fg-subtle">Sessions completed</dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold text-fg tabular">{doneCount}</span>
                  <span className="text-sm text-fg-muted">of {weekPlans.length} planned</span>
                </dd>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-600">
                  <div
                    className="h-full rounded-full bg-mint-400 transition-[width] duration-500"
                    style={{ width: weekPlans.length ? `${(doneCount / weekPlans.length) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
                <div>
                  <dt className="text-xs text-fg-subtle">Planned time</dt>
                  <dd className="mt-0.5 font-semibold text-fg tabular">{formatMinutes(plannedMinutes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Focused time</dt>
                  <dd className="mt-0.5 font-semibold text-fg tabular">{formatMinutes(focusedMinutes)}</dd>
                </div>
              </div>
            </dl>
          </Card>
          {USING_SAMPLE_DATA && <PrototypeNote className="mt-4">Plans are saved in this browser only.</PrototypeNote>}
        </aside>
      </div>

      <AddPlanDialog open={adding} onClose={() => setAdding(false)} defaultDate={selected < today ? today : selected} onAdded={setSelected} />
    </div>
  );
}

const DURATIONS = ['25', '45', '60', '90'];

function AddPlanDialog({
  open,
  onClose,
  defaultDate,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  onAdded: (date: string) => void;
}) {
  const { profile } = useRequiredProfile();
  const { addPlan } = usePlanner();
  const notify = useToast();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Subject>(profile.subjects[0]);
  const [date, setDate] = useState(defaultDate);
  const [minutes, setMinutes] = useState('45');
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});
  const [lastOpen, setLastOpen] = useState(false);

  // Reset the form each time the dialog opens.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setTitle('');
      setDate(defaultDate);
      setErrors({});
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Say what you will work on, e.g. "Rotational motion — DPP 3".';
    if (!date) next.date = 'Choose a date.';
    else if (date < dayKey()) next.date = 'Pick today or a later date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    addPlan({ title: title.trim(), subject, date, minutes: Number(minutes) });
    notify({ tone: 'success', title: 'Session planned', description: `${fmt.date(fromDayKey(date))} · ${formatMinutes(Number(minutes))}` });
    onAdded(date);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Plan a study session">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="What will you study?" error={errors.title}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="e.g. Electrostatics — NCERT exercises"
              autoFocus
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject">
            {({ id }) => (
              <Select id={id} value={subject} onChange={(e) => setSubject(e.target.value as Subject)}>
                {profile.subjects.map((s) => (
                  <option key={s} value={s}>
                    {SUBJECTS[s].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Date" error={errors.date}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="date"
                min={dayKey()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className="[color-scheme:light]"
              />
            )}
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-fg">Duration (minutes)</p>
          <Segmented label="Duration in minutes" value={minutes} options={DURATIONS.map((d) => ({ value: d, label: d }))} onChange={setMinutes} />
        </div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add to plan</Button>
        </div>
      </form>
    </Dialog>
  );
}
