import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { SUBJECTS } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { dayKey, fmt, formatMinutes } from '@/lib/date';
import { Card, PageHeader } from '@/components/ui/Layout';
import { EmptyState, PrototypeNote } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Badge';
import { useFocus } from '@/features/focus/FocusContext';
import { FocusTimerPanel } from '@/features/focus/FocusTimerPanel';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { USING_SAMPLE_DATA } from '@/services/config';

export default function FocusPage() {
  const { sessions } = useFocus();
  const { profile } = useRequiredProfile();
  const today = useMemo(
    () => sessions.filter((s) => dayKey(new Date(s.completedAt)) === dayKey()).reverse(),
    [sessions],
  );
  const todayMinutes = today.reduce((sum, s) => sum + s.minutes, 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Focus timer" description="One subject, one goal, phone away. Breaks start automatically when a block ends." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="px-4 py-8 sm:px-8 sm:py-10">
          <FocusTimerPanel />
        </Card>
        <aside className="space-y-4">
          <Card className="p-5">
            <p className="eyebrow">Today</p>
            <p className="mt-2 text-sm text-fg-muted">
              <span className="text-2xl font-semibold text-fg tabular">{formatMinutes(todayMinutes)}</span> of {formatMinutes(profile.dailyGoalMinutes)} goal
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-600">
              <div
                className="h-full rounded-full bg-violet-500 transition-[width] duration-500"
                style={{ width: `${Math.min(100, (todayMinutes / profile.dailyGoalMinutes) * 100)}%` }}
              />
            </div>
          </Card>
          <Card className="p-2">
            <p className="px-3 pb-1 pt-3 text-sm font-semibold text-fg">Today's sessions</p>
            {today.length === 0 ? (
              <EmptyState className="py-6" icon={<History />} title="No sessions yet today" description="Completed blocks will be listed here." />
            ) : (
              <ul className="divide-y divide-line">
                {today.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className={cn('size-2 shrink-0 rounded-full', s.subject ? SUBJECTS[s.subject].dot : 'bg-fg-subtle')} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-fg">{s.goal || (s.subject ? SUBJECTS[s.subject].label : 'General focus')}</p>
                      <p className="text-xs text-fg-subtle">{fmt.time(s.completedAt)}</p>
                    </div>
                    {s.partial && <Badge>Ended early</Badge>}
                    <span className="text-sm font-medium text-fg tabular">{formatMinutes(s.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Link to="/progress" className="flex items-center px-1 text-[13px] font-medium text-fg-muted hover:text-fg [@media(pointer:coarse)]:min-h-10">
            See your full history →
          </Link>
          {USING_SAMPLE_DATA ? (
            <PrototypeNote>
              The timer keeps time in this browser, even if you switch pages or reload. Sessions are saved on this device until accounts are live.
            </PrototypeNote>
          ) : (
            <p className="px-1 text-xs leading-relaxed text-fg-subtle">
              The timer keeps time in this browser, even if you switch pages or reload. Finished sessions sync to your account, and are
              queued on this device if you go offline.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
