import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import type { FocusSession, PlannedSession } from '@/types';
import { readJSON, removeKey, writeJSON } from '@/lib/storage';
import { USING_SAMPLE_DATA } from '@/services/config';
import { studyService } from '@/services/studyService';
import { errorMessage } from '@/services/http';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { useToast } from '@/components/ui/Toast';
import { useFocus } from '@/features/focus/FocusContext';
import { usePlanner } from '@/features/planner/PlannerContext';

const DISMISSED = 'importDismissed';

/**
 * History recorded before the student had an account lives under the old local keys.
 * Offer it once; importing is idempotent, so a retry after a failure is safe.
 */
export function LocalImportPrompt() {
  const notify = useToast();
  const focus = useFocus();
  const planner = usePlanner();
  const [sessions] = useState(() => (USING_SAMPLE_DATA ? [] : readJSON<FocusSession[]>('sessions', [])));
  const [plans] = useState(() => (USING_SAMPLE_DATA ? [] : readJSON<PlannedSession[]>('plans', [])));
  const [hidden, setHidden] = useState(() => readJSON<boolean>(DISMISSED, false));
  const [busy, setBusy] = useState(false);

  if (hidden || (sessions.length === 0 && plans.length === 0)) return null;

  async function bringOver() {
    setBusy(true);
    try {
      if (sessions.length) {
        await studyService.importSessions(
          // Sample rooms do not exist on the server, so their tags are dropped; values are kept within server limits.
          sessions
            .filter((s) => s.minutes >= 1)
            .map(({ id, ...s }) => ({
              ...s,
              minutes: Math.min(24 * 60, Math.round(s.minutes)),
              subject: s.subject ?? null,
              goal: (s.goal ?? '').slice(0, 140),
              roomId: null,
              clientId: `local-${id}`,
            })),
        );
      }
      if (plans.length) {
        await studyService.importPlans(plans.map(({ id, ...p }) => ({ ...p, title: p.title.slice(0, 80), clientId: `local-${id}` })));
      }
      removeKey('sessions');
      removeKey('plans');
      setHidden(true);
      focus.reload();
      planner.reload();
      notify({ tone: 'success', title: 'History added to your account', description: 'It now syncs across your devices.' });
    } catch (e) {
      notify({ tone: 'error', title: 'Import did not finish', description: errorMessage(e) });
      setBusy(false);
    }
  }

  function dismiss() {
    writeJSON(DISMISSED, true);
    setHidden(true);
  }

  const parts = [
    sessions.length && `${sessions.length} focus ${sessions.length === 1 ? 'session' : 'sessions'}`,
    plans.length && `${plans.length} planned ${plans.length === 1 ? 'session' : 'sessions'}`,
  ].filter(Boolean);

  return (
    <Card className="mb-6 flex flex-col gap-4 border-violet-400/30 p-4 sm:flex-row sm:items-center sm:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
        <UploadCloud className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">Bring your history from this browser</p>
        <p className="mt-0.5 text-sm text-fg-muted">
          {parts.join(' and ')} were saved here before you had an account. Add them so your streak and stats include them.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" onClick={dismiss} disabled={busy}>
          Not now
        </Button>
        <Button onClick={bringOver} disabled={busy}>
          {busy ? 'Adding…' : 'Add to my account'}
        </Button>
      </div>
    </Card>
  );
}
