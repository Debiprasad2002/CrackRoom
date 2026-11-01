import { Award, Flame, Hourglass, Medal, Sparkles, Target, type LucideIcon } from 'lucide-react';
import type { FocusSession } from '@/types';
import { bestStreak, minutesByDay, totalMinutes } from '@/lib/stats';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  unlocked: boolean;
  progress: string;
}

/** Every achievement is computed from real logged sessions — nothing is awarded by default. */
export function computeAchievements(sessions: FocusSession[], dailyGoal: number): Achievement[] {
  const byDay = minutesByDay(sessions);
  const best = bestStreak(byDay);
  const hours = totalMinutes(sessions) / 60;
  const goalDays = [...byDay.values()].filter((m) => m >= dailyGoal).length;
  const full = sessions.filter((s) => !s.partial).length;

  return [
    { id: 'first', title: 'First block', description: 'Complete a full focus block', icon: Sparkles, unlocked: full >= 1, progress: `${Math.min(full, 1)}/1` },
    { id: 'streak3', title: 'Three in a row', description: 'Study three days in a row', icon: Flame, unlocked: best >= 3, progress: `${Math.min(best, 3)}/3 days` },
    { id: 'goal', title: 'Goal getter', description: 'Hit your daily goal once', icon: Target, unlocked: goalDays >= 1, progress: `${Math.min(goalDays, 1)}/1` },
    { id: 'hours10', title: 'Ten hours in', description: 'Log ten hours of focus', icon: Hourglass, unlocked: hours >= 10, progress: `${Math.min(hours, 10).toFixed(1)}/10 h` },
    { id: 'streak7', title: 'Full week', description: 'Study seven days in a row', icon: Medal, unlocked: best >= 7, progress: `${Math.min(best, 7)}/7 days` },
    { id: 'sessions50', title: 'Fifty blocks', description: 'Complete fifty full focus blocks', icon: Award, unlocked: full >= 50, progress: `${Math.min(full, 50)}/50` },
  ];
}
