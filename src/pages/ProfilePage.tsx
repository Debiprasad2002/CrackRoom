import { useMemo, useState, type FormEvent } from 'react';
import { HardDrive, ImagePlus, Trash2 } from 'lucide-react';
import type { Exam, Level, Subject } from '@/types';
import { EXAMS, LEVELS, SUBJECTS, SUBJECTS_BY_EXAM, upcomingExamYears } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { currentStreak, minutesByDay, totalMinutes } from '@/lib/stats';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader, Section } from '@/components/ui/Layout';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { Segmented, Toggle } from '@/components/ui/Choice';
import { useToast } from '@/components/ui/Toast';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { ProfileCard } from '@/features/profile/ProfileCard';
import { useFocus } from '@/features/focus/FocusContext';
import { AchievementList } from '@/features/progress/AchievementList';
import { AccountSection } from '@/features/profile/AccountSection';
import { AppearanceSetting } from '@/features/theme/ThemeToggle';
import { AvatarPicker } from '@/features/profile/AvatarPicker';
import { USING_SAMPLE_DATA } from '@/services/config';
import { computeAchievements } from '@/features/progress/achievements';

const GOALS = ['120', '180', '240', '360', '480'];

export default function ProfilePage() {
  const { profile, updateProfile, resetLocalData } = useRequiredProfile();
  const { sessions } = useFocus();
  const notify = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  const byDay = useMemo(() => minutesByDay(sessions), [sessions]);
  const stats = { streak: currentStreak(byDay), minutes: totalMinutes(sessions), sessions: sessions.length };

  function setPrivacy(key: keyof typeof profile.privacy, value: boolean) {
    updateProfile({ privacy: { ...profile.privacy, [key]: value } });
  }

  return (
    <div className="space-y-10">
      <PageHeader title="Profile and settings" description="Your study identity, preferences and what other students can see." />

      <Card className="p-5 sm:p-6">
        <ProfileCard profile={profile} stats={stats} />
        <div className="mt-4 border-t border-line pt-4">
          <Button variant="secondary" size="sm" onClick={() => setPickingAvatar(true)}>
            <ImagePlus aria-hidden />
            Change avatar
          </Button>
        </div>
      </Card>
      <AvatarPicker open={pickingAvatar} onClose={() => setPickingAvatar(false)} />

      <Section title="Achievements" id="profile-achievements">
        <AchievementList items={computeAchievements(sessions, profile.dailyGoalMinutes)} />
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Section title="Study preferences" className="lg:col-span-3" id="profile-prefs">
          <Card className="p-5 sm:p-6">
            <PreferencesForm
              onSaved={() => notify({ tone: 'success', title: 'Preferences saved', description: 'Rooms and notes will follow your new choices.' })}
            />
          </Card>
        </Section>

        <div className="space-y-6 lg:col-span-2">
          <Section title="Appearance" id="profile-appearance">
            <Card className="p-5">
              <AppearanceSetting />
            </Card>
          </Section>

          <Section title="Privacy" id="profile-privacy">
            <Card className="px-5 py-2">
              <div className="divide-y divide-line">
                <Toggle
                  label="Show study stats"
                  description="Streak, hours and session count"
                  checked={profile.privacy.showStats}
                  onChange={(v) => setPrivacy('showStats', v)}
                />
                <Toggle
                  label="Show subjects"
                  description="Your preferred subjects"
                  checked={profile.privacy.showSubjects}
                  onChange={(v) => setPrivacy('showSubjects', v)}
                />
                <Toggle
                  label="Show target year"
                  description="The exam attempt you are aiming for"
                  checked={profile.privacy.showTargetYear}
                  onChange={(v) => setPrivacy('showTargetYear', v)}
                />
              </div>
            </Card>
            <p className="mb-2 mt-5 text-xs font-medium text-fg-subtle">What other students see</p>
            <Card className="border-dashed p-4">
              <ProfileCard profile={profile} stats={stats} publicView />
            </Card>
          </Section>

          {USING_SAMPLE_DATA ? (
            <Section title="Your data" id="profile-data">
              <Card className="p-5">
                <div className="flex gap-3">
                  <HardDrive className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
                  <p className="text-sm text-fg-muted">
                    Everything — profile, sessions, plans and room chat — is stored in this browser only. Clearing it cannot be undone.
                  </p>
                </div>
                <Button variant="danger" className="mt-4" onClick={() => setConfirmReset(true)}>
                  <Trash2 aria-hidden />
                  Clear local data
                </Button>
              </Card>
            </Section>
          ) : (
            <AccountSection />
          )}
        </div>
      </div>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        title="Clear all local data?"
        description="Your profile, focus history, plans and chat on this device will be deleted and you will go through onboarding again."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={resetLocalData}>
              Delete everything
            </Button>
          </>
        }
      />
    </div>
  );
}

function PreferencesForm({ onSaved }: { onSaved: () => void }) {
  const { profile, updateProfile } = useRequiredProfile();
  const [name, setName] = useState(profile.displayName);
  const [exam, setExam] = useState<Exam>(profile.exam);
  const [level, setLevel] = useState<Level>(profile.level);
  const [year, setYear] = useState(profile.targetYear);
  const [subjects, setSubjects] = useState<Subject[]>(profile.subjects);
  const [goal, setGoal] = useState(String(profile.dailyGoalMinutes));
  const [errors, setErrors] = useState<{ name?: string; subjects?: string }>({});

  const years = Array.from(new Set([...upcomingExamYears(), profile.targetYear])).sort();

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const trimmed = name.trim();
    if (trimmed.length < 2) next.name = 'Enter at least 2 characters.';
    else if (trimmed.length > 40) next.name = 'Keep it under 40 characters.';
    if (subjects.length === 0) next.subjects = 'Pick at least one subject.';
    setErrors(next);
    if (Object.keys(next).length) return;
    void updateProfile({ displayName: trimmed, exam, level, targetYear: year, subjects, dailyGoalMinutes: Number(goal) }).then(
      (saved) => saved && onSaved(),
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Display name" error={errors.name}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Exam">
          {({ id }) => (
            <Select
              id={id}
              value={exam}
              onChange={(e) => {
                const x = e.target.value as Exam;
                setExam(x);
                setSubjects((prev) => {
                  const kept = prev.filter((s) => SUBJECTS_BY_EXAM[x].includes(s));
                  return kept.length ? kept : SUBJECTS_BY_EXAM[x];
                });
              }}
            >
              {EXAMS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Level">
          {({ id }) => (
            <Select id={id} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Target year">
          {({ id }) => (
            <Select id={id} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <fieldset aria-describedby={errors.subjects ? 'pref-subjects-error' : undefined}>
        <legend className="mb-2 text-sm font-medium text-fg">Subjects</legend>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS_BY_EXAM[exam].map((s) => {
            const on = subjects.includes(s);
            return (
              <label
                key={s}
                className={cn(
                  'flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-400',
                  on ? 'border-violet-400/60 bg-violet-500/10 text-fg' : 'border-line-strong text-fg-muted hover:border-ink-500',
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={(e) => setSubjects((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))}
                />
                <span className={cn('size-2 rounded-full', SUBJECTS[s].dot)} aria-hidden />
                {SUBJECTS[s].label}
              </label>
            );
          })}
        </div>
        {errors.subjects && (
          <p id="pref-subjects-error" className="mt-2 text-xs font-medium text-rose-400">
            {errors.subjects}
          </p>
        )}
      </fieldset>
      <div>
        <p className="mb-2 text-sm font-medium text-fg">Daily focus goal</p>
        <Segmented
          label="Daily focus goal"
          value={GOALS.includes(goal) ? goal : ''}
          options={GOALS.map((g) => ({ value: g, label: `${Number(g) / 60}h` }))}
          onChange={setGoal}
        />
      </div>
      <div className="flex justify-end border-t border-line pt-5">
        <Button type="submit">Save preferences</Button>
      </div>
    </form>
  );
}
