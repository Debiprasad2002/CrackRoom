import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Mail, Trash2 } from 'lucide-react';
import { authService } from '@/services/authService';
import { errorMessage } from '@/services/http';
import { Button } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/Layout';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';

export function AccountSection() {
  const { user, signOut, forget } = useAuth();
  const notify = useToast();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function leave() {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/signin', { replace: true });
    } catch (e) {
      notify({ tone: 'error', title: 'Could not sign out', description: errorMessage(e) });
      setSigningOut(false);
    }
  }

  return (
    <Section title="Account" id="profile-account">
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <Mail className="size-4 shrink-0 text-fg-subtle" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs text-fg-subtle">Signed in with Google as</p>
            <p className="truncate text-sm font-medium text-fg">{user?.email}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-fg-subtle">
          Your email is never shown. Other students see your display name and avatar, plus what you allow under Privacy.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="secondary" size="sm" onClick={leave} disabled={signingOut}>
            <LogOut aria-hidden />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden />
            Delete account
          </Button>
        </div>
      </Card>

      <DeleteDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onDone={() => {
          forget();
          navigate('/signin', { replace: true });
          notify({ title: 'Account deleted', description: 'Your profile, history, plans and messages have been removed.' });
        }}
      />
    </Section>
  );
}

function DeleteDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(open);

  // Reset the form each time the dialog opens.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setTyped('');
      setError(undefined);
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (typed.trim() !== 'DELETE') {
      setError('Type DELETE in capital letters to confirm.');
      return;
    }
    setBusy(true);
    try {
      await authService.deleteAccount();
      onClose();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Delete your account?"
      description="This permanently removes your profile, focus history, plans, room memberships and messages. It cannot be undone. Your Google account is not affected."
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Type DELETE to confirm" error={error}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoFocus
            />
          )}
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? 'Deleting…' : 'Delete everything'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
