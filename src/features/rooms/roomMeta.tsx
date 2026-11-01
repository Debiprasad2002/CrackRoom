import { Headphones, MessageCircleQuestion, Repeat2, Timer, type LucideIcon } from 'lucide-react';
import type { Profile, Resource, Room, StudyMode } from '@/types';

export const MODE_ICONS: Record<StudyMode, LucideIcon> = {
  pomodoro: Timer,
  silent: Headphones,
  doubt: MessageCircleQuestion,
  revision: Repeat2,
};

/** Higher scores = closer match to the student's exam, class and subjects. Zero means "not for them". */
export function roomRelevance(room: Room, profile: Profile) {
  if (room.exam !== 'both' && room.exam !== profile.exam) return 0;
  let score = 1;
  if (room.level === profile.level) score += 2;
  else if (room.level === 'all') score += 1;
  if (room.subject === 'mixed') score += 1;
  else if (profile.subjects.includes(room.subject)) score += 2;
  if (room.visibility === 'public') score += 1;
  return score;
}

export function resourceRelevance(resource: Resource, profile: Profile) {
  if (resource.exam !== 'both' && resource.exam !== profile.exam) return 0;
  let score = 1;
  if (resource.level === profile.level || resource.level === 'all') score += 2;
  if (profile.subjects.includes(resource.subject)) score += 2;
  return score;
}
