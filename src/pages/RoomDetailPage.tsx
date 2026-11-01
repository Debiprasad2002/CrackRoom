import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, DoorOpen, Flag, KeyRound, LogOut, Users } from 'lucide-react';
import type { Room } from '@/types';
import { useAsync } from '@/hooks/useAsync';
import { roomsService } from '@/services/roomsService';
import { USING_SAMPLE_DATA } from '@/services/config';
import { Avatar } from '@/components/ui/Avatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { EmptyState, ErrorState, PrototypeNote, Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { useFocus } from '@/features/focus/FocusContext';
import { FocusTimerPanel } from '@/features/focus/FocusTimerPanel';
import { RoomChat } from '@/features/rooms/RoomChat';
import { ReportDialog } from '@/features/rooms/ReportDialog';
import { HostCard, RoomFacts, RoomHeading, Rules, SafetyCard } from '@/features/rooms/RoomParts';
import { LiveRoomView } from '@/features/rooms/live/LiveRoomView';

export default function RoomDetailPage() {
  const { roomId = '' } = useParams();
  const { data: room, loading, error, retry } = useAsync(() => roomsService.get(roomId), [roomId]);

  return (
    <div className="space-y-6">
      <Link to="/rooms" className="-my-2 inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm font-medium text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        All rooms
      </Link>
      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={retry} />
        </Card>
      ) : loading ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : !room ? (
        <Card>
          <EmptyState
            icon={<DoorOpen />}
            title="This room doesn't exist"
            description="It may have been closed by its host, or the link is incorrect."
            action={<ButtonLink to="/rooms" variant="secondary">Browse rooms</ButtonLink>}
          />
        </Card>
      ) : USING_SAMPLE_DATA ? (
        <SampleRoomView room={room} />
      ) : (
        <LiveRoomView key={room.id} initialRoom={room} />
      )}
    </div>
  );
}

/** The device-only room used when no server is configured. */
function SampleRoomView({ room }: { room: Room }) {
  const { profile, setRecentRoomId } = useRequiredProfile();
  const { timer } = useFocus();
  const notify = useToast();
  const [joined, setJoined] = useState(() => timer.status !== 'idle' && timer.roomId === room.id);
  const [reporting, setReporting] = useState(false);
  const isPrivate = room.visibility === 'private';
  const focusingHere = timer.roomId === room.id && timer.status === 'running' && timer.phase === 'focus';

  function join() {
    setJoined(true);
    setRecentRoomId(room.id);
  }

  function leave() {
    setJoined(false);
    if (timer.status !== 'idle' && timer.roomId === room.id) {
      notify({ title: 'You left the room', description: 'Your timer keeps running as a solo session.' });
    }
  }

  return (
    <>
      <RoomHeading
        room={room}
        actions={
          <>
            <Button variant="ghost" onClick={() => setReporting(true)}>
              <Flag aria-hidden />
              Report
            </Button>
            {joined && (
              <Button variant="secondary" onClick={leave}>
                <LogOut aria-hidden />
                Leave room
              </Button>
            )}
          </>
        }
      />

      {!joined ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="p-6 sm:p-8">
            <p className="text-[15px] leading-relaxed text-fg-muted">{room.description}</p>
            <RoomFacts room={room} />
            <Rules rules={room.rules} />
            <div className="mt-8">
              {isPrivate ? (
                <div className="flex flex-col gap-4 rounded-xl border border-line-strong bg-ink-850 p-5 sm:flex-row sm:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-700 text-fg-muted">
                    <KeyRound className="size-5" aria-hidden />
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-fg">Invite only</p>
                    <p className="mt-0.5 text-sm text-fg-muted">
                      Ask {room.host} for an invite. Invitations start working once student accounts are live.
                    </p>
                  </div>
                </div>
              ) : (
                <Button size="lg" onClick={join}>
                  <DoorOpen aria-hidden />
                  Join room
                </Button>
              )}
            </div>
          </Card>
          <aside className="space-y-4">
            <HostCard room={room} />
            <SafetyCard />
          </aside>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <Card className="px-4 py-8 sm:px-8">
              <FocusTimerPanel room={{ ...room, subject: room.subject === 'mixed' ? undefined : room.subject }} />
            </Card>
            <Card className="p-6">
              <h2 className="font-sans text-sm font-semibold">About this room</h2>
              <p className="mt-2 text-sm text-fg-muted">{room.description}</p>
              <Rules rules={room.rules} />
            </Card>
          </div>
          <aside className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-sans text-sm font-semibold">In the room</h2>
                <Users className="size-4 text-fg-subtle" aria-hidden />
              </div>
              <ul className="mt-4 space-y-3">
                <li className="flex items-center gap-3">
                  <Avatar name={profile.displayName} hue={profile.avatarHue} avatar={profile.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{profile.displayName} (you)</p>
                    <p className="text-xs text-fg-subtle">
                      {timer.roomId === room.id && timer.status !== 'idle'
                        ? timer.phase === 'break'
                          ? 'On a break'
                          : timer.status === 'paused'
                            ? 'Paused'
                            : 'Focusing'
                        : 'Ready'}
                    </p>
                  </div>
                </li>
              </ul>
              <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-fg-subtle">
                Other students appear here once live presence is connected. Your timer runs for you alone — it is not synced with anyone yet.
              </p>
            </Card>
            <Card className="overflow-hidden">
              <RoomChat roomId={room.id} locked={room.mode === 'silent' && focusingHere} />
            </Card>
          </aside>
        </div>
      )}

      <PrototypeNote>This is a sample room. Nothing you do here is visible to other students yet.</PrototypeNote>

      <ReportDialog open={reporting} onClose={() => setReporting(false)} roomId={room.id} roomName={room.name} />
    </>
  );
}
