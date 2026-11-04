import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Coffee, Pause, Play, Timer } from 'lucide-react';
import { SUBJECTS } from '@/data/catalog';
import { formatClock } from '@/lib/date';
import { useNow } from '@/hooks/useNow';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { phaseTotalMs, remainingMs, useFocus } from './FocusContext';

/**
 * The running timer, kept on screen while the student moves around the app.
 * Hidden on the Focus page, which already shows the full timer.
 */
export function FloatingTimer() {
  const { timer, pause, resume } = useFocus();
  const { pathname } = useLocation();
  const now = useNow(timer.status === 'running', 1000);
  const visible = timer.status !== 'idle' && pathname !== '/focus';

  const isBreak = timer.phase === 'break';
  const left = remainingMs(timer, now);
  const total = phaseTotalMs(timer);
  const label = timer.status === 'paused' ? 'Paused' : isBreak ? 'Break' : 'Focusing';
  const detail = isBreak ? 'Stretch and hydrate' : timer.subject ? SUBJECTS[timer.subject].label : timer.goal || 'General focus';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-3 z-30 md:bottom-6 md:left-[7rem] xl:left-[17.5rem]"
        >
          <div className="flex items-center gap-1 rounded-2xl border border-line-strong bg-ink-800/95 p-1.5 pr-2 shadow-pop backdrop-blur-xl">
            <Link to="/focus" className="flex items-center gap-3 rounded-xl py-0.5 pl-0.5 pr-2 hover:bg-ink-700" aria-label={`${label}, ${formatClock(left)} left. Open focus timer`}>
              <ProgressRing value={1 - left / total} size={44} stroke={4} color={isBreak ? 'rgb(var(--cyan-400))' : 'rgb(var(--violet-400))'} label={`${label} progress`}>
                {isBreak ? <Coffee className="size-4 text-cyan-300" aria-hidden /> : <Timer className="size-4 text-violet-300" aria-hidden />}
              </ProgressRing>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">{label}</span>
                <span className="block text-lg font-semibold leading-tight text-fg tabular">{formatClock(left)}</span>
                <span className="block max-w-[9rem] truncate text-xs text-fg-muted">{detail}</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={timer.status === 'running' ? pause : resume}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white shadow-card transition-colors hover:bg-violet-600"
              aria-label={timer.status === 'running' ? 'Pause timer' : 'Resume timer'}
            >
              {timer.status === 'running' ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
