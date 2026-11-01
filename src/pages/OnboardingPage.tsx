import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Atom, Stethoscope, UserCheck } from 'lucide-react';
import type { Exam, Level, Profile, Subject } from '@/types';
import { EXAMS, LEVELS, SUBJECTS, SUBJECTS_BY_EXAM, levelLabel, upcomingExamYears } from '@/data/catalog';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { ChoiceCard, Segmented } from '@/components/ui/Choice';
import { Field, Input, Select } from '@/components/ui/Field';
import { PrototypeNote } from '@/components/ui/Feedback';
import { hueFromName } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { useProfile } from '@/features/profile/ProfileContext';
import { useAuth } from '@/features/auth/AuthContext';
import { BrandPanel, FormAlert } from '@/features/auth/AuthLayout';
import { USING_SAMPLE_DATA } from '@/services/config';
import { errorMessage } from '@/services/http';
import { readJSON, removeKey } from '@/lib/storage';
import { cn } from '@/lib/cn';

const STEPS = ['About you', 'Your stage', 'Subjects and goal'] as const;

const GOALS = [
  { value: '120', label: '2h' },
  { value: '180', label: '3h' },
  { value: '240', label: '4h' },
  { value: '360', label: '6h' },
  { value: '480', label: '8h' },
];

function defaultYear(level: Level) {
  const [first] = upcomingExamYears();
  return level === 'class11' ? first + 1 : first;
}

interface Errors {
  name?: string;
  exam?: string;
  level?: string;
  subjects?: string;
}

export default function OnboardingPage() {
  const { saveProfile } = useProfile();
  const notify = useToast();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState('');
  const [exam, setExam] = useState<Exam | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [targetYear, setTargetYear] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [goal, setGoal] = useState('240');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  // A profile made in this browser before the student had an account.
  const [deviceProfile, setDeviceProfile] = useState(() => (USING_SAMPLE_DATA ? null : readJSON<Profile | null>('profile', null)));

  async function finish(profile: Profile, welcomeName: string) {
    setBusy(true);
    setFailure(undefined);
    try {
      await saveProfile(profile);
      if (!USING_SAMPLE_DATA) removeKey('profile');
      notify({ tone: 'success', title: `Welcome to CrackRoom, ${welcomeName.split(' ')[0]}` });
    } catch (error) {
      setFailure(errorMessage(error));
      setBusy(false);
    }
  }

  function applyDeviceProfile() {
    if (!deviceProfile) return;
    // Older device profiles may carry subjects outside the exam; keep only valid ones.
    const subjectsForExam = deviceProfile.subjects.filter((s) => SUBJECTS_BY_EXAM[deviceProfile.exam].includes(s));
    void finish(
      { ...deviceProfile, subjects: subjectsForExam.length ? subjectsForExam : SUBJECTS_BY_EXAM[deviceProfile.exam] },
      deviceProfile.displayName,
    );
  }

  function validate(current: number): Errors {
    const e: Errors = {};
    if (current === 0) {
      const trimmed = name.trim();
      if (trimmed.length < 2) e.name = 'Enter at least 2 characters.';
      else if (trimmed.length > 40) e.name = 'Keep it under 40 characters.';
      if (!exam) e.exam = 'Choose the exam you are preparing for.';
    }
    if (current === 1 && !level) e.level = 'Choose where you are in your preparation.';
    if (current === 2 && subjects.length === 0) e.subjects = 'Pick at least one subject.';
    return e;
  }

  function chooseExam(next: Exam) {
    setExam(next);
    // Default to every subject of the chosen exam; the student can narrow it on step 3.
    setSubjects(SUBJECTS_BY_EXAM[next]);
    setErrors((e) => ({ ...e, exam: undefined }));
  }

  function chooseLevel(next: Level) {
    setLevel(next);
    setTargetYear(defaultYear(next));
    setErrors((e) => ({ ...e, level: undefined }));
  }

  function next(e: FormEvent) {
    e.preventDefault();
    const found = validate(step);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Wait for the error attributes to render before moving focus to the first problem.
      window.setTimeout(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"] input')?.focus();
      }, 0);
      return;
    }
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep(step + 1);
      return;
    }
    const trimmed = name.trim();
    void finish({
      displayName: trimmed,
      exam: exam!,
      level: level!,
      subjects,
      targetYear: targetYear ?? defaultYear(level!),
      dailyGoalMinutes: Number(goal),
      avatarHue: hueFromName(trimmed),
      privacy: { showStats: true, showSubjects: true, showTargetYear: true },
      createdAt: new Date().toISOString(),
    }, trimmed);
  }

  function back() {
    setDirection(-1);
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <BrandPanel />

      <main className="flex flex-col px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 lg:justify-center lg:px-16">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium text-fg">{STEPS[step]}</p>
              <p className="text-fg-subtle tabular">
                Step {step + 1} of {STEPS.length}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden>
              {STEPS.map((s, i) => (
                <div key={s} className="h-1 overflow-hidden rounded-full bg-ink-600">
                  <div
                    className={cn('h-full rounded-full bg-violet-400 transition-[width] duration-500 ease-out', i <= step ? 'w-full' : 'w-0')}
                  />
                </div>
              ))}
            </div>
          </div>

          {deviceProfile && step === 0 && (
            <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-violet-400/30 bg-ink-850 p-4 sm:flex-row sm:items-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                <UserCheck className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">Use the profile saved in this browser?</p>
                <p className="mt-0.5 truncate text-sm text-fg-muted">
                  {deviceProfile.displayName} · {deviceProfile.exam} {deviceProfile.targetYear} · {levelLabel(deviceProfile.level)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDeviceProfile(null)} disabled={busy}>
                  Start fresh
                </Button>
                <Button size="sm" onClick={applyDeviceProfile} disabled={busy}>
                  Use it
                </Button>
              </div>
            </div>
          )}

          {failure && (
            <div className="mb-6">
              <FormAlert>{failure}</FormAlert>
            </div>
          )}

          <form onSubmit={next} noValidate>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {step === 0 && (
                  <div className="space-y-8">
                    <div>
                      <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">Let's set up your study space</h1>
                      <p className="mt-2 text-fg-muted">This shapes the rooms and notes you see first. You can change it any time.</p>
                    </div>
                    <Field label="What should we call you?" error={errors.name} hint="Shown to other students in rooms.">
                      {({ id, describedBy, invalid }) => (
                        <Input
                          id={id}
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (errors.name) setErrors((er) => ({ ...er, name: undefined }));
                          }}
                          aria-describedby={describedBy}
                          aria-invalid={invalid}
                          autoComplete="nickname"
                          placeholder="e.g. Ananya"
                          maxLength={60}
                          autoFocus
                        />
                      )}
                    </Field>
                    <fieldset data-invalid={Boolean(errors.exam)} aria-describedby={errors.exam ? 'exam-error' : undefined}>
                      <legend className="mb-3 text-sm font-medium text-fg">Which exam are you preparing for?</legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {EXAMS.map((x) => (
                          <ChoiceCard
                            key={x.value}
                            type="radio"
                            name="exam"
                            value={x.value}
                            checked={exam === x.value}
                            onChange={() => chooseExam(x.value)}
                            icon={x.value === 'JEE' ? <Atom /> : <Stethoscope />}
                            title={x.label}
                            description={x.description}
                          />
                        ))}
                      </div>
                      {errors.exam && (
                        <p id="exam-error" className="mt-2 text-xs font-medium text-rose-400">
                          {errors.exam}
                        </p>
                      )}
                    </fieldset>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-8">
                    <div>
                      <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">Where are you in your preparation?</h1>
                      <p className="mt-2 text-fg-muted">We'll suggest rooms with students at the same stage.</p>
                    </div>
                    <fieldset data-invalid={Boolean(errors.level)} aria-describedby={errors.level ? 'level-error' : undefined}>
                      <legend className="sr-only">Preparation level</legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {LEVELS.map((l) => (
                          <ChoiceCard
                            key={l.value}
                            type="radio"
                            name="level"
                            value={l.value}
                            checked={level === l.value}
                            onChange={() => chooseLevel(l.value)}
                            title={l.label}
                            description={l.description}
                          />
                        ))}
                      </div>
                      {errors.level && (
                        <p id="level-error" className="mt-2 text-xs font-medium text-rose-400">
                          {errors.level}
                        </p>
                      )}
                    </fieldset>
                    <Field label={`Which ${exam ?? ''} attempt are you targeting?`} hint="Used for countdowns and planning.">
                      {({ id, describedBy }) => (
                        <Select
                          id={id}
                          aria-describedby={describedBy}
                          value={targetYear ?? ''}
                          onChange={(e) => setTargetYear(Number(e.target.value))}
                        >
                          {targetYear == null && <option value="">Choose a year</option>}
                          {upcomingExamYears().map((y) => (
                            <option key={y} value={y}>
                              {exam} {y}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </div>
                )}

                {step === 2 && exam && (
                  <div className="space-y-8">
                    <div>
                      <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">What will you focus on?</h1>
                      <p className="mt-2 text-fg-muted">Choose the subjects you want rooms and notes for.</p>
                    </div>
                    <fieldset data-invalid={Boolean(errors.subjects)} aria-describedby={errors.subjects ? 'subjects-error' : undefined}>
                      <legend className="mb-3 text-sm font-medium text-fg">Preferred subjects</legend>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {SUBJECTS_BY_EXAM[exam].map((s) => (
                          <ChoiceCard
                            key={s}
                            type="checkbox"
                            name="subjects"
                            value={s}
                            checked={subjects.includes(s)}
                            onChange={(on) => {
                              setSubjects((prev) => (on ? [...prev, s] : prev.filter((x) => x !== s)));
                              setErrors((e) => ({ ...e, subjects: undefined }));
                            }}
                            title={
                              <span className="flex items-center gap-2">
                                <span className={cn('size-2 rounded-full', SUBJECTS[s].dot)} aria-hidden />
                                {SUBJECTS[s].label}
                              </span>
                            }
                          />
                        ))}
                      </div>
                      {errors.subjects && (
                        <p id="subjects-error" className="mt-2 text-xs font-medium text-rose-400">
                          {errors.subjects}
                        </p>
                      )}
                    </fieldset>
                    <div>
                      <p className="mb-1 text-sm font-medium text-fg">Daily focus goal</p>
                      <p className="mb-3 text-xs text-fg-subtle">Start realistic — you can raise it once the habit sticks.</p>
                      <Segmented label="Daily focus goal" value={goal} options={GOALS} onChange={setGoal} />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-10 flex items-center justify-between gap-3">
              {step > 0 ? (
                <Button variant="ghost" onClick={back}>
                  <ArrowLeft aria-hidden />
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="lg" disabled={busy}>
                {step === STEPS.length - 1 ? (busy ? 'Setting up…' : 'Enter CrackRoom') : 'Continue'}
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </form>

          {USING_SAMPLE_DATA ? (
            <PrototypeNote className="mt-10">
              Your profile is saved in this browser only. Sign-in and synced accounts arrive with the CrackRoom server.
            </PrototypeNote>
          ) : (
            <SignedInAs />
          )}
        </div>
      </main>
    </div>
  );
}

function SignedInAs() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <p className="mt-10 text-xs text-fg-subtle">
      Signed in as {user.email}.{' '}
      <button type="button" onClick={() => void signOut()} className="font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline">
        Use a different account
      </button>
    </p>
  );
}
