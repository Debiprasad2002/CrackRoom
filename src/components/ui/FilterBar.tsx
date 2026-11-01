import { useState, type ReactNode } from 'react';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Input } from './Field';

interface Chip {
  value: string;
  label: string;
  dot?: string;
}

interface FilterBarProps {
  label: string;
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  /** Quick one-tap choices shown as a swipeable row on phones (e.g. subjects). */
  chips?: { value: string; options: Chip[]; onChange: (value: string) => void };
  /** The full set of filter controls. Inline on tablets and up; in a bottom sheet on phones. */
  children: ReactNode;
  /** Filters set in the sheet, not counting search or chips. */
  sheetCount: number;
  activeCount: number;
  summary?: ReactNode;
  onReset: () => void;
}

export function FilterBar({ label, query, onQuery, placeholder, chips, children, sheetCount, activeCount, summary, onReset }: FilterBarProps) {
  const roomy = useMediaQuery('(min-width: 640px)');
  const [open, setOpen] = useState(false);

  const search = (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
      <Input type="search" aria-label={label} placeholder={placeholder} value={query} onChange={(e) => onQuery(e.target.value)} className="pl-10" />
    </div>
  );

  const footer = (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <div className="text-sm text-fg-subtle" aria-live="polite">
        {summary}
      </div>
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw aria-hidden />
          Reset filters
        </Button>
      )}
    </div>
  );

  if (roomy) {
    return (
      <section aria-label={label} className="space-y-3">
        {search}
        {children}
        {footer}
      </section>
    );
  }

  return (
    <section aria-label={label} className="space-y-3">
      <div className="flex gap-2">
        {search}
        <Button variant="secondary" className="relative h-11 shrink-0 px-3.5" onClick={() => setOpen(true)} aria-label={`Filters${sheetCount ? `, ${sheetCount} active` : ''}`}>
          <SlidersHorizontal aria-hidden />
          Filters
          {sheetCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-violet-500 text-[11px] font-semibold text-white">{sheetCount}</span>
          )}
        </Button>
      </div>
      {chips && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Quick filter">
          {[{ value: '', label: 'All' }, ...chips.options].map((chip) => {
            const on = chips.value === chip.value;
            return (
              <button
                key={chip.value || 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => chips.onChange(chip.value)}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                  on ? 'border-violet-500 bg-violet-500 text-white' : 'border-line-strong bg-ink-800 text-fg-muted active:bg-ink-700',
                )}
              >
                {chip.dot && <span className={cn('size-1.5 rounded-full', on ? 'bg-white' : chip.dot)} aria-hidden />}
                {chip.label}
              </button>
            );
          })}
        </div>
      )}
      {footer}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Filters"
        footer={
          <>
            {activeCount > 0 && (
              <Button variant="ghost" onClick={onReset}>
                Reset
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>Show results</Button>
          </>
        }
      >
        <div className="[&_select]:h-12">{children}</div>
      </Dialog>
    </section>
  );
}
