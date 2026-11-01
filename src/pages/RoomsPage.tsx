import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DoorOpen, Plus, SearchX } from 'lucide-react';
import type { Room } from '@/types';
import { EXAMS, LEVELS, MODES, SUBJECTS } from '@/data/catalog';
import { useAsync } from '@/hooks/useAsync';
import { roomsService } from '@/services/roomsService';
import { USING_SAMPLE_DATA } from '@/services/config';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Layout';
import { EmptyState, ErrorState, PrototypeNote, Skeleton } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Field';
import { FilterBar } from '@/components/ui/FilterBar';
import { Segmented } from '@/components/ui/Choice';
import { useToast } from '@/components/ui/Toast';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { RoomCard } from '@/features/rooms/RoomCard';
import { roomRelevance } from '@/features/rooms/roomMeta';
import { CreateRoomDialog } from '@/features/rooms/CreateRoomDialog';

const FILTER_KEYS = ['q', 'exam', 'level', 'subject', 'visibility', 'mode'] as const;

function matches(room: Room, f: Record<(typeof FILTER_KEYS)[number], string>) {
  const q = f.q.trim().toLowerCase();
  if (q && !`${room.name} ${room.description} ${room.host}`.toLowerCase().includes(q)) return false;
  if (f.exam && room.exam !== 'both' && room.exam !== f.exam) return false;
  if (f.level && room.level !== 'all' && room.level !== f.level) return false;
  if (f.subject && room.subject !== f.subject) return false;
  if (f.visibility && room.visibility !== f.visibility) return false;
  if (f.mode && room.mode !== f.mode) return false;
  return true;
}

export default function RoomsPage() {
  const { profile } = useRequiredProfile();
  const notify = useToast();
  const navigate = useNavigate();
  const [hosting, setHosting] = useState(false);
  const [params, setParams] = useSearchParams();
  const { data, loading, error, retry } = useAsync(() => roomsService.list(), []);

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<(typeof FILTER_KEYS)[number], string>;
  const activeCount = FILTER_KEYS.filter((k) => filters[k]).length;

  function setFilter(key: (typeof FILTER_KEYS)[number], value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  const rooms = useMemo(
    () =>
      (data ?? [])
        .filter((r) => matches(r, filters))
        .sort((a, b) => roomRelevance(b, profile) - roomRelevance(a, profile)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, params, profile],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live rooms"
        description="Study alongside students with the same exam, class and rhythm. Rooms closest to your profile come first."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              USING_SAMPLE_DATA
                ? notify({ title: 'Hosting needs the CrackRoom server', description: 'Rooms you create are shared with other students, so they need an account.' })
                : setHosting(true)
            }
          >
            <Plus aria-hidden />
            Create room
          </Button>
        }
      />

      <FilterBar
        label="Search rooms"
        query={filters.q}
        onQuery={(v) => setFilter('q', v)}
        placeholder="Search rooms or topics"
        chips={{
          value: filters.subject,
          onChange: (v) => setFilter('subject', v),
          options: [
            ...Object.entries(SUBJECTS).map(([value, s]) => ({ value, label: s.label, dot: s.dot })),
            { value: 'mixed', label: 'Mixed' },
          ],
        }}
        sheetCount={(['exam', 'level', 'mode', 'visibility'] as const).filter((k) => filters[k]).length}
        activeCount={activeCount}
        onReset={() => setParams({}, { replace: true })}
        summary={!loading && !error && `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}`}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select aria-label="Exam" value={filters.exam} onChange={(e) => setFilter('exam', e.target.value)}>
              <option value="">All exams</option>
              {EXAMS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </Select>
            <Select aria-label="Class or level" value={filters.level} onChange={(e) => setFilter('level', e.target.value)}>
              <option value="">All classes</option>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
            <Select aria-label="Subject" value={filters.subject} onChange={(e) => setFilter('subject', e.target.value)}>
              <option value="">All subjects</option>
              {Object.entries(SUBJECTS).map(([value, s]) => (
                <option key={value} value={value}>
                  {s.label}
                </option>
              ))}
              <option value="mixed">Mixed subjects</option>
            </Select>
            <Select aria-label="Study mode" value={filters.mode} onChange={(e) => setFilter('mode', e.target.value)}>
              <option value="">All study modes</option>
              {Object.entries(MODES).map(([value, m]) => (
                <option key={value} value={value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <Segmented
            label="Room visibility"
            className="w-full sm:w-auto"
            value={filters.visibility as '' | 'public' | 'private'}
            options={[
              { value: '', label: 'All rooms' },
              { value: 'public', label: 'Public' },
              { value: 'private', label: 'Private' },
            ]}
            onChange={(v) => setFilter('visibility', v)}
          />
        </div>
      </FilterBar>

      {error ? (
        <Card>
          <ErrorState onRetry={retry} />
        </Card>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-60 rounded-2xl" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <EmptyState
            icon={data?.length ? <SearchX /> : <DoorOpen />}
            title={data?.length ? 'No rooms match these filters' : 'No rooms yet'}
            description={data?.length ? 'Try a different subject or class, or clear the filters.' : 'Rooms will appear here as soon as they open.'}
            action={
              activeCount > 0 && (
                <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                  Reset filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}

      {USING_SAMPLE_DATA && (
        <PrototypeNote>
          These are sample rooms. Live presence, participant counts and synced sessions appear once the real-time server is connected — none are shown until then.
        </PrototypeNote>
      )}
      {!USING_SAMPLE_DATA && (
        <CreateRoomDialog
          open={hosting}
          onClose={() => setHosting(false)}
          onCreated={(room) => {
            setHosting(false);
            notify({ tone: 'success', title: 'Room created', description: 'Start the shared timer when your group is ready.' });
            navigate(`/rooms/${room.id}`);
          }}
        />
      )}
    </div>
  );
}
