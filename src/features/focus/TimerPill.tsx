import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/date';
import { useNow } from '@/hooks/useNow';
import { remainingMs, useFocus } from './FocusContext';

/** Compact, always-visible timer status that links back to the focus screen. */
export function TimerPill({ className, hideWhenIdle = false }: { className?: string; hideWhenIdle?: boolean }) {
  const { timer } = useFocus();
  const active = timer.status !== 'idle';
  const now = useNow(timer.status === 'running', 1000);

  if (!active) {
    if (hideWhenIdle) return null;
    return (
      <Link
        to="/focus"
        className={cn('inline-flex size-10 items-center justify-center rounded-xl text-fg-muted hover:bg-ink-700 hover:text-fg', className)}
        aria-label="Open focus timer"
      >
        <Timer className="size-[18px]" aria-hidden />
      </Link>
    );
  }

  const isBreak = timer.phase === 'break';
  return (
    <Link
      to="/focus"
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium tabular transition-colors',
        isBreak ? 'border-cyan-300/25 bg-cyan-300/[0.07] text-cyan-300' : 'border-violet-400/30 bg-violet-500/10 text-violet-300',
        className,
      )}
      aria-label={`${isBreak ? 'Break' : 'Focus'} ${timer.status === 'paused' ? 'paused' : 'running'}, ${formatClock(remainingMs(timer, now))} left. Open focus timer`}
    >
      <span
        className={cn('size-1.5 rounded-full', isBreak ? 'bg-cyan-300' : 'bg-violet-400', timer.status === 'running' && 'animate-pulse')}
        aria-hidden
      />
      {formatClock(remainingMs(timer, now))}
      {timer.status === 'paused' && <span className="text-xs font-normal text-fg-muted">paused</span>}
    </Link>
  );
}

/** Mirrors the running timer in the browser tab title. */
export function TimerDocumentTitle() {
  const { timer } = useFocus();
  const now = useNow(timer.status === 'running', 1000);
  useEffect(() => {
    document.title =
      timer.status === 'idle'
        ? 'CrackRoom'
        : `${formatClock(remainingMs(timer, now))} · ${timer.phase === 'break' ? 'Break' : 'Focus'} — CrackRoom`;
  }, [timer, now]);
  return null;
}
