import { Moon, Sun } from 'lucide-react';
import { setTheme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Segmented } from '@/components/ui/Choice';

/** One-tap switch for the navigation. Shows the theme it will change to. */
export function ThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = next === 'light' ? Sun : Moon;
  const label = next === 'light' ? 'Light mode' : 'Dark mode';
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Switch to ${label.toLowerCase()}`}
      aria-label={`Switch to ${label.toLowerCase()}`}
      className={cn('inline-flex items-center gap-3 text-fg-muted transition-colors hover:text-fg', className)}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      {withLabel && label}
    </button>
  );
}

export function AppearanceSetting() {
  const theme = useTheme();
  return (
    <Segmented
      label="Theme"
      className="w-full"
      value={theme}
      options={[
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
      ]}
      onChange={(value) => setTheme(value as 'dark' | 'light')}
    />
  );
}
