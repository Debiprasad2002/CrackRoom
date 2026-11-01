import { addDays, dayKey, fmt, formatMinutes, startOfWeek } from '@/lib/date';

const WEEKS = 12;
// Sequential, single hue (violet) from empty to goal met.
const STEPS = ['#E8EBF2', 'rgba(124,58,237,0.22)', 'rgba(124,58,237,0.45)', 'rgba(124,58,237,0.7)', '#6D28D9'];
const STEP_LABELS = ['No focus', 'Under a quarter of goal', 'Under half of goal', 'Under goal', 'Goal met'];

function step(minutes: number, goal: number) {
  if (minutes <= 0) return 0;
  const r = minutes / goal;
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 1) return 3;
  return 4;
}

/** Twelve weeks of daily focus, one cell per day, shaded against the daily goal. */
export function ConsistencyGrid({ byDay, goal }: { byDay: Map<string, number>; goal: number }) {
  const today = dayKey();
  const first = addDays(startOfWeek(new Date()), -(WEEKS - 1) * 7);
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(first, w * 7 + d);
      const key = dayKey(date);
      return { key, date, minutes: byDay.get(key) ?? 0, future: key > today };
    }),
  );
  const activeDays = weeks.flat().filter((d) => d.minutes > 0).length;
  const goalDays = weeks.flat().filter((d) => d.minutes >= goal).length;

  return (
    <figure>
      <div
        className="overflow-x-auto pb-1"
        role="img"
        aria-label={`Last ${WEEKS} weeks: studied on ${activeDays} days, met the daily goal on ${goalDays} days.`}
      >
        <div className="inline-grid grid-flow-col gap-1" style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}>
          {weeks.flat().map((d) => (
            <div
              key={d.key}
              title={d.future ? undefined : `${fmt.date(d.date)}: ${formatMinutes(d.minutes)}`}
              className="size-3.5 rounded-[3px] sm:size-[18px]"
              style={{
                background: d.future ? 'transparent' : STEPS[step(d.minutes, goal)],
                outline: d.key === today ? '1.5px solid #141A2E' : undefined,
                outlineOffset: 1,
              }}
            />
          ))}
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-subtle">
        <span>
          {activeDays} active days · goal met on {goalDays}
        </span>
        <span className="flex items-center gap-1.5">
          Less
          {STEPS.map((c, i) => (
            <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} title={STEP_LABELS[i]} aria-hidden />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
}
