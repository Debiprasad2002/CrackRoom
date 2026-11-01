import { Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Achievement } from './achievements';

export function AchievementList({ items }: { items: Achievement[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => {
        const Icon = a.icon;
        return (
          <li
            key={a.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3',
              a.unlocked ? 'border-violet-400/30 bg-violet-500/[0.07]' : 'border-line bg-ink-850',
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                a.unlocked ? 'bg-violet-500/20 text-violet-300' : 'bg-ink-700 text-fg-subtle',
              )}
              aria-hidden
            >
              {a.unlocked ? <Icon className="size-[18px]" /> : <Lock className="size-4" />}
            </span>
            <div className="min-w-0">
              <p className={cn('truncate text-sm font-medium', a.unlocked ? 'text-fg' : 'text-fg-muted')}>
                {a.title}
                <span className="sr-only">{a.unlocked ? ' (unlocked)' : ' (locked)'}</span>
              </p>
              <p className="truncate text-xs text-fg-subtle">{a.unlocked ? a.description : `${a.description} · ${a.progress}`}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
