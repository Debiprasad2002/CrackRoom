import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Coffee, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import type { Room, RoomTimer } from '@/types';
import { SUBJECTS } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { formatClock, formatMinutes } from '@/lib/date';
import { useNow } from '@/hooks/useNow';
import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useToast } from '@/components/ui/Toast';
import { useFocus } from '@/features/focus/FocusContext';
import { roomsService, type TimerAction } from '@/services/roomsService';
import { errorMessage } from '@/services/http';
import { roomClock, type RoomClock } from './roomClock';

const MINUTE = 60_000;
/** Background tabs tick slowly; trust gaps up to this long as continuous presence. */
const MAX_TICK_GAP = 70_000;

/**
 * Logs the focus time this tab actually spent in the room's focus phase. Tabs of the same
 * student derive the same clientId for a block, so the server keeps it once.
 */
function useRoomFocusLog(room: Room, timer: RoomTimer, skew: number, present: boolean, soloBusy: boolean) {
  const { record } = useFocus();
  const acc = useRef({ ms: 0, last: null as number | null });
  const prev = useRef<RoomClock | null>(null);
  const live = useRef({ room, timer, skew, present, soloBusy, record });
  live.current = { room, timer, skew, present, soloBusy, record };
  const roomId = room.id;

  useEffect(() => {
    function finish() {
      const minutes = Math.floor(acc.current.ms / MINUTE);
      acc.current = { ms: 0, last: null };
      if (minutes < 1) return;
      const { room: r, skew: s } = live.current;
      const end = Date.now() + s;
      live.current.record({
        clientId: `room-${r.id}-${Math.round(end / 15_000)}`,
        subject: r.subject === 'mixed' ? null : r.subject,
        goal: r.name.slice(0, 140),
        minutes: Math.min(minutes, r.focusMinutes),
        completedAt: new Date(end).toISOString(),
        roomId: r.id,
        partial: minutes < r.focusMinutes,
      });
    }

    function tick() {
      const { timer: t, skew: s, present: here, soloBusy: busy } = live.current;
      const now = Date.now();
      const clock = roomClock(t, now + s);
      const before = prev.current;
      // A focus block ends when the phase flips to break or the host resets the clock.
      if (before && before.phase === 'focus' && before.status !== 'idle' && (clock.phase === 'break' || clock.status === 'idle')) finish();
      if (here && !busy && clock.status === 'running' && clock.phase === 'focus') {
        if (acc.current.last != null) acc.current.ms += Math.min(now - acc.current.last, MAX_TICK_GAP);
        acc.current.last = now;
      } else {
        acc.current.last = null;
      }
      prev.current = clock;
    }

    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
      tick();
      finish(); // Leaving mid-block still counts what was studied.
    };
  }, [roomId]);
}

interface RoomTimerPanelProps {
  room: Room;
  timer: RoomTimer;
  skew: number;
  present: boolean;
  onTimer: (timer: RoomTimer) => void;
}

export function RoomTimerPanel({ room, timer, skew, present, onTimer }: RoomTimerPanelProps) {
  const notify = useToast();
  const { timer: solo } = useFocus();
  const [busy, setBusy] = useState<TimerAction | null>(null);
  const now = useNow(timer.status === 'running', 250);
  const soloBusy = solo.status !== 'idle';
  useRoomFocusLog(room, timer, skew, present, soloBusy);

  const clock = roomClock(timer, now + skew);
  const isBreak = clock.status !== 'idle' && clock.phase === 'break';
  const canControl = Boolean(room.canControlTimer);

  async function act(action: TimerAction) {
    setBusy(action);
    try {
      onTimer(await roomsService.timer(room.id, action));
    } catch (e) {
      notify({ tone: 'error', title: 'Timer not changed', description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  const statusLabel =
    clock.status === 'idle'
      ? 'Waiting to start'
      : clock.status === 'paused'
        ? isBreak
          ? 'Break paused'
          : 'Paused'
        : isBreak
          ? 'Break'
          : 'Focusing together';

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span
          className={cn(
            'size-2 rounded-full',
            clock.status === 'idle' ? 'bg-fg-subtle' : isBreak ? 'bg-cyan-300' : 'bg-violet-400',
            clock.status === 'running' && 'animate-pulse',
          )}
          aria-hidden
        />
        <span className="text-fg-muted" aria-live="polite">
          Room timer · {statusLabel}
        </span>
      </div>

      <div className="mt-5">
        <ProgressRing
          value={clock.status === 'idle' ? 0 : 1 - clock.remainingMs / clock.phaseTotalMs}
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
              <span
                className={cn('font-semibold leading-none tracking-tight text-fg tabular', clock.remainingMs >= 3_600_000 ? 'text-[2.6rem]' : 'text-[3.5rem]')}
                role="timer"
                aria-label={`${formatClock(clock.remainingMs)} remaining`}
              >
                {formatClock(clock.remainingMs)}
              </span>
              <span className="mt-2 max-w-[11rem] truncate text-sm text-fg-subtle">
                {isBreak ? 'Stretch, water, eyes off the screen' : room.subject === 'mixed' ? 'Mixed subjects' : SUBJECTS[room.subject].label}
              </span>
            </motion.div>
          </AnimatePresence>
        </ProgressRing>
      </div>

      {canControl ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {clock.status === 'idle' && (
            <Button size="lg" onClick={() => act('start')} disabled={busy != null} className="min-w-40">
              <Play aria-hidden />
              Start {formatMinutes(room.focusMinutes)} focus for everyone
            </Button>
          )}
          {clock.status === 'running' && (
            <Button size="lg" variant="secondary" onClick={() => act('pause')} disabled={busy != null} className="min-w-32">
              <Pause aria-hidden />
              Pause
            </Button>
          )}
          {clock.status === 'paused' && (
            <Button size="lg" onClick={() => act('resume')} disabled={busy != null} className="min-w-32">
              <Play aria-hidden />
              Resume
            </Button>
          )}
          {clock.status !== 'idle' && room.breakMinutes > 0 && (
            <Button size="lg" variant="ghost" onClick={() => act('skip')} disabled={busy != null}>
              <SkipForward aria-hidden />
              {isBreak ? 'Skip break' : 'Start break'}
            </Button>
          )}
          {clock.status !== 'idle' && (
            <Button size="lg" variant="ghost" onClick={() => act('reset')} disabled={busy != null}>
              <RotateCcw aria-hidden />
              Reset
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-6 max-w-xs text-center text-sm text-fg-muted">
          {clock.status === 'idle' ? `Waiting for ${room.host} to start the next block.` : `${room.host} runs this room's timer.`}
        </p>
      )}

      <p className="mt-6 max-w-sm text-center text-xs leading-relaxed text-fg-subtle">
        {soloBusy ? (
          <>
            Your <Link to="/focus" className="font-medium text-fg-muted underline-offset-2 hover:underline">solo timer</Link> is running,
            so room blocks are not logged twice. End it to log time with the room.
          </>
        ) : (
          'Synced for everyone in the room. Focus time you spend here is added to your history.'
        )}
      </p>
    </div>
  );
}
