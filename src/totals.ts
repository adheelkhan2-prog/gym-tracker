// Workout totals derived from the log (volume, previous same-day session).
import { EXERCISES } from './data/exercises';
import { doneSets, kgOf, num, type SetEntry, type State } from './store';

/** A set logged by machine pin (its pin number is never a weight in kg). */
export const isPinSet = (s: SetEntry) => s.load?.t === 'stack' || s.load?.pin !== undefined;

/**
 * Kilograms × reps over loaded lifts on a day, counting only sets logged as a weight (each in its
 * own unit). Machine-pin sets are never in it, even when a kg per plate was set up long ago: they
 * are counted separately (pinSetsOn).
 */
export function volumeOn(state: Pick<State, 'logs'>, date: string) {
  let v = 0;
  for (const [id, log] of Object.entries(state.logs[date] ?? {})) {
    if (EXERCISES[id]?.kind !== 'weight_reps') continue;
    for (const s of doneSets(log, 'weight_reps')) {
      if (isPinSet(s)) continue;
      v += (kgOf(s) ?? 0) * num(s.reps)!;
    }
  }
  return Math.round(v);
}

/** Sets logged by machine pin on a day (shown next to the kg volume, never added to it). */
export function pinSetsOn(state: Pick<State, 'logs'>, date: string) {
  let n = 0;
  for (const [id, log] of Object.entries(state.logs[date] ?? {})) {
    const kind = EXERCISES[id]?.kind;
    if (kind !== 'weight_reps' && kind !== 'weight_time') continue;
    n += doneSets(log, kind).filter(isPinSet).length;
  }
  return n;
}

/** "+ 6 pin sets" (or '' when there are none). */
export const pinSetsText = (n: number) => (n > 0 ? `+ ${n} pin set${n === 1 ? '' : 's'}` : '');

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
