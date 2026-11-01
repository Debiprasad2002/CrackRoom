import type { FocusSession, PlannedSession } from '@/types';
import { api } from './http';

type WithClientId<T> = T & { clientId: string };

export interface ImportResult {
  imported: number;
  skipped: number;
}

export const studyService = {
  listSessions() {
    return api<FocusSession[]>('/focus-sessions/');
  },

  /** Idempotent by clientId, so the device outbox can resend safely. */
  importSessions(sessions: WithClientId<Omit<FocusSession, 'id'>>[]) {
    return api<ImportResult>('/focus-sessions/import/', { method: 'POST', body: sessions });
  },

  listPlans() {
    return api<PlannedSession[]>('/plans/');
  },

  createPlan(plan: WithClientId<Omit<PlannedSession, 'id' | 'done'>>) {
    return api<PlannedSession>('/plans/', { method: 'POST', body: plan });
  },

  updatePlan(id: string, patch: Partial<Omit<PlannedSession, 'id'>>) {
    return api<PlannedSession>(`/plans/${encodeURIComponent(id)}/`, { method: 'PATCH', body: patch });
  },

  deletePlan(id: string) {
    return api<void>(`/plans/${encodeURIComponent(id)}/`, { method: 'DELETE' });
  },

  importPlans(plans: WithClientId<Omit<PlannedSession, 'id'>>[]) {
    return api<ImportResult>('/plans/import/', { method: 'POST', body: plans });
  },
};
