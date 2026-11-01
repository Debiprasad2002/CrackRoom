import type { ChatMessage, PublicProfile, Room, RoomTimer } from '@/types';
import { SAMPLE_ROOMS } from '@/data/sampleRooms';
import { USING_SAMPLE_DATA } from './config';
import { api, apiGet, settle } from './http';

export type RoomInput = Pick<
  Room,
  'name' | 'description' | 'exam' | 'level' | 'subject' | 'mode' | 'visibility' | 'focusMinutes' | 'breakMinutes' | 'capacity' | 'rules'
>;

export type TimerAction = 'start' | 'pause' | 'resume' | 'skip' | 'reset';

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'cheating' | 'other';

export interface SocketTicket {
  ticket: string;
  url: string;
  you: string;
}

const path = (id: string, rest = '') => `/rooms/${encodeURIComponent(id)}/${rest}`;

export const roomsService = {
  async list(): Promise<Room[]> {
    if (USING_SAMPLE_DATA) return settle(SAMPLE_ROOMS);
    return apiGet<Room[]>('/rooms/');
  },

  async get(id: string): Promise<Room | null> {
    if (USING_SAMPLE_DATA) return settle(SAMPLE_ROOMS.find((r) => r.id === id) ?? null);
    try {
      return await apiGet<Room>(path(id));
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
  },

  // Everything below needs the server; the UI only offers it when USING_SAMPLE_DATA is false.
  create: (room: RoomInput) => api<Room>('/rooms/', { method: 'POST', body: room }),
  close: (id: string) => api<void>(path(id), { method: 'DELETE' }),
  join: (id: string, inviteCode?: string) => api<Room>(path(id, 'join/'), { method: 'POST', body: inviteCode ? { inviteCode } : {} }),
  leave: (id: string) => api<void>(path(id, 'leave/'), { method: 'POST' }),
  resetInviteCode: (id: string) => api<Room>(path(id, 'invite-code/'), { method: 'POST' }),
  timer: (id: string, action: TimerAction) => api<RoomTimer>(path(id, 'timer/'), { method: 'POST', body: { action } }),
  socketTicket: (id: string) => api<SocketTicket>(path(id, 'socket-ticket/')),
  messages: (id: string, after?: string | number) =>
    api<ChatMessage[]>(path(id, `messages/${after != null ? `?after=${encodeURIComponent(after)}` : ''}`)),
  sendMessage: (id: string, body: string) => api<ChatMessage>(path(id, 'messages/'), { method: 'POST', body: { body } }),
  person: (id: string, key: string) => api<PublicProfile>(path(id, `people/${encodeURIComponent(key)}/`)),
  report: (id: string, reason: ReportReason, details: string) =>
    api<unknown>(path(id, 'report/'), { method: 'POST', body: { reason, details } }),
};
