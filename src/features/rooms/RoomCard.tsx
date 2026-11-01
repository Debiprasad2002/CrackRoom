import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Users } from 'lucide-react';
import type { Room } from '@/types';
import { MODES, examLabel, levelLabel } from '@/data/catalog';
import { formatRhythm } from '@/lib/date';
import { Avatar } from '@/components/ui/Avatar';
import { MODE_ICONS } from './roomMeta';

/** Each subject gets its own gradient so rooms are recognisable at a glance. */
const THEMES: Record<Room['subject'], { gradient: string; glow: string; label: string }> = {
  physics: { gradient: 'linear-gradient(135deg, #0284C7 0%, #2563EB 60%, #4F46E5 100%)', glow: 'rgba(37,99,235,0.35)', label: 'Physics' },
  chemistry: { gradient: 'linear-gradient(135deg, #D97706 0%, #EA580C 60%, #DC2626 100%)', glow: 'rgba(234,88,12,0.35)', label: 'Chemistry' },
  mathematics: { gradient: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 55%, #4338CA 100%)', glow: 'rgba(109,40,217,0.35)', label: 'Mathematics' },
  biology: { gradient: 'linear-gradient(135deg, #DB2777 0%, #BE185D 55%, #9D174D 100%)', glow: 'rgba(219,39,119,0.35)', label: 'Biology' },
  mixed: { gradient: 'linear-gradient(135deg, #0F766E 0%, #4F46E5 55%, #9333EA 100%)', glow: 'rgba(79,70,229,0.35)', label: 'Mixed subjects' },
};

export function RoomCard({ room }: { room: Room }) {
  const ModeIcon = MODE_ICONS[room.mode];
  const theme = THEMES[room.subject];
  const isPrivate = room.visibility === 'private';
  return (
    <Link
      to={`/rooms/${room.id}`}
      className="group relative isolate flex h-full flex-col overflow-hidden rounded-[1.375rem] border border-line bg-ink-800 shadow-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-transparent"
      style={{ ['--glow' as string]: theme.glow }}
    >
      <span className="pointer-events-none absolute inset-0 -z-10 rounded-[1.375rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100 [box-shadow:0_22px_44px_-14px_var(--glow)]" aria-hidden />

      <div className="relative h-28 overflow-hidden px-5 pt-4 text-white" style={{ background: theme.gradient }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.14]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '16px 16px' }} aria-hidden />
        <ModeIcon className="pointer-events-none absolute -bottom-7 -right-4 size-32 rotate-[-10deg] text-white/15 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110" strokeWidth={1.5} aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
            <ModeIcon className="size-[18px]" aria-hidden />
          </span>
          <div className="flex items-center gap-1.5">
            {room.isLive && (
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-white px-2 text-[11px] font-bold uppercase tracking-wide text-rose-600">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-rose-500" />
                </span>
                Live
              </span>
            )}
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-black/20 px-2 text-[11px] font-semibold ring-1 ring-white/20 backdrop-blur">
              {isPrivate && <Lock className="size-3" aria-hidden />}
              {isPrivate ? 'Private' : 'Public'}
            </span>
          </div>
        </div>
        <p className="relative mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
          {theme.label} · {MODES[room.mode].label}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[17px] font-semibold leading-snug transition-colors group-hover:text-violet-300">{room.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-fg-muted">{room.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-md border border-violet-400/25 bg-violet-500/10 px-2 text-xs font-semibold text-violet-300">
            {examLabel(room.exam)}
          </span>
          <span className="inline-flex h-6 items-center rounded-md border border-line-strong bg-ink-700/60 px-2 text-xs font-medium text-fg-muted">
            {levelLabel(room.level)}
          </span>
          <span className="inline-flex h-6 items-center rounded-md border border-line-strong bg-ink-700/60 px-2 text-xs font-medium text-fg-muted tabular">
            {formatRhythm(room.focusMinutes, room.breakMinutes)}
          </span>
        </div>

        <div className="mt-auto pt-5">
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-[13px] text-fg-muted">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={room.host} size="xs" />
              <span className="truncate">{room.host}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {room.participants != null && (
                <span className="flex items-center gap-1 tabular" title="Students in the room right now">
                  <Users className="size-3.5" aria-hidden />
                  {room.participants}/{room.capacity}
                  <span className="sr-only">students in the room now</span>
                </span>
              )}
              <span className="flex size-8 items-center justify-center rounded-full bg-ink-700 transition-colors group-hover:bg-violet-500 group-hover:text-white">
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
