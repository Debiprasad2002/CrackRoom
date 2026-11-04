import type { NotificationPage } from '@/types';
import { api } from './http';

export const notificationsService = {
  list: (before?: number | null) => api<NotificationPage>(`/notifications/${before ? `?before=${before}` : ''}`),
  markRead: (id: number) => api<void>(`/notifications/${id}/read/`, { method: 'POST' }),
  markAllRead: () => api<void>('/notifications/read-all/', { method: 'POST' }),
};
