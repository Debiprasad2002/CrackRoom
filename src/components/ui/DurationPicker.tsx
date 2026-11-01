import { useId, useState } from 'react';
import { formatMinutes } from '@/lib/date';
import { Segmented } from '@/components/ui/Choice';
import { Input } from '@/components/ui/Field';

interface DurationPickerProps {
  label: string;
  /** Quick choices; anything else is entered with Custom. */
  presets: { minutes: number; label: string }[];
  value: number;
  onChange: (minutes: number) => void;
  /** Show an hours box as well as minutes (for long focus blocks). */
  withHours?: boolean;
  maxHours?: number;
  error?: string;
  hint?: string;
}

/** Preset chips plus a Custom option with hours and minutes boxes. */
export function DurationPicker({ label, presets, value, onChange, withHours = false, maxHours = 24, error, hint }: DurationPickerProps) {
  const id = useId();
  const [custom, setCustom] = useState(() => !presets.some((p) => p.minutes === value));
  const hours = Math.floor(value / 60);
  const minutes = withHours ? value % 60 : value;

  function setParts(h: number, m: number) {
    const safeH = Math.min(maxHours, Math.max(0, Number.isFinite(h) ? Math.floor(h) : 0));
    const safeM = Math.max(0, Number.isFinite(m) ? Math.floor(m) : 0);
    onChange(withHours ? safeH * 60 + Math.min(59, safeM) : safeM);
  }

  return (
    <fieldset aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className="mb-2 text-sm font-medium text-fg">{label}</legend>
      <Segmented
        label={label}
        className="w-full"
        value={custom ? 'custom' : String(value)}
        options={[...presets.map((p) => ({ value: String(p.minutes), label: p.label })), { value: 'custom', label: 'Custom' }]}
        onChange={(v) => {
          if (v === 'custom') {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(Number(v));
        }}
      />
      {custom && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-ink-850 p-3">
          {withHours && (
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
              Hours
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={maxHours}
                value={hours}
                onChange={(e) => setParts(Number(e.target.value), minutes)}
                className="h-11 w-24 text-center tabular"
                aria-invalid={Boolean(error)}
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
            Minutes
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={withHours ? 59 : undefined}
              step={withHours ? 5 : 1}
              value={minutes}
              onChange={(e) => setParts(hours, Number(e.target.value))}
              className="h-11 w-24 text-center tabular"
              aria-invalid={Boolean(error)}
            />
          </label>
          <p className="pb-3 text-sm font-semibold text-fg tabular" aria-live="polite">
            = {value > 0 ? formatMinutes(value) : 'no time'}
          </p>
        </div>
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose-400">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-fg-subtle">
            {hint}
          </p>
        )
      )}
    </fieldset>
  );
}
