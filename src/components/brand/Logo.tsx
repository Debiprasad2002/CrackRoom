import { cn } from '@/lib/cn';

/**
 * The CrackRoom mark: an open "C" that doubles as a doorway, with a lit room inside.
 * Two flat shapes so it stays legible down to favicon size.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#F1ECFE" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="rgba(124,58,237,0.18)" />
      <path d="M22.4 9.6A9 9 0 1 0 22.4 22.4" fill="none" stroke="#7C3AED" strokeWidth="3.4" strokeLinecap="round" />
      <rect x="13.4" y="12.2" width="5.2" height="7.6" rx="1.1" fill="#0891B2" />
    </svg>
  );
}

interface LogoProps {
  variant?: 'full' | 'mark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const dims = { sm: { mark: 24, text: 'text-[15px]' }, md: { mark: 28, text: 'text-[17px]' }, lg: { mark: 40, text: 'text-2xl' } };

export function Logo({ variant = 'full', size = 'md', className }: LogoProps) {
  const d = dims[size];
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={d.mark} />
      {variant === 'full' ? (
        <span className={cn('font-display font-semibold tracking-tight text-fg', d.text)}>
          Crack<span className="text-violet-300">Room</span>
        </span>
      ) : (
        <span className="sr-only">CrackRoom</span>
      )}
    </span>
  );
}
