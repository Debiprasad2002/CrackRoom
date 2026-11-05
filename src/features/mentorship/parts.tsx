import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BadgeCheck, CalendarPlus, Clock, Languages, Video } from 'lucide-react';
import type { MentorBooking, MentorCard as Mentor } from '@/types';
import { SUBJECTS } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Button, buttonClass } from '@/components/ui/Button';

/* ---- Time helpers ------------------------------------------------------------------- */

const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

/** "Today, 6:30 pm", "Tomorrow, 7:00 pm" or "Tue, 4 Nov, 6:30 pm". */
export function whenLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = sameDay(d, now) ? 'Today' : sameDay(d, tomorrow) ? 'Tomorrow' : dayFmt.format(d);
  return `${day}, ${timeFmt.format(d)}`;
}

export function timeLabel(iso: string) {
  return timeFmt.format(new Date(iso));
}

/** "in 25 min", "in 3 h", "in 2 days", or "now". */
export function countdown(iso: string, now = Date.now()) {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return 'now';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `in ${h} h`;
  const d = Math.round(h / 24);
  return `in ${d} ${d === 1 ? 'day' : 'days'}`;
}

/** The call opens 10 minutes early and stays open until the session ends. */
export function canJoin(booking: MentorBooking, now = Date.now()) {
  const start = Date.parse(booking.startsAt);
  return booking.status === 'booked' && now >= start - 10 * 60_000 && now <= start + booking.minutes * 60_000;
}

/** A calendar file, so the session lands in Google Calendar or the phone's calendar. */
export function downloadIcs(booking: MentorBooking) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(booking.startsAt);
  const end = new Date(start.getTime() + booking.minutes * 60_000);
  const escape = (text: string) => text.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CrackRoom//Mentorship//EN',
    'BEGIN:VEVENT',
    `UID:crackroom-booking-${booking.id}@crackroom`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`CrackRoom mentorship with ${booking.mentor.name}`)}`,
    `DESCRIPTION:${escape(`Topic: ${booking.topic}${booking.meetingUrl ? `\nJoin: ${booking.meetingUrl}` : ''}`)}`,
    ...(booking.meetingUrl ? [`URL:${booking.meetingUrl}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Mentorship session in 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'crackroom-mentorship.ics';
  a.click();
  URL.revokeObjectURL(url);
}

/* ---- Visual pieces -------------------------------------------------------------------- */

export function VerifiedTick({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex text-violet-500', className)} title="Verified by CrackRoom">
      <BadgeCheck className="size-[1.1em]" aria-hidden />
      <span className="sr-only">Verified mentor</span>
    </span>
  );
}

/** Avatar inside a gradient ring: the premium signature of mentor surfaces. */
export function MentorAvatar({ name, hue, size = 'md', verified, className }: { name: string; hue: number; size?: 'md' | 'lg' | 'xl'; verified?: boolean; className?: string }) {
  const inner = size === 'xl' ? 'xl' : size === 'lg' ? 'lg' : 'md';
  return (
    <span className={cn('relative inline-flex shrink-0 self-start rounded-full p-[2.5px]', className)} style={{ background: `conic-gradient(from 210deg, hsl(${hue} 80% 60%), #F59E0B, hsl(${(hue + 60) % 360} 75% 55%), hsl(${hue} 80% 60%))` }}>
      <span className="rounded-full bg-ink-800 p-[2px]">
        <Avatar name={name} hue={hue} size={inner} />
      </span>
      {verified && (
        <span className="absolute -bottom-0.5 -right-0.5 flex rounded-full bg-ink-800 p-[1px] text-[18px]">
          <VerifiedTick />
        </span>
      )}
    </span>
  );
}

export function SubjectChips({ subjects, className }: { subjects: Mentor['subjects']; className?: string }) {
  return (
    <span className={cn('flex flex-wrap gap-1.5', className)}>
      {subjects.map((s) => (
        <span key={s} className={cn('inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium', SUBJECTS[s].tile)}>
          {SUBJECTS[s].label}
        </span>
      ))}
    </span>
  );
}

export function MentorCard({ mentor }: { mentor: Mentor }) {
  return (
    <Link
      to={`/mentorship/${mentor.id}`}
      className="surface group relative flex h-full flex-col overflow-hidden p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-violet-400/40 hover:shadow-pop"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-70"
        style={{ background: `linear-gradient(180deg, hsl(${mentor.hue} 85% var(--tint-lightness)), transparent)` }}
        aria-hidden
      />
      <div className="relative flex items-start gap-4">
        <MentorAvatar name={mentor.name} hue={mentor.hue} size="lg" verified={mentor.isVerified} />
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="truncate text-[17px] font-semibold leading-tight">{mentor.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-fg-muted">{mentor.headline}</p>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
        {mentor.exams.map((e) => (
          <span key={e} className="inline-flex h-6 items-center rounded-md border border-violet-400/25 bg-violet-500/10 px-2 text-xs font-semibold text-violet-300">
            {e}
          </span>
        ))}
        <SubjectChips subjects={mentor.subjects} />
      </div>
      <dl className="relative mt-4 grid grid-cols-2 gap-3 text-[13px]">
        <Fact icon={<Clock />} label={`${mentor.sessionMinutes}-min sessions`} />
        <Fact icon={<Languages />} label={mentor.languages.join(', ')} />
      </dl>
      <div className="relative mt-auto pt-5">
        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">Next available</p>
            <p className={cn('truncate text-sm font-semibold', mentor.nextSlot ? 'text-fg' : 'text-fg-subtle')}>
              {mentor.nextSlot ? whenLabel(mentor.nextSlot) : 'No open slots yet'}
            </p>
          </div>
          <span className={cn(buttonClass('primary', 'sm'), 'shrink-0 group-hover:bg-violet-600')}>
            Book
            <ArrowUpRight aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

function Fact({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-fg-muted [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-subtle">
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

/** An upcoming or past session, with the call button, calendar export and cancel. */
export function BookingCard({ booking, now, onCancel }: { booking: MentorBooking; now: number; onCancel?: () => void }) {
  const start = new Date(booking.startsAt);
  const joinable = canJoin(booking, now);
  const cancelled = booking.status === 'cancelled';
  return (
    <article className={cn('surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5', cancelled && 'opacity-70')}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-card"
          style={{ background: cancelled ? '#94A3B8' : 'linear-gradient(145deg, #7C3AED, #4C1D95)' }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest opacity-80">{start.toLocaleDateString('en-IN', { month: 'short' })}</span>
          <span className="text-2xl font-semibold leading-none tabular">{start.getDate()}</span>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
            <span className="truncate">{booking.mentor.name}</span>
            {booking.mentor.isVerified && <VerifiedTick />}
          </p>
          <p className="text-sm text-fg-muted">
            {whenLabel(booking.startsAt)} · {booking.minutes} min
            {!cancelled && <span className="text-violet-300"> · {countdown(booking.startsAt, now)}</span>}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-fg-subtle">“{booking.topic}”</p>
          {!cancelled && booking.inviteSent && <p className="mt-1 text-xs text-fg-muted">Google Calendar invite sent to your email.</p>}
          {cancelled && (
            <p className="mt-1 text-xs font-medium text-rose-400">Cancelled{booking.cancelledBy === 'mentor' ? ' by the mentor' : ''}</p>
          )}
        </div>
      </div>
      {!cancelled && (
        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
          {booking.meetingUrl && joinable ? (
            <a href={booking.meetingUrl} target="_blank" rel="noreferrer" className={buttonClass('primary')}>
              <Video aria-hidden />
              Join call
            </a>
          ) : (
            <Button variant="secondary" disabled title="The call opens 10 minutes before the start">
              <Video aria-hidden />
              Join opens 10 min before
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => downloadIcs(booking)} aria-label="Add to calendar" title="Add to calendar">
            <CalendarPlus aria-hidden />
          </Button>
          {booking.canCancel && onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
