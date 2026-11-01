import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SUBJECTS } from '@/data/catalog';
import type { Subject } from '@/types';

type Tone = 'neutral' | 'violet' | 'cyan' | 'mint' | 'amber' | 'rose';

const tones: Record<Tone, string> = {
  neutral: 'border-line-strong bg-ink-700/60 text-fg-muted',
  violet: 'border-violet-400/25 bg-violet-500/10 text-violet-300',
  cyan: 'border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-300',
  mint: 'border-mint-400/20 bg-mint-400/[0.08] text-mint-400',
  amber: 'border-amber-300/20 bg-amber-300/[0.08] text-amber-300',
  rose: 'border-rose-400/25 bg-rose-400/10 text-rose-400',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-xs font-medium [&_svg]:size-3',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SubjectTag({ subject, className }: { subject: Subject | 'mixed'; className?: string }) {
  if (subject === 'mixed') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted', className)}>
        <span className="flex -space-x-0.5" aria-hidden>
          <span className="size-1.5 rounded-full bg-subj-phy" />
          <span className="size-1.5 rounded-full bg-subj-chem" />
          <span className="size-1.5 rounded-full bg-subj-math" />
        </span>
        Mixed subjects
      </span>
    );
  }
  const s = SUBJECTS[subject];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted', className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}
