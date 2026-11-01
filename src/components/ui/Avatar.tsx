import { cn } from '@/lib/cn';
import { AVATAR_BY_KEY } from '@/data/avatars';

const sizes = {
  xs: 'size-6 text-[10px] [&_svg]:size-3.5',
  sm: 'size-8 text-xs [&_svg]:size-4',
  md: 'size-10 text-sm [&_svg]:size-5',
  lg: 'size-16 text-xl [&_svg]:size-8',
  xl: 'size-20 text-2xl [&_svg]:size-10',
};

export function hueFromName(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

interface AvatarProps {
  name: string;
  hue?: number;
  /** A preset key from data/avatars. Empty or unknown falls back to initials. */
  avatar?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ name, hue, avatar, size = 'md', className }: AvatarProps) {
  const preset = avatar ? AVATAR_BY_KEY[avatar] : undefined;
  const base = 'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold font-display';
  if (preset?.kind === 'illustration') {
    return (
      <img
        src={preset.image}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn(base, 'bg-ink-700 object-cover ring-1 ring-black/5', sizes[size], className)}
      />
    );
  }
  if (preset) {
    const Icon = preset.icon;
    return (
      <span
        aria-hidden
        className={cn(base, 'text-white', sizes[size], className)}
        style={{
          background: `linear-gradient(140deg, ${preset.from}, ${preset.to})`,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22), inset 0 -6px 12px rgba(0,0,0,0.12)',
        }}
      >
        <Icon strokeWidth={2} />
      </span>
    );
  }
  const h = hue ?? hueFromName(name);
  return (
    <span
      aria-hidden
      className={cn(base, sizes[size], className)}
      style={{
        background: `linear-gradient(140deg, hsl(${h} 70% 62%), hsl(${(h + 40) % 360} 60% 44%))`,
        color: `hsl(${h} 60% 12%)`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
      }}
    >
      {initials(name)}
    </span>
  );
}
