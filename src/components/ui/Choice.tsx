import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ChoiceCardProps {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}

/** A large selectable card backed by a real radio/checkbox, so keyboard and screen readers work natively. */
export function ChoiceCard({ type, name, value, checked, onChange, title, description, icon }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-400 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-ink-800',
        checked ? 'border-violet-400/70 bg-violet-500/[0.08]' : 'border-line-strong bg-ink-850 hover:border-ink-500 hover:bg-ink-750',
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {icon && (
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-[18px]',
            checked ? 'border-violet-400/40 bg-violet-500/15 text-violet-300' : 'border-line-strong bg-ink-700 text-fg-muted',
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-fg">{title}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center border transition-colors',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
          checked ? 'border-violet-400 bg-violet-500 text-white' : 'border-line-strong bg-ink-800',
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
    </label>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/** Compact radio group for filters and small option sets. */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  const name = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-ink-850 p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'relative flex h-8 flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-400',
              value === o.value ? 'bg-ink-600 text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-fg-muted">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="h-6 w-10 rounded-full border border-line-strong bg-ink-600 transition-colors peer-checked:border-violet-400 peer-checked:bg-violet-500 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-800"
        />
        <span
          aria-hidden
          className="absolute left-1 top-1 size-4 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform peer-checked:translate-x-4"
        />
      </span>
    </label>
  );
}
