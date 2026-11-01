import type { FocusSession, Subject } from '@/types';
import { addDays, dayKey, fromDayKey, startOfWeek } from './date';

export function minutesByDay(sessions: FocusSession[]) {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(new Date(s.completedAt));
    map.set(key, (map.get(key) ?? 0) + s.minutes);
  }
  return map;
}

/** Consecutive days with at least one session, ending today (or yesterday if today is still open). */
export function currentStreak(byDay: Map<string, number>, today = new Date()) {
  let cursor = byDay.has(dayKey(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (byDay.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function bestStreak(byDay: Map<string, number>) {
  const days = [...byDay.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of days) {
    const d = fromDayKey(key);
    run = prev && dayKey(addDays(prev, 1)) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Minutes for each day Monday → Sunday of the week containing `ref`. */
export function weekSeries(byDay: Map<string, number>, ref = new Date()) {
  const start = startOfWeek(ref);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, key: dayKey(date), minutes: byDay.get(dayKey(date)) ?? 0 };
  });
}

export function minutesBySubject(sessions: FocusSession[]) {
  const totals: Partial<Record<Subject | 'general', number>> = {};
  for (const s of sessions) {
    const k = s.subject ?? 'general';
    totals[k] = (totals[k] ?? 0) + s.minutes;
  }
  return totals;
}

export function totalMinutes(sessions: FocusSession[]) {
  return sessions.reduce((sum, s) => sum + s.minutes, 0);
}
