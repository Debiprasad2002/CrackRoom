import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { USING_SAMPLE_DATA } from '@/services/config';
import { roomsService, type ReportReason } from '@/services/roomsService';
import { ApiError, errorMessage } from '@/services/http';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'cheating', label: 'Sharing leaked papers or cheating' },
  { value: 'other', label: 'Something else' },
];

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

export function ReportDialog({ open, onClose, roomId, roomName }: ReportDialogProps) {
  const notify = useToast();
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function close() {
    setReason('');
    setDetails('');
    setError(undefined);
    setBusy(false);
    onClose();
  }

  async function submit() {
    if (!reason) {
      setError('Choose a reason so moderators can act quickly.');
      return;
    }
    if (USING_SAMPLE_DATA) {
      // No moderation server in sample mode, so nothing is transmitted; say so instead of pretending.
      notify({
        title: 'Report not sent',
        description: 'Reporting needs the CrackRoom server. For urgent safety issues, leave the room.',
      });
      close();
      return;
    }
    setBusy(true);
    try {
      await roomsService.report(roomId, reason, details.trim());
      notify({ tone: 'success', title: 'Report sent', description: 'Moderators will review it. The host is not told who reported.' });
      close();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        notify({ title: 'Already reported', description: e.message });
        close();
        return;
      }
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Report this room"
      description={`Tell us what is wrong in ${roomName}. Reports are reviewed by moderators and the host is not told who reported.`}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={busy}>
            {busy ? 'Sending…' : 'Submit report'}
          </Button>
        </>
      }
    >
      <fieldset aria-describedby={error ? 'report-error' : undefined}>
        <legend className="mb-2 text-sm font-medium text-fg">Reason</legend>
        <div className="space-y-1.5">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-400',
                reason === r.value ? 'border-violet-400/60 bg-violet-500/[0.08] text-fg' : 'border-line-strong text-fg-muted hover:border-ink-500',
              )}
            >
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => {
                  setReason(r.value);
                  setError(undefined);
                }}
                className="size-4 accent-violet-500"
              />
              {r.label}
            </label>
          ))}
        </div>
        {error && (
          <p id="report-error" className="mt-2 text-xs font-medium text-rose-400">
            {error}
          </p>
        )}
      </fieldset>
      <Field label="Details" hint="Optional. Include what happened and when." className="mt-4">
        {({ id, describedBy }) => (
          <Textarea id={id} aria-describedby={describedBy} value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />
        )}
      </Field>
    </Dialog>
  );
}
