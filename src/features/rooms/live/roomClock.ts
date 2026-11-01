import type { RoomTimer } from '@/types';

export interface RoomClock {
  status: RoomTimer['status'];
  phase: RoomTimer['phase'];
  remainingMs: number;
  phaseTotalMs: number;
}

/**
 * Where the shared room timer is at `serverNow`. Every client runs the same arithmetic on
 * the same anchor, so rooms stay in step without the server ticking.
 */
export function roomClock(timer: RoomTimer, serverNow: number): RoomClock {
  const focus = timer.focusSeconds;
  const cycle = focus + timer.breakSeconds;
  let position = 0;
  if (timer.status === 'running' && timer.anchor) {
    // Latency can put this device's estimate of server time a moment before a fresh start;
    // treat that as the start of focus, not the end of the previous cycle's break.
    const elapsed = Math.max(0, (serverNow - Date.parse(timer.anchor)) / 1000);
    position = elapsed % cycle;
  } else if (timer.status === 'paused') {
    position = timer.offsetSeconds ?? 0;
  }
  const inFocus = position < focus || timer.breakSeconds === 0;
  const remaining = inFocus ? focus - position : cycle - position;
  return {
    status: timer.status,
    phase: inFocus ? 'focus' : 'break',
    remainingMs: Math.max(0, remaining * 1000),
    phaseTotalMs: (inFocus ? focus : timer.breakSeconds) * 1000,
  };
}

/** Difference between the server's clock and this device's, from a timer payload. */
export function clockSkew(timer: RoomTimer) {
  return Date.parse(timer.serverTime) - Date.now();
}
