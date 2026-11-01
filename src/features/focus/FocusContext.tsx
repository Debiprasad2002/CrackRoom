import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FocusSession, Subject } from '@/types';
import { readJSON, uid, writeJSON } from '@/lib/storage';
import { SUBJECTS } from '@/data/catalog';
import { formatMinutes } from '@/lib/date';
import { USING_SAMPLE_DATA } from '@/services/config';
import { studyService } from '@/services/studyService';
import { useToast } from '@/components/ui/Toast';
import { usePlanner, type SyncStatus } from '@/features/planner/PlannerContext';
import { useAuth } from '@/features/auth/AuthContext';

export interface TimerConfig {
  focusMinutes: number;
  breakMinutes: number;
  subject: Subject | null;
  goal: string;
  roomId: string | null;
  planId: string | null;
}

export type TimerPhase = 'focus' | 'break';
export type TimerStatus = 'idle' | 'running' | 'paused';

export interface TimerState extends TimerConfig {
  phase: TimerPhase;
  status: TimerStatus;
  /** Wall-clock end of the current phase while running. Timestamps keep the timer correct across re-renders and reloads. */
  endsAt: number | null;
  /** Time left while paused or idle. */
  remainingMs: number;
}

export type NewSession = Omit<FocusSession, 'id'> & { clientId?: string };

interface FocusContextValue {
  timer: TimerState;
  sessions: FocusSession[];
  status: SyncStatus;
  reload: () => void;
  /** Logs a block. A repeated clientId is ignored, so several tabs can log the same room block safely. */
  record: (session: NewSession) => void;
  configure: (patch: Partial<TimerConfig>) => void;
  start: (patch?: Partial<TimerConfig>) => void;
  pause: () => void;
  resume: () => void;
  stop: (options: { save: boolean }) => void;
  skipBreak: () => void;
}

const MINUTE = 60_000;

type OutboxItem = Omit<FocusSession, 'id'> & { clientId: string };

function fromOutbox({ clientId, ...session }: OutboxItem): FocusSession {
  return { ...session, id: clientId };
}

/** Keeps the outbox per account without putting an email address in storage keys. */
function hashKey(text: string) {
  let h = 0;
  for (const ch of text) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

const DEFAULT_CONFIG: TimerConfig = {
  focusMinutes: 25,
  breakMinutes: 5,
  subject: null,
  goal: '',
  roomId: null,
  planId: null,
};

function idle(config: TimerConfig): TimerState {
  return { ...config, phase: 'focus', status: 'idle', endsAt: null, remainingMs: config.focusMinutes * MINUTE };
}

export function remainingMs(timer: TimerState, now: number) {
  return timer.status === 'running' && timer.endsAt != null ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
}

export function phaseTotalMs(timer: TimerState) {
  return (timer.phase === 'focus' ? timer.focusMinutes : timer.breakMinutes) * MINUTE;
}

function chime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
    osc.onended = () => ctx.close();
  } catch {
    /* audio unavailable */
  }
}

/**
 * The timer keeps running when CrackRoom is in a background tab. A system notification
 * tells the student a block ended even if they are in another app or tab.
 */
function askToAlert() {
  // Called from the Start button, a user gesture, which browsers require for the prompt.
  if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
}

function alertDevice(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  try {
    new Notification(title, { body, icon: '/favicon.svg', tag: 'crackroom-timer' });
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}

const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const notify = useToast();
  const { markDone } = usePlanner();
  const { user } = useAuth();
  const [timer, setTimer] = useState<TimerState>(() => readJSON<TimerState>('timer', idle(DEFAULT_CONFIG)));
  const [sessions, setSessions] = useState<FocusSession[]>(() => (USING_SAMPLE_DATA ? readJSON<FocusSession[]>('sessions', []) : []));
  const [status, setStatus] = useState<SyncStatus>(USING_SAMPLE_DATA ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const outboxKey = user ? `outbox.${hashKey(user.email)}` : null;

  useEffect(() => writeJSON('timer', timer), [timer]);

  // Sends anything recorded but not yet confirmed by the server. Safe to repeat.
  const flush = useCallback(async () => {
    if (!outboxKey) return;
    const pending = readJSON<OutboxItem[]>(outboxKey, []);
    if (pending.length === 0) return;
    try {
      await studyService.importSessions(pending);
      const sent = new Set(pending.map((p) => p.clientId));
      writeJSON(outboxKey, readJSON<OutboxItem[]>(outboxKey, []).filter((p) => !sent.has(p.clientId)));
    } catch {
      /* stays queued; retried when back online or on the next record */
    }
  }, [outboxKey]);

  useEffect(() => {
    if (USING_SAMPLE_DATA) return;
    let cancelled = false;
    setStatus('loading');
    // Flush first so the list we load already includes sessions from an earlier offline spell.
    flush()
      .then(() => studyService.listSessions())
      .then(
        (list) => {
          if (cancelled) return;
          const queued = outboxKey ? readJSON<OutboxItem[]>(outboxKey, []) : [];
          setSessions([...list, ...queued.map(fromOutbox)]);
          setStatus('ready');
        },
        () => !cancelled && setStatus('error'),
      );
    window.addEventListener('online', flush);
    const interval = window.setInterval(flush, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener('online', flush);
      window.clearInterval(interval);
    };
  }, [attempt, flush, outboxKey]);

  const record = useCallback(
    ({ clientId = uid(), ...session }: NewSession) => {
      setSessions((prev) => {
        if (prev.some((s) => s.id === clientId)) return prev;
        const next = [...prev, { ...session, id: clientId }];
        if (USING_SAMPLE_DATA) writeJSON('sessions', next);
        return next;
      });
      if (USING_SAMPLE_DATA || !outboxKey) return;
      const queue = readJSON<OutboxItem[]>(outboxKey, []);
      if (!queue.some((q) => q.clientId === clientId)) writeJSON(outboxKey, [...queue, { ...session, clientId }]);
      void flush();
    },
    [flush, outboxKey],
  );

  // Phase completion is driven by a single timeout aimed at the phase's end timestamp.
  useEffect(() => {
    if (timer.status !== 'running' || timer.endsAt == null) return;
    const endsAt = timer.endsAt;
    const id = window.setTimeout(() => {
      const t = timerRef.current;
      if (t.status !== 'running' || t.endsAt !== endsAt) return;
      chime();
      if (t.phase === 'focus') {
        record({
          subject: t.subject,
          goal: t.goal,
          minutes: t.focusMinutes,
          completedAt: new Date(endsAt).toISOString(),
          roomId: t.roomId,
          partial: false,
        });
        if (t.planId) markDone(t.planId);
        notify({
          tone: 'success',
          title: `${formatMinutes(t.focusMinutes)} logged`,
          description: `${t.subject ? SUBJECTS[t.subject].label : 'Focus'} block complete. Take your ${formatMinutes(t.breakMinutes)} break.`,
        });
        alertDevice('Focus block complete', `${formatMinutes(t.focusMinutes)} logged. Your ${formatMinutes(t.breakMinutes)} break has started.`);
        setTimer({ ...t, phase: 'break', endsAt: endsAt + t.breakMinutes * MINUTE, remainingMs: t.breakMinutes * MINUTE, planId: null });
      } else {
        notify({ title: 'Break is over', description: 'Start the next focus block when you are ready.' });
        alertDevice('Break is over', 'Start your next focus block when you are ready.');
        setTimer(idle(t));
      }
    }, Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(id);
  }, [timer.status, timer.endsAt, record, markDone, notify]);

  const configure = useCallback((patch: Partial<TimerConfig>) => {
    setTimer((t) => (t.status === 'idle' ? idle({ ...t, ...patch }) : t));
  }, []);

  const start = useCallback((patch: Partial<TimerConfig> = {}) => {
    askToAlert();
    setTimer((t) => {
      if (t.status !== 'idle') return t;
      const config = { ...t, ...patch };
      return { ...idle(config), status: 'running', endsAt: Date.now() + config.focusMinutes * MINUTE };
    });
  }, []);

  const pause = useCallback(() => {
    setTimer((t) =>
      t.status === 'running' && t.endsAt != null
        ? { ...t, status: 'paused', endsAt: null, remainingMs: Math.max(0, t.endsAt - Date.now()) }
        : t,
    );
  }, []);

  const resume = useCallback(() => {
    setTimer((t) => (t.status === 'paused' ? { ...t, status: 'running', endsAt: Date.now() + t.remainingMs } : t));
  }, []);

  const stop = useCallback(
    ({ save }: { save: boolean }) => {
      const t = timerRef.current;
      if (t.status === 'idle') return;
      if (save && t.phase === 'focus') {
        const elapsed = t.focusMinutes * MINUTE - remainingMs(t, Date.now());
        const minutes = Math.floor(elapsed / MINUTE);
        if (minutes >= 1) {
          record({ subject: t.subject, goal: t.goal, minutes, completedAt: new Date().toISOString(), roomId: t.roomId, partial: true });
          notify({ tone: 'success', title: `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} logged`, description: 'Session ended early and saved.' });
        } else {
          notify({ title: 'Session ended', description: 'Less than a minute of focus, so nothing was logged.' });
        }
      }
      setTimer(idle(t));
    },
    [record, notify],
  );

  const skipBreak = useCallback(() => setTimer((t) => (t.phase === 'break' ? idle(t) : t)), []);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({ timer, sessions, status, reload, record, configure, start, pause, resume, stop, skipBreak }),
    [timer, sessions, status, reload, record, configure, start, pause, resume, stop, skipBreak],
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error('useFocus must be used inside FocusProvider');
  return ctx;
}
