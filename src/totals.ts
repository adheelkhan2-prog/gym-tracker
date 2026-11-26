// Workout totals derived from the log (volume, previous same-day session).
import { EXERCISES } from './data/exercises';
import { doneSets, num, setKg, type State } from './store';

/** Kilograms × reps over loaded lifts on a day (each set converted from its own unit). */
export function volumeOn(state: State, date: string) {
  let v = 0;
  for (const [id, log] of Object.entries(state.logs[date] ?? {})) {
    if (EXERCISES[id]?.kind !== 'weight_reps') continue;
    // Pin-only sets count once the machine's kg per plate is known (same as the charts).
    for (const s of doneSets(log, 'weight_reps')) v += (setKg(s, state.machines?.[id]) ?? 0) * num(s.reps)!;
  }
  return Math.round(v);
}

/** The most recent earlier session of the same workout day, for "vs last Monday" comparisons. */
export function previousSameDay(state: State, date: string, dayId: string) {
  const prev = Object.entries(state.sessions)
    .filter(([d, s]) => d < date && s.dayId === dayId && volumeOn(state, d) > 0)
    .map(([d]) => d)
    .sort()
    .pop();
  return prev ?? null;
}

/** Percent change, rounded; null when there's nothing to compare against. */
export const pctChange = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
