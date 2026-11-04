import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * The CrackRoom mark: an atom orbiting a graduation cap and an open book, on navy in both themes
 * so the white centre always reads. Drawn as SVG to stay sharp from favicon size upward.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const gradient = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="6" y1="14" x2="58" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.5" stopColor="#4F7BFF" />
          <stop offset="1" stopColor="#D946EF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#070C2B" />
      <g fill="none" stroke={`url(#${gradient})`} strokeWidth="2.8">
        <ellipse cx="32" cy="32" rx="11" ry="26" />
        <ellipse cx="32" cy="32" rx="11" ry="26" transform="rotate(60 32 32)" />
        <ellipse cx="32" cy="32" rx="11" ry="26" transform="rotate(-60 32 32)" />
      </g>
      <path fill="#fff" d="M32 22.5 40.5 26 32 29.5 23.5 26z" />
      <path fill="#fff" d="M27 29v2.6c0 .9 2.2 1.7 5 1.7s5-.8 5-1.7V29l-5 2z" />
      <path fill="none" stroke="#F59E0B" strokeWidth="0.9" d="M40.5 26v3.8" />
      <circle cx="40.5" cy="30.6" r="1.1" fill="#F59E0B" />
      <path fill="#fff" d="M31.3 37.2c-1.9-1.3-4.6-1.8-7.5-1.8v6.9c2.9 0 5.6.5 7.5 1.8zM32.7 37.2c1.9-1.3 4.6-1.8 7.5-1.8v6.9c-2.9 0-5.6.5-7.5 1.8z" />
    </svg>
  );
}

interface LogoProps {
  variant?: 'full' | 'mark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const dims = { sm: { mark: 28, text: 'text-[15px]' }, md: { mark: 32, text: 'text-[17px]' }, lg: { mark: 44, text: 'text-2xl' } };

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
