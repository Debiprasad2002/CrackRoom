import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Atom, BookOpen, DoorOpen, GraduationCap, Stethoscope, type LucideIcon } from 'lucide-react';
import type { Resource, Room } from '@/types';
import { cn } from '@/lib/cn';
import { useAsync } from '@/hooks/useAsync';
import { roomsService } from '@/services/roomsService';
import { notesService } from '@/services/notesService';
import { useRequiredProfile } from '@/features/profile/ProfileContext';

interface Track {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  gradient: string;
  glow: string;
  /** Query string shared by the Rooms and Notes filters. */
  query: string;
  matchRoom: (r: Room) => boolean;
  matchNote: (n: Resource) => boolean;
}

const TRACKS: Track[] = [
  {
    id: 'JEE',
    title: 'JEE',
    subtitle: 'Main + Advanced · Physics, Chemistry, Maths',
    icon: Atom,
    gradient: 'linear-gradient(135deg, #4338CA 0%, #2563EB 55%, #06B6D4 100%)',
    glow: 'rgba(37, 99, 235, 0.35)',
    query: 'exam=JEE',
    matchRoom: (r) => r.exam === 'JEE' || r.exam === 'both',
    matchNote: (n) => n.exam === 'JEE' || n.exam === 'both',
  },
  {
    id: 'NEET',
    title: 'NEET',
    subtitle: 'UG · Physics, Chemistry, Biology',
    icon: Stethoscope,
    gradient: 'linear-gradient(135deg, #047857 0%, #059669 50%, #2DD4BF 100%)',
    glow: 'rgba(5, 150, 105, 0.35)',
    query: 'exam=NEET',
    matchRoom: (r) => r.exam === 'NEET' || r.exam === 'both',
    matchNote: (n) => n.exam === 'NEET' || n.exam === 'both',
  },
  {
    id: 'class11',
    title: 'Class 11',
    subtitle: 'Build the foundation chapter by chapter',
    icon: BookOpen,
    gradient: 'linear-gradient(135deg, #C2410C 0%, #F97316 55%, #FBBF24 100%)',
    glow: 'rgba(249, 115, 22, 0.35)',
    query: 'level=class11',
    matchRoom: (r) => r.level === 'class11' || r.level === 'all',
    matchNote: (n) => n.level === 'class11' || n.level === 'all',
  },
  {
    id: 'class12',
    title: 'Class 12',
    subtitle: 'Boards and entrance, side by side',
    icon: GraduationCap,
    gradient: 'linear-gradient(135deg, #6D28D9 0%, #A21CAF 55%, #EC4899 100%)',
    glow: 'rgba(162, 28, 175, 0.35)',
    query: 'level=class12',
    matchRoom: (r) => r.level === 'class12' || r.level === 'all',
    matchNote: (n) => n.level === 'class12' || n.level === 'all',
  },
];

/** Four colourful entry points into rooms and notes, with real counts for each track. */
export function TrackCards() {
  const { profile } = useRequiredProfile();
  const rooms = useAsync(() => roomsService.list(), []);
  const notes = useAsync(() => notesService.list(), []);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        TRACKS.map((t) => [
          t.id,
          {
            rooms: rooms.data ? rooms.data.filter(t.matchRoom).length : null,
            notes: notes.data ? notes.data.filter(t.matchNote).length : null,
          },
        ]),
      ),
    [rooms.data, notes.data],
  );

  return (
    <section aria-labelledby="home-tracks">
      <h2 id="home-tracks" className="mb-3 text-base font-semibold">
        Explore by track
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {TRACKS.map((t) => {
          const Icon = t.icon;
          const mine = t.id === profile.exam || t.id === profile.level;
          const c = counts[t.id];
          return (
            <article
              key={t.id}
              className="group relative isolate flex min-h-[11.5rem] flex-col overflow-hidden rounded-[1.375rem] p-4 text-white shadow-card transition-[transform,box-shadow] duration-300 hover:-translate-y-1 sm:min-h-[12.5rem] sm:p-5"
              style={{ background: t.gradient, ['--glow' as string]: t.glow }}
            >
              <span className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [box-shadow:0_18px_40px_-12px_var(--glow)]" aria-hidden />
              <Icon className="pointer-events-none absolute -bottom-6 -right-5 size-32 rotate-[-12deg] text-white/15 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110 sm:size-36" strokeWidth={1.5} aria-hidden />
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.12]"
                style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
                  <Icon className="size-5" aria-hidden />
                </span>
                {mine && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fg">Your track</span>}
              </div>
              <h3 className="relative mt-auto pt-4 font-display text-[1.375rem] font-semibold leading-none text-white sm:text-2xl">{t.title}</h3>
              <p className="relative mt-1 line-clamp-2 text-xs leading-snug text-white/80 sm:text-[13px]">{t.subtitle}</p>
              <div className="relative mt-3 flex flex-wrap gap-1.5">
                <TrackLink to={`/rooms?${t.query}`} icon={DoorOpen} label={c.rooms == null ? 'Rooms' : `${c.rooms} rooms`} />
                <TrackLink to={`/notes?${t.query}`} icon={BookOpen} label={c.notes == null ? 'Notes' : `${c.notes} notes`} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TrackLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-full bg-white/15 px-2.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white hover:text-fg',
        '[@media(pointer:coarse)]:h-9',
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
      <ArrowUpRight className="size-3 opacity-70" aria-hidden />
    </Link>
  );
}
