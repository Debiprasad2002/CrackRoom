import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import type { Exam, Level, Room, StudyMode, Subject, Visibility } from '@/types';
import { LEVELS, MODES, SUBJECTS, SUBJECTS_BY_EXAM } from '@/data/catalog';
import { roomsService } from '@/services/roomsService';
import { ApiError, errorMessage } from '@/services/http';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Choice';
import { FormAlert } from '@/features/auth/AuthLayout';
import { DurationPicker } from '@/components/ui/DurationPicker';
import { useRequiredProfile } from '@/features/profile/ProfileContext';

const MAX_FOCUS = 24 * 60;
const MAX_BREAK = 120;
const FOCUS_PRESETS = [
  { minutes: 25, label: '25m' },
  { minutes: 45, label: '45m' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
];
const BREAK_PRESETS = [
  { minutes: 0, label: 'None' },
  { minutes: 5, label: '5m' },
  { minutes: 10, label: '10m' },
  { minutes: 15, label: '15m' },
];
const MAX_RULES = 6;

interface CreateRoomDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (room: Room) => void;
}

export function CreateRoomDialog({ open, onClose, onCreated }: CreateRoomDialogProps) {
  const { profile } = useRequiredProfile();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exam, setExam] = useState<Exam | 'both'>(profile.exam);
  const [level, setLevel] = useState<Level | 'all'>(profile.level);
  const [subject, setSubject] = useState<Subject | 'mixed'>(profile.subjects[0] ?? 'mixed');
  const [mode, setMode] = useState<StudyMode>('pomodoro');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [focus, setFocus] = useState(60);
  const [breakMinutes, setBreak] = useState(10);
  const [capacity, setCapacity] = useState('20');
  const [rules, setRules] = useState<string[]>(['']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setErrors({});
      setFailure(undefined);
      setBusy(false);
    }
  }

  const subjects: Subject[] = exam === 'both' ? ['physics', 'chemistry'] : SUBJECTS_BY_EXAM[exam];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim().length < 3) found.name = 'Give the room a name of at least 3 characters.';
    if (description.trim().length < 10) found.description = 'Describe what the room is for in a sentence.';
    const seats = Number(capacity);
    if (!Number.isInteger(seats) || seats < 2 || seats > 100) found.capacity = 'Between 2 and 100 seats.';
    if (focus < 10 || focus > MAX_FOCUS) found.focusMinutes = 'A focus block can be 10 minutes to 24 hours.';
    if (breakMinutes < 0 || breakMinutes > MAX_BREAK) found.breakMinutes = 'A break can be up to 2 hours.';
    setErrors(found);
    setFailure(undefined);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const room = await roomsService.create({
        name: name.trim(),
        description: description.trim(),
        exam,
        level,
        subject,
        mode,
        visibility,
        focusMinutes: focus,
        breakMinutes,
        capacity: seats,
        rules: rules.map((r) => r.trim()).filter(Boolean),
      });
      setName('');
      setDescription('');
      setRules(['']);
      onCreated(room);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length) setErrors(error.fields);
      setFailure(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Host a study room" description="You run the room's shared timer. Students join from Rooms; private rooms need your invite code.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {failure && <FormAlert>{failure}</FormAlert>}
        <Field label="Room name" error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electrostatics Evening Sprint" aria-describedby={describedBy} aria-invalid={invalid} autoFocus />
          )}
        </Field>
        <Field label="What is it for?" error={errors.description}>
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} value={description} maxLength={280} onChange={(e) => setDescription(e.target.value)} placeholder="Chapter, pace and who should join." aria-describedby={describedBy} aria-invalid={invalid} className="min-h-20" />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Exam">
            {({ id }) => (
              <Select
                id={id}
                value={exam}
                onChange={(e) => {
                  const next = e.target.value as Exam | 'both';
                  setExam(next);
                  const allowed: (Subject | 'mixed')[] = next === 'both' ? ['physics', 'chemistry', 'mixed'] : [...SUBJECTS_BY_EXAM[next], 'mixed'];
                  if (!allowed.includes(subject)) setSubject('mixed');
                }}
              >
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
                <option value="both">JEE + NEET</option>
              </Select>
            )}
          </Field>
          <Field label="Class">
            {({ id }) => (
              <Select id={id} value={level} onChange={(e) => setLevel(e.target.value as Level | 'all')}>
                <option value="all">All classes</option>
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Subject">
            {({ id }) => (
              <Select id={id} value={subject} onChange={(e) => setSubject(e.target.value as Subject | 'mixed')}>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {SUBJECTS[s].label}
                  </option>
                ))}
                <option value="mixed">Mixed</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Study mode" hint={MODES[mode].description}>
            {({ id, describedBy }) => (
              <Select id={id} value={mode} aria-describedby={describedBy} onChange={(e) => setMode(e.target.value as StudyMode)}>
                {(Object.keys(MODES) as StudyMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODES[m].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Seats" error={errors.capacity}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="number" inputMode="numeric" min={2} max={100} value={capacity} onChange={(e) => setCapacity(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
            )}
          </Field>
        </div>
        <DurationPicker
          label="Focus block"
          presets={FOCUS_PRESETS}
          value={focus}
          onChange={(v) => {
            setFocus(v);
            setErrors(({ focusMinutes: _, ...rest }) => rest);
          }}
          withHours
          error={errors.focusMinutes}
          hint="Anything from 10 minutes to 24 hours. Choose Custom for 3h, 90m and so on."
        />
        <DurationPicker
          label="Break between blocks"
          presets={BREAK_PRESETS}
          value={breakMinutes}
          onChange={(v) => {
            setBreak(v);
            setErrors(({ breakMinutes: _, ...rest }) => rest);
          }}
          error={errors.breakMinutes}
          hint="Up to 2 hours. None means one continuous block."
        />
        <div>
          <p className="mb-2 text-sm font-medium text-fg">Who can join</p>
          <Segmented
            label="Room visibility"
            value={visibility}
            options={[
              { value: 'public', label: 'Anyone' },
              { value: 'private', label: 'Invite code' },
            ]}
            onChange={(v) => setVisibility(v as Visibility)}
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">Room rules</legend>
          <div className="space-y-2">
            {rules.map((rule, i) => (
              <div key={i} className="flex gap-2">
                <label htmlFor={`rule-${i}`} className="sr-only">
                  Rule {i + 1}
                </label>
                <Input
                  id={`rule-${i}`}
                  value={rule}
                  maxLength={120}
                  onChange={(e) => setRules((list) => list.map((r, j) => (j === i ? e.target.value : r)))}
                  placeholder={i === 0 ? 'e.g. Mics off during focus blocks' : 'Another rule'}
                />
                {rules.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => setRules((list) => list.filter((_, j) => j !== i))} aria-label={`Remove rule ${i + 1}`}>
                    <X aria-hidden />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {rules.length < MAX_RULES && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setRules((list) => [...list, ''])}>
              <Plus aria-hidden />
              Add a rule
            </Button>
          )}
        </fieldset>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create room'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
