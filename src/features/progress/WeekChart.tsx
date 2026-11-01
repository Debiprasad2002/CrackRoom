import { cn } from '@/lib/cn';
import { dayKey, fmt, formatMinutes } from '@/lib/date';

interface Day {
  date: Date;
  key: string;
  minutes: number;
}

interface WeekChartProps {
  days: Day[];
  goalMinutes: number;
  height?: number;
  title: string;
}

/** Single-series column chart: focus minutes per day against a hairline daily-goal reference. */
export function WeekChart({ days, goalMinutes, height = 160, title }: WeekChartProps) {
  const today = dayKey();
  const max = Math.max(goalMinutes, ...days.map((d) => d.minutes)) * 1.12 || 60;
  const goalPct = (goalMinutes / max) * 100;
  const summary = days.map((d) => `${fmt.weekday(d.date)} ${formatMinutes(d.minutes)}`).join(', ');

  return (
    <figure className="w-full">
      <div className="relative" style={{ height }} role="img" aria-label={`${title}. Daily goal ${formatMinutes(goalMinutes)}. ${summary}.`}>
        {/* Goal reference: hairline, labelled at the right end. */}
        <div className="pointer-events-none absolute inset-x-0 border-t border-line-strong" style={{ bottom: `${goalPct}%` }} aria-hidden>
          <span className="absolute -top-2.5 right-0 bg-ink-800 pl-1.5 text-[11px] font-medium text-fg-subtle tabular">
            Goal {formatMinutes(goalMinutes)}
          </span>
        </div>
        <div className="absolute inset-0 grid grid-cols-7 items-end border-b border-line">
          {days.map((d) => {
            const isToday = d.key === today;
            const isFuture = d.key > today;
            const pct = (d.minutes / max) * 100;
            return (
              <div key={d.key} className="group relative flex h-full items-end justify-center">
                {d.minutes > 0 && (
                  <div
                    className={cn('w-full max-w-6 rounded-t-[4px] transition-[height] duration-500 ease-out', isToday ? 'bg-violet-500' : 'bg-violet-500/55')}
                    style={{ height: `${pct}%` }}
                  />
                )}
                {isToday && d.minutes > 0 && (
                  <span className="absolute text-[11px] font-semibold text-fg tabular" style={{ bottom: `calc(${pct}% + 4px)` }}>
                    {formatMinutes(d.minutes)}
                  </span>
                )}
                {!isFuture && (
                  <span
                    className="pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-lg border border-line-strong bg-ink-700 px-2.5 py-1.5 text-xs shadow-pop group-hover:block"
                    style={{ bottom: `min(calc(${pct}% + 22px), calc(100% - 8px))` }}
                  >
                    <span className="block text-fg-subtle">{fmt.date(d.date)}</span>
                    <span className="block font-semibold text-fg tabular">{formatMinutes(d.minutes)} focused</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-medium" aria-hidden>
        {days.map((d) => (
          <span key={d.key} className={d.key === today ? 'text-fg' : 'text-fg-subtle'}>
            {fmt.weekday(d.date).slice(0, 2)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Focus time</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.key}>
              <td>{fmt.date(d.date)}</td>
              <td>{formatMinutes(d.minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
