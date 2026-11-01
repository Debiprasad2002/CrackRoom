import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, DoorClosed, DoorOpen, Flag, KeyRound, LogOut, RefreshCw, Users, Wifi, WifiOff } from 'lucide-react';
import type { Profile, PresenceStatus, PublicProfile, Room, RoomPerson, RoomTimer } from '@/types';
import { cn } from '@/lib/cn';
import { useNow } from '@/hooks/useNow';
import { roomsService } from '@/services/roomsService';
import { ApiError, errorMessage } from '@/services/http';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { FormAlert } from '@/features/auth/AuthLayout';
import { useProfile } from '@/features/profile/ProfileContext';
import { ProfileCard } from '@/features/profile/ProfileCard';
import { Skeleton } from '@/components/ui/Feedback';
import { ReportDialog } from '../ReportDialog';
import { HostCard, RoomFacts, RoomHeading, Rules, SafetyCard } from '../RoomParts';
import { LiveChat, useRoomMessages } from './LiveChat';
import { RoomTimerPanel } from './RoomTimerPanel';
import { clockSkew, roomClock } from './roomClock';
import { useRoomSocket, type SocketState } from './useRoomSocket';

const STATUS_LABEL: Record<PresenceStatus, string> = {
  ready: 'In the room',
  focusing: 'Focusing',
  break: 'On a break',
  paused: 'Paused',
};

export function LiveRoomView({ initialRoom }: { initialRoom: Room }) {
  const [room, setRoom] = useState(initialRoom);
  const [reporting, setReporting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closedByHost, setClosedByHost] = useState(false);
  const { setRecentRoomId } = useProfile();
  const notify = useToast();
  const navigate = useNavigate();
  const joined = Boolean(room.isMember);

  useEffect(() => {
    if (joined) setRecentRoomId(room.id);
  }, [joined, room.id, setRecentRoomId]);

  async function leave() {
    try {
      await roomsService.leave(room.id);
      setRoom((r) => ({ ...r, isMember: false }));
      notify({ title: 'You left the room', description: 'Focus time you spent here is already in your history.' });
    } catch (e) {
      notify({ tone: 'error', title: 'Could not leave', description: errorMessage(e) });
    }
  }

  if (closedByHost) {
    return (
      <Card>
        <EmptyState
          icon={<DoorClosed />}
          title="This room has closed"
          description="The host closed the room. Focus time you spent here is saved in your history."
          action={<ButtonLink to="/rooms" variant="secondary">Find another room</ButtonLink>}
        />
      </Card>
    );
  }

  return (
    <>
      <RoomHeading
        room={room}
        actions={
          <>
            {!room.isHost && (
              <Button variant="ghost" onClick={() => setReporting(true)}>
                <Flag aria-hidden />
                Report
              </Button>
            )}
            {joined && !room.isHost && (
              <Button variant="secondary" onClick={leave}>
                <LogOut aria-hidden />
                Leave room
              </Button>
            )}
            {room.isHost && (
              <Button variant="danger" onClick={() => setClosing(true)}>
                <DoorClosed aria-hidden />
                Close room
              </Button>
            )}
          </>
        }
      />

      {joined ? (
        <InRoom room={room} setRoom={setRoom} onClosed={() => setClosedByHost(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="p-6 sm:p-8">
            <p className="text-[15px] leading-relaxed text-fg-muted">{room.description}</p>
            <RoomFacts room={room} />
            <Rules rules={room.rules} />
            <JoinPanel room={room} onJoined={setRoom} />
          </Card>
          <aside className="space-y-4">
            <HostCard room={room} />
            <SafetyCard />
          </aside>
        </div>
      )}

      <ReportDialog open={reporting} onClose={() => setReporting(false)} roomId={room.id} roomName={room.name} />
      <CloseRoomDialog
        open={closing}
        onClose={() => setClosing(false)}
        room={room}
        onClosed={() => {
          notify({ title: 'Room closed', description: `${room.name} is no longer listed.` });
          navigate('/rooms', { replace: true });
        }}
      />
    </>
  );
}

function InRoom({ room, setRoom, onClosed }: { room: Room; setRoom: (update: (r: Room) => Room) => void; onClosed: () => void }) {
  const [skew, setSkew] = useState(() => (room.timer ? clockSkew(room.timer) : 0));

  const onTimer = useCallback(
    (timer: RoomTimer) => {
      setSkew(clockSkew(timer));
      setRoom((r) => ({ ...r, timer }));
    },
    [setRoom],
  );

  // Chat needs the socket's state and the socket feeds chat; the handler runs later, after `chat` exists.
  const socket = useRoomSocket(room.id, { enabled: true, onTimer, onChat: (m) => chat.append([m]) });
  const chat = useRoomMessages(room.id, socket.state === 'live');

  useEffect(() => {
    if (socket.state === 'removed') setRoom((r) => ({ ...r, isMember: false }));
    if (socket.state === 'closed') onClosed();
  }, [socket.state, setRoom, onClosed]);

  const now = useNow(true, 1000);
  const clock = room.timer ? roomClock(room.timer, now + skew) : null;
  const status: PresenceStatus =
    !clock || clock.status === 'idle' ? 'ready' : clock.status === 'paused' ? 'paused' : clock.phase === 'break' ? 'break' : 'focusing';
  const { sendStatus } = socket;
  useEffect(() => sendStatus(status), [status, sendStatus]);

  const locked = room.mode === 'silent' && clock?.status === 'running' && clock.phase === 'focus';

  return (
    // On phones: timer, people, chat, then details. On desktop the side column spans both rows.
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="px-4 py-8 sm:px-8 lg:col-start-1 lg:row-start-1">
        {room.timer && <RoomTimerPanel room={room} timer={room.timer} skew={skew} present={socket.state === 'live'} onTimer={onTimer} />}
      </Card>
      <Card className="order-last p-6 lg:order-none lg:col-start-1 lg:row-start-2">
        <h2 className="font-sans text-sm font-semibold">About this room</h2>
        <p className="mt-2 text-sm text-fg-muted">{room.description}</p>
        <Rules rules={room.rules} />
      </Card>
      <aside className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <PeopleCard roomId={room.id} people={socket.people} you={socket.you} state={socket.state} capacity={room.capacity} />
        {room.isHost && room.visibility === 'private' && <InviteCard room={room} setRoom={setRoom} />}
        <Card className="overflow-hidden">
          <LiveChat roomId={room.id} you={socket.you} messages={chat.messages} loaded={chat.loaded} append={chat.append} locked={locked} />
        </Card>
      </aside>
    </div>
  );
}

function ConnectionBadge({ state }: { state: SocketState }) {
  if (state === 'live') {
    return (
      <Badge tone="mint">
        <Wifi aria-hidden />
        Live
      </Badge>
    );
  }
  return (
    <Badge>
      <WifiOff aria-hidden />
      {state === 'connecting' ? 'Connecting' : 'Reconnecting'}
    </Badge>
  );
}

interface PeopleCardProps {
  roomId: string;
  people: RoomPerson[];
  you: string | null;
  state: SocketState;
  capacity: number;
}

function PeopleCard({ roomId, people, you, state, capacity }: PeopleCardProps) {
  const sorted = [...people].sort((a, b) => Number(b.key === you) - Number(a.key === you));
  const [viewing, setViewing] = useState<RoomPerson | null>(null);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-sans text-sm font-semibold">
          <Users className="size-4 text-fg-subtle" aria-hidden />
          In the room
          {state === 'live' && (
            <span className="font-normal text-fg-subtle tabular">
              {people.length}/{capacity}
            </span>
          )}
        </h2>
        <ConnectionBadge state={state} />
      </div>
      {state !== 'live' && people.length === 0 ? (
        <p className="mt-4 text-sm text-fg-muted">
          {state === 'connecting' ? 'Joining the live room…' : 'Connection lost. Reconnecting, and chat keeps working meanwhile.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sorted.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => setViewing(p)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-ink-700"
                aria-label={`View ${p.key === you ? 'your' : `${p.name}'s`} profile card`}
              >
                <Avatar name={p.name} hue={p.hue ?? undefined} avatar={p.avatar} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {p.name}
                    {p.key === you && <span className="font-normal text-fg-subtle"> (you)</span>}
                  </span>
                  <span className={cn('block text-xs', p.status === 'focusing' ? 'text-violet-300' : p.status === 'break' ? 'text-cyan-300' : 'text-fg-subtle')}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </span>
                {p.isHost && <Badge tone="violet">Host</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <PersonDialog roomId={roomId} person={viewing} onClose={() => setViewing(null)} />
    </Card>
  );
}

function PersonDialog({ roomId, person, onClose }: { roomId: string; person: RoomPerson | null; onClose: () => void }) {
  const [card, setCard] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    setCard(null);
    setError(undefined);
    roomsService.person(roomId, person.key).then(
      (data) => !cancelled && setCard(data),
      (e) => !cancelled && setError(errorMessage(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [roomId, person]);

  // Reuse the profile card in its public mode; hidden fields arrive as null.
  const profile: Profile | null =
    card && card.exam && card.level
      ? {
          displayName: card.name,
          exam: card.exam,
          level: card.level,
          subjects: card.subjects ?? [],
          targetYear: card.targetYear ?? 0,
          dailyGoalMinutes: 0,
          avatarHue: card.hue ?? 0,
          avatar: card.avatar,
          privacy: { showStats: card.stats != null, showSubjects: card.subjects != null, showTargetYear: card.targetYear != null },
          createdAt: '',
        }
      : null;

  return (
    <Dialog
      open={person != null}
      onClose={onClose}
      size="sm"
      title="Profile card"
      description="Only what this student chooses to share is shown."
    >
      {error ? (
        <p className="text-sm text-fg-muted">{error}</p>
      ) : !card ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : profile ? (
        <ProfileCard profile={profile} stats={card.stats ?? { streak: 0, minutes: 0, sessions: 0 }} publicView />
      ) : (
        <p className="text-sm text-fg-muted">{card.name} has not finished setting up their profile yet.</p>
      )}
    </Dialog>
  );
}

function InviteCard({ room, setRoom }: { room: Room; setRoom: (update: (r: Room) => Room) => void }) {
  const notify = useToast();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copy() {
    if (!room.inviteCode) return;
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify({ title: 'Copy not available', description: 'Select the code and copy it manually.' });
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const updated = await roomsService.resetInviteCode(room.id);
      setRoom((r) => ({ ...r, inviteCode: updated.inviteCode }));
      notify({ tone: 'success', title: 'New invite code', description: 'The old code no longer works. Current members stay.' });
    } catch (e) {
      notify({ tone: 'error', title: 'Code not changed', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-fg-subtle" aria-hidden />
        <h2 className="font-sans text-sm font-semibold">Invite code</h2>
      </div>
      <p className="mt-1 text-xs text-fg-subtle">Only you can see this. Share it with students you want in the room.</p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 select-all rounded-xl border border-line-strong bg-ink-850 px-3 py-2 text-center font-mono text-lg tracking-[0.25em] text-fg">
          {room.inviteCode}
        </code>
        <Button variant="secondary" size="icon" onClick={copy} aria-label="Copy invite code">
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="mt-2" onClick={reset} disabled={busy}>
        <RefreshCw aria-hidden />
        Issue a new code
      </Button>
    </Card>
  );
}

function JoinPanel({ room, onJoined }: { room: Room; onJoined: (room: Room) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const isPrivate = room.visibility === 'private';

  async function join(e?: FormEvent) {
    e?.preventDefault();
    if (isPrivate && code.trim().length < 4) {
      setError('Enter the invite code from the host.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      onJoined(await roomsService.join(room.id, isPrivate ? code.trim() : undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errorMessage(err));
      setBusy(false);
    }
  }

  if (!isPrivate) {
    return (
      <div className="mt-8 space-y-3">
        {error && <FormAlert>{error}</FormAlert>}
        <Button size="lg" onClick={() => join()} disabled={busy}>
          <DoorOpen aria-hidden />
          {busy ? 'Joining…' : 'Join room'}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={join} noValidate className="mt-8 rounded-xl border border-line-strong bg-ink-850 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-700 text-fg-muted">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-medium text-fg">Invite only</p>
          <p className="mt-0.5 text-sm text-fg-muted">Ask {room.host} for the room's invite code.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field label="Invite code" error={error} className="flex-1">
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={16}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="e.g. K7Q2M9XD"
              className="font-mono tracking-widest"
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Button type="submit" size="lg" disabled={busy} className="sm:mt-[1.625rem]">
          {busy ? 'Joining…' : 'Join'}
        </Button>
      </div>
    </form>
  );
}

function CloseRoomDialog({ open, onClose, room, onClosed }: { open: boolean; onClose: () => void; room: Room; onClosed: () => void }) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);

  async function close() {
    setBusy(true);
    try {
      await roomsService.close(room.id);
      onClose();
      onClosed();
    } catch (e) {
      notify({ tone: 'error', title: 'Room not closed', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={`Close ${room.name}?`}
      description="Everyone in the room is disconnected and it disappears from Rooms. Members keep the focus time they logged here."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it open
          </Button>
          <Button variant="danger" onClick={close} disabled={busy}>
            {busy ? 'Closing…' : 'Close room'}
          </Button>
        </>
      }
    />
  );
}
