import type { MentorBooking, MentorCard, MentorDetail, MentorOwnSlot, MentorSelf } from '@/types';
import { api } from './http';

export const mentorshipService = {
  mentors: () => api<MentorCard[]>('/mentors/'),

  async mentor(id: string): Promise<MentorDetail | null> {
    try {
      return await api<MentorDetail>(`/mentors/${encodeURIComponent(id)}/`);
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
  },

  book: (slotId: number, topic: string) => api<MentorBooking>(`/mentorship/slots/${slotId}/book/`, { method: 'POST', body: { topic } }),
  bookings: () => api<MentorBooking[]>('/mentorship/bookings/'),
  cancel: (bookingId: number) => api<MentorBooking>(`/mentorship/bookings/${bookingId}/cancel/`, { method: 'POST' }),

  // Mentor tools
  me: () => api<MentorSelf & { slots: MentorOwnSlot[] }>('/mentorship/me/'),
  updateMe: (patch: Partial<Omit<MentorSelf, 'id' | 'name' | 'isVerified' | 'isActive' | 'slots'>>) =>
    api<MentorSelf>('/mentorship/me/', { method: 'PATCH', body: patch }),
  publishSlots: (startsAt: string[]) => api<MentorOwnSlot[]>('/mentorship/me/slots/', { method: 'POST', body: { startsAt } }),
  removeSlot: (slotId: number) => api<void>(`/mentorship/me/slots/${slotId}/`, { method: 'DELETE' }),
};
