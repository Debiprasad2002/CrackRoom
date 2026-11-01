import type { ReactNode } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import type { Room } from '@/types';
import { MIXED_TILE, MODES, SUBJECTS, examLabel, levelLabel } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { formatMinutes } from '@/lib/date';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, SubjectTag } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Layout';
import { MODE_ICONS } from './roomMeta';

export function RoomHeading({ room, actions }: { room: Room; actions?: ReactNode }) {
  const ModeIcon = MODE_ICONS[room.mode];
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 gap-4">
        <span
          className={cn(
            'hidden size-14 shrink-0 items-center justify-center rounded-2xl border sm:flex',
            room.subject === 'mixed' ? MIXED_TILE : SUBJECTS[room.subject].tile,
          )}
          aria-hidden
        >
          <ModeIcon className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[1.625rem] font-semibold leading-tight sm:text-[2rem]">{room.name}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone="violet">{examLabel(room.exam)}</Badge>
            <span className="text-xs font-medium text-fg-muted">{levelLabel(room.level)}</span>
            <SubjectTag subject={room.subject} />
            <Badge>
              <ModeIcon aria-hidden />
              {MODES[room.mode].label}
            </Badge>
            {room.visibility === 'private' ? (
              <Badge>
                <Lock aria-hidden />
                Private
              </Badge>
            ) : (
              <Badge>Public</Badge>
            )}
          </div>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function RoomFacts({ room }: { room: Room }) {
  return (
    <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-line py-5 sm:grid-cols-4">
      <Stat label="Focus block" value={formatMinutes(room.focusMinutes)} />
      <Stat label="Break" value={room.breakMinutes ? formatMinutes(room.breakMinutes) : 'None'} />
      <Stat label="Capacity" value={`${room.capacity} seats`} />
      <Stat label="Mode" value={MODES[room.mode].label} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-fg">{value}</dd>
    </div>
  );
}

export function Rules({ rules }: { rules: string[] }) {
  if (rules.length === 0) return null;
  return (
    <div className="mt-5">
      <h2 className="font-sans text-sm font-semibold">Room rules</h2>
      <ul className="mt-2 space-y-1.5">
        {rules.map((r) => (
          <li key={r} className="flex gap-2.5 text-sm text-fg-muted">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-fg-subtle" aria-hidden />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HostCard({ room, children }: { room: Room; children?: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="eyebrow">Hosted by</p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={room.host} size="md" />
        <div>
          <p className="font-medium text-fg">{room.host}</p>
          <p className="text-xs text-fg-subtle">{room.isHost ? 'That’s you' : 'Room host'}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export function SafetyCard() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-mint-400" aria-hidden />
        <p className="text-sm font-semibold text-fg">Study safely</p>
      </div>
      <ul className="mt-3 space-y-2 text-[13px] text-fg-muted">
        <li>Only your display name and avatar are visible in rooms.</li>
        <li>Never share your phone number, address or passwords.</li>
        <li>Use Report if anyone makes you uncomfortable.</li>
      </ul>
    </Card>
  );
}
