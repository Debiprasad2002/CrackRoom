import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { AVATAR_BY_KEY, ICON_AVATARS, ILLUSTRATED } from '@/data/avatars';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { useRequiredProfile } from './ProfileContext';

/** Illustrated characters first, then icon avatars and initials. Saves when confirmed. */
export function AvatarPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, updateProfile } = useRequiredProfile();
  const notify = useToast();
  const [choice, setChoice] = useState(profile.avatar ?? '');
  const [lastOpen, setLastOpen] = useState(open);
  const [busy, setBusy] = useState(false);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setChoice(profile.avatar ?? '');
  }

  async function save() {
    setBusy(true);
    const saved = await updateProfile({ avatar: choice });
    setBusy(false);
    if (saved) {
      notify({ tone: 'success', title: 'Avatar updated', description: 'Other students see it in rooms and the community.' });
      onClose();
    }
  }

  function option(key: string, label: string, large = false) {
    const on = key === choice;
    return (
      <button
        key={key || 'initials'}
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={label}
        title={label}
        onClick={() => setChoice(key)}
        className={cn(
          'group relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-1.5 transition-[transform,border-color,background-color] active:scale-95',
          on ? 'border-violet-500 bg-violet-500/10' : 'border-transparent hover:border-line-strong',
        )}
      >
        <Avatar
          name={profile.displayName}
          hue={profile.avatarHue}
          avatar={key}
          size={large ? 'lg' : 'md'}
          className={large ? 'size-[4.5rem] sm:size-20' : 'sm:size-12'}
        />
        {large && <span className={cn('text-xs font-medium', on ? 'text-violet-300' : 'text-fg-muted')}>{label}</span>}
        {on && (
          <span className="absolute right-0 top-0 flex size-5 items-center justify-center rounded-full bg-violet-500 text-white ring-2 ring-ink-800">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
        )}
      </button>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Choose your avatar"
      description="Pick a picture that feels like you. You can change it any time."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || choice === (profile.avatar ?? '')}>
            {busy ? 'Saving…' : 'Save avatar'}
          </Button>
        </>
      }
    >
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-line bg-ink-850 p-4">
        <Avatar name={profile.displayName} hue={profile.avatarHue} avatar={choice} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">{profile.displayName}</p>
          <p className="text-sm text-fg-muted">{choice ? AVATAR_BY_KEY[choice]?.label : 'Initials'}</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Avatar" className="space-y-5">
        <Group title="Illustrated" className="grid-cols-4">
          {ILLUSTRATED.map((a) => option(a.key, a.label, true))}
        </Group>
        <Group title="Icons" className="grid-cols-5 sm:grid-cols-6">
          {option('', 'Initials')}
          {ICON_AVATARS.map((a) => option(a.key, a.label))}
        </Group>
      </div>
    </Dialog>
  );
}

function Group({ title, className, children }: { title: string; className: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{title}</h3>
      <div className={cn('grid gap-2', className)}>{children}</div>
    </section>
  );
}
