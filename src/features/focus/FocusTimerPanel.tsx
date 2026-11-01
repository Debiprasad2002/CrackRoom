import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Coffee, Pause, Play, SkipForward, Square } from 'lucide-react';
import type { Subject } from '@/types';
import { SUBJECTS } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { formatClock, formatMinutes } from '@/lib/date';
import { useNow } from '@/hooks/useNow';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { DurationPicker } from '@/components/ui/DurationPicker';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { phaseTotalMs, remainingMs, useFocus } from './FocusContext';

const MAX_FOCUS = 24 * 60;
const MAX_BREAK = 120;
const FOCUS_PRESETS = [
  { minutes: 25, label: '25m' },
  { minutes: 45, label: '45m' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
];
const BREAK_PRESETS = [
  { minutes: 5, label: '5m' },
  { minutes: 10, label: '10m' },
  { minutes: 15, label: '15m' },
];

interface FocusTimerPanelProps {
  /** When set, the panel belongs to a room and starts sessions tagged with it. */
  room?: { id: string; name: string; focusMinutes: number; breakMinutes: number; subject?: Subject };
}

export function FocusTimerPanel({ room }: FocusTimerPanelProps) {
  const { profile } = useRequiredProfile();
  const { timer, configure, start, pause, resume, stop, skipBreak } = useFocus();
  const [confirmStop, setConfirmStop] = useState(false);
  const now = useNow(timer.status === 'running', 250);

  const busyElsewhere = timer.status !== 'idle' && (room ? timer.roomId !== room.id : false);
  if (busyElsewhere) {
    return (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <p className="font-medium text-fg">You already have a session running</p>
        <p className="mt-1 max-w-xs text-sm text-fg-muted">
          {formatClock(remainingMs(timer, now))} left in your current {timer.phase}. Finish or end it before starting one here.
        </p>
        <Link to="/focus" className="mt-4 text-sm font-medium text-violet-300 hover:text-violet-700">
          Go to that session
        </Link>
      </div>
    );
  }

  // In a room, idle settings follow the room's rhythm.
  const focusMinutes = room && timer.status === 'idle' ? room.focusMinutes : timer.focusMinutes;
  const breakMinutes = room && timer.status === 'idle' ? room.breakMinutes : timer.breakMinutes;
  const total = timer.status === 'idle' ? focusMinutes * 60_000 : phaseTotalMs(timer);
  const left = timer.status === 'idle' ? total : remainingMs(timer, now);
  const isBreak = timer.phase === 'break' && timer.status !== 'idle';
  const elapsedMinutes = Math.floor((total - left) / 60_000);

  function begin() {
    start(
      room
        ? {
            roomId: room.id,
            focusMinutes: room.focusMinutes,
            breakMinutes: room.breakMinutes,
            planId: null,
            subject: timer.subject ?? room.subject ?? null,
          }
        : { roomId: null },
    );
  }

  const statusLabel =
    timer.status === 'idle' ? 'Ready' : isBreak ? (timer.status === 'paused' ? 'Break paused' : 'Break') : timer.status === 'paused' ? 'Paused' : 'Focusing';

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span
          className={cn(
            'size-2 rounded-full',
            timer.status === 'idle' ? 'bg-fg-subtle' : isBreak ? 'bg-cyan-300' : 'bg-violet-400',
            timer.status === 'running' && 'animate-pulse',
          )}
          aria-hidden
        />
        <span className="text-fg-muted" aria-live="polite">
          {statusLabel}
        </span>
      </div>

      <div className="mt-5">
        <ProgressRing
          value={timer.status === 'idle' ? 0 : 1 - left / total}
          size={248}
          stroke={8}
          color={isBreak ? '#0891B2' : '#7C3AED'}
          label={`${isBreak ? 'Break' : 'Focus'} progress`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isBreak ? 'break' : 'focus'}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
            >
              {isBreak && <Coffee className="mb-1 size-5 text-cyan-300" aria-hidden />}
              <span className={cn('font-semibold leading-none tracking-tight text-fg tabular', left >= 3_600_000 ? 'text-[2.6rem]' : 'text-[3.5rem]')} role="timer" aria-label={`${formatClock(left)} remaining`}>
                {formatClock(left)}
              </span>
              <span className="mt-2 max-w-[11rem] truncate text-sm text-fg-subtle">
                {isBreak ? 'Stretch, water, eyes off the screen' : timer.subject ? SUBJECTS[timer.subject].label : 'General focus'}
              </span>
            </motion.div>
          </AnimatePresence>
        </ProgressRing>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {timer.status === 'idle' && (
          <Button size="lg" onClick={begin} className="min-w-40">
            <Play aria-hidden />
            Start {formatMinutes(focusMinutes)} focus
          </Button>
        )}
        {timer.status === 'running' && (
          <Button size="lg" variant="secondary" onClick={pause} className="min-w-32">
            <Pause aria-hidden />
            Pause
          </Button>
        )}
        {timer.status === 'paused' && (
          <Button size="lg" onClick={resume} className="min-w-32">
            <Play aria-hidden />
            Resume
          </Button>
        )}
        {timer.status !== 'idle' && !isBreak && (
          <Button size="lg" variant="ghost" onClick={() => setConfirmStop(true)}>
            <Square aria-hidden />
            End session
          </Button>
        )}
        {isBreak && (
          <Button size="lg" variant="ghost" onClick={skipBreak}>
            <SkipForward aria-hidden />
            Skip break
          </Button>
        )}
      </div>

      {timer.status === 'idle' && (
        <div className="mt-8 w-full max-w-md space-y-5 border-t border-line pt-6">
          {!room && (
            <div className="space-y-5">
              <DurationPicker
                label="Focus block"
                presets={FOCUS_PRESETS}
                value={focusMinutes}
                onChange={(v) => configure({ focusMinutes: Math.min(MAX_FOCUS, Math.max(1, v)) })}
                withHours
                hint="Up to 24 hours. Choose Custom to set hours and minutes."
              />
              <DurationPicker
                label="Break"
                presets={BREAK_PRESETS}
                value={breakMinutes}
                onChange={(v) => configure({ breakMinutes: Math.min(MAX_BREAK, Math.max(1, v)) })}
                hint="Up to 2 hours."
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject">
              {({ id }) => (
                <Select
                  id={id}
                  value={timer.subject ?? ''}
                  onChange={(e) => configure({ subject: (e.target.value || null) as Subject | null })}
                >
                  <option value="">General</option>
                  {profile.subjects.map((s) => (
                    <option key={s} value={s}>
                      {SUBJECTS[s].label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Goal for this block" hint="Optional">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={timer.goal}
                  maxLength={80}
                  onChange={(e) => configure({ goal: e.target.value })}
                  placeholder="e.g. 15 rotation problems"
                />
              )}
            </Field>
          </div>
        </div>
      )}

      <Dialog
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        title="End this session?"
        size="sm"
        description={
          elapsedMinutes >= 1
            ? `You've focused for ${formatMinutes(elapsedMinutes)}. Save it to your history, or discard it.`
            : 'Less than a minute has passed, so there is nothing to save yet.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmStop(false)}>
              Keep going
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                stop({ save: false });
                setConfirmStop(false);
              }}
            >
              Discard
            </Button>
            {elapsedMinutes >= 1 && (
              <Button
                onClick={() => {
                  stop({ save: true });
                  setConfirmStop(false);
                }}
              >
                Save {formatMinutes(elapsedMinutes)}
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
