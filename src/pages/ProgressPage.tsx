import { useMemo, useState } from 'react';
import { BarChart3, Play } from 'lucide-react';
import type { FocusSession, Subject } from '@/types';
import { SUBJECTS } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { dayKey, fmt, formatMinutes, fromDayKey } from '@/lib/date';
import { bestStreak, currentStreak, minutesByDay, minutesBySubject, totalMinutes, weekSeries } from '@/lib/stats';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, PageHeader, Section } from '@/components/ui/Layout';
import { EmptyState, PrototypeNote } from '@/components/ui/Feedback';
import { useFocus } from '@/features/focus/FocusContext';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { WeekChart } from '@/features/progress/WeekChart';
import { ConsistencyGrid } from '@/features/progress/ConsistencyGrid';
import { AchievementList } from '@/features/progress/AchievementList';
import { computeAchievements } from '@/features/progress/achievements';
import { USING_SAMPLE_DATA } from '@/services/config';

export default function ProgressPage() {
  const { sessions } = useFocus();
  const { profile } = useRequiredProfile();
  const byDay = useMemo(() => minutesByDay(sessions), [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Progress" description="Your focus history, streaks and subject balance — built only from sessions you actually log." />
        <Card>
          <EmptyState
            className="py-16"
            icon={<BarChart3 />}
            title="No sessions logged yet"
            description="Complete your first focus block and this page will start tracking your weekly trend, streak and subject balance."
            action={
              <ButtonLink to="/focus">
                <Play aria-hidden />
                Start a focus block
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  const week = weekSeries(byDay);
  const weekMinutes = week.reduce((s, d) => s + d.minutes, 0);

  return (
    <div className="space-y-10">
      <PageHeader title="Progress" description="Your focus history, streaks and subject balance — built only from sessions you actually log." />

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Total focus" value={formatMinutes(totalMinutes(sessions))} />
        <StatTile label="This week" value={formatMinutes(weekMinutes)} />
        <StatTile label="Current streak" value={`${currentStreak(byDay)} days`} />
        <StatTile label="Best streak" value={`${bestStreak(byDay)} days`} />
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Section title="Focus this week" className="lg:col-span-3" id="progress-week">
          <Card className="p-5 pt-6">
            <WeekChart days={week} goalMinutes={profile.dailyGoalMinutes} height={200} title="Focus minutes per day this week" />
          </Card>
        </Section>
        <Section title="Subject balance" className="lg:col-span-2" id="progress-subjects">
          <Card className="p-5">
            <SubjectBalance sessions={sessions} />
          </Card>
        </Section>
      </div>

      <Section title="Consistency" id="progress-consistency">
        <Card className="p-5">
          <ConsistencyGrid byDay={byDay} goal={profile.dailyGoalMinutes} />
        </Card>
      </Section>

      <Section title="Achievements" id="progress-achievements">
        <AchievementList items={computeAchievements(sessions, profile.dailyGoalMinutes)} />
      </Section>

      <Section title="History" id="progress-history">
        <History sessions={sessions} />
      </Section>

      {USING_SAMPLE_DATA && (
        <PrototypeNote>Your history is stored in this browser only. It will move to your account once sign-in is available.</PrototypeNote>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-4 sm:p-5">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-1.5 text-2xl font-semibold text-fg tabular">{value}</dd>
    </div>
  );
}

function SubjectBalance({ sessions }: { sessions: FocusSession[] }) {
  const totals = minutesBySubject(sessions);
  const rows = (Object.entries(totals) as [Subject | 'general', number][]).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map(([, m]) => m));
  const sum = rows.reduce((s, [, m]) => s + m, 0);

  return (
    <ul className="space-y-4">
      {rows.map(([key, minutes]) => {
        const label = key === 'general' ? 'General' : SUBJECTS[key].label;
        const color = key === 'general' ? '#5A6585' : SUBJECTS[key].color;
        return (
          <li key={key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-medium text-fg">
                <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
                {label}
              </span>
              <span className="text-fg-muted tabular">
                {formatMinutes(minutes)} <span className="text-fg-subtle">· {Math.round((minutes / sum) * 100)}%</span>
              </span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-ink-700" aria-hidden>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(minutes / max) * 100}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function History({ sessions }: { sessions: FocusSession[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, FocusSession[]>();
    for (const s of [...sessions].reverse()) {
      const k = dayKey(new Date(s.completedAt));
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()];
  }, [sessions]);
  const [shown, setShown] = useState(5);

  return (
    <div className="space-y-4">
      {groups.slice(0, shown).map(([day, list]) => (
        <Card key={day} className="p-2">
          <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
            <p className="text-sm font-semibold text-fg">
              {day === dayKey() ? 'Today' : `${fmt.weekday(fromDayKey(day))}, ${fmt.short(fromDayKey(day))}`}
            </p>
            <p className="text-sm text-fg-muted tabular">{formatMinutes(list.reduce((s, x) => s + x.minutes, 0))}</p>
          </div>
          <ul className="divide-y divide-line">
            {list.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className={cn('size-2 shrink-0 rounded-full', s.subject ? SUBJECTS[s.subject].dot : 'bg-fg-subtle')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{s.goal || (s.subject ? SUBJECTS[s.subject].label : 'General focus')}</p>
                  <p className="text-xs text-fg-subtle">
                    {fmt.time(s.completedAt)}
                    {s.subject && s.goal ? ` · ${SUBJECTS[s.subject].label}` : ''}
                    {s.roomId ? ' · in a room' : ''}
                  </p>
                </div>
                {s.partial && <Badge>Ended early</Badge>}
                <span className="text-sm font-medium text-fg tabular">{formatMinutes(s.minutes)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {groups.length > shown && (
        <Button variant="secondary" className="w-full" onClick={() => setShown((n) => n + 7)}>
          Show earlier days
        </Button>
      )}
    </div>
  );
}
