import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PlannedSession } from '@/types';
import { readJSON, uid, writeJSON } from '@/lib/storage';
import { USING_SAMPLE_DATA } from '@/services/config';
import { studyService } from '@/services/studyService';
import { errorMessage } from '@/services/http';
import { useToast } from '@/components/ui/Toast';

export type SyncStatus = 'loading' | 'ready' | 'error';

interface PlannerContextValue {
  plans: PlannedSession[];
  status: SyncStatus;
  reload: () => void;
  addPlan: (plan: Omit<PlannedSession, 'id' | 'done'>) => void;
  toggleDone: (id: string) => void;
  markDone: (id: string) => void;
  removePlan: (id: string) => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const notify = useToast();
  const [plans, setPlans] = useState<PlannedSession[]>(() => (USING_SAMPLE_DATA ? readJSON<PlannedSession[]>('plans', []) : []));
  const [status, setStatus] = useState<SyncStatus>(USING_SAMPLE_DATA ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);
  const plansRef = useRef(plans);
  plansRef.current = plans;

  useEffect(() => {
    if (USING_SAMPLE_DATA) return;
    let cancelled = false;
    setStatus('loading');
    studyService.listPlans().then(
      (list) => {
        if (cancelled) return;
        setPlans(list);
        setStatus('ready');
      },
      () => !cancelled && setStatus('error'),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const commit = useCallback((update: (prev: PlannedSession[]) => PlannedSession[]) => {
    setPlans((prev) => {
      const next = update(prev);
      if (USING_SAMPLE_DATA) writeJSON('plans', next);
      return next;
    });
  }, []);

  /** Optimistic server write: apply now, undo and explain if the server refuses. */
  const sync = useCallback(
    (undo: () => void, request: () => Promise<unknown>, failure: string) => {
      if (USING_SAMPLE_DATA) return;
      request().catch((e) => {
        undo();
        notify({ tone: 'error', title: failure, description: errorMessage(e) });
      });
    },
    [notify],
  );

  const setDone = useCallback(
    (id: string, done: (current: boolean) => boolean) => {
      const plan = plansRef.current.find((p) => p.id === id);
      if (!plan) return;
      const next = done(plan.done);
      if (next === plan.done) return;
      commit((prev) => prev.map((p) => (p.id === id ? { ...p, done: next } : p)));
      sync(
        () => commit((prev) => prev.map((p) => (p.id === id ? { ...p, done: plan.done } : p))),
        () => studyService.updatePlan(id, { done: next }),
        'Plan not updated',
      );
    },
    [commit, sync],
  );

  const value = useMemo<PlannerContextValue>(
    () => ({
      plans,
      status,
      reload: () => setAttempt((n) => n + 1),
      addPlan: (plan) => {
        const clientId = uid();
        commit((prev) => [...prev, { ...plan, id: clientId, done: false }]);
        if (USING_SAMPLE_DATA) return;
        studyService.createPlan({ ...plan, clientId }).then(
          (saved) => commit((prev) => prev.map((p) => (p.id === clientId ? saved : p))),
          (e) => {
            commit((prev) => prev.filter((p) => p.id !== clientId));
            notify({ tone: 'error', title: 'Plan not saved', description: errorMessage(e) });
          },
        );
      },
      toggleDone: (id) => setDone(id, (current) => !current),
      markDone: (id) => setDone(id, () => true),
      removePlan: (id) => {
        const index = plansRef.current.findIndex((p) => p.id === id);
        const plan = plansRef.current[index];
        if (!plan) return;
        commit((prev) => prev.filter((p) => p.id !== id));
        sync(
          () => commit((prev) => [...prev.slice(0, index), plan, ...prev.slice(index)]),
          () => studyService.deletePlan(id),
          'Plan not removed',
        );
      },
    }),
    [plans, status, commit, sync, setDone, notify],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used inside PlannerProvider');
  return ctx;
}
