// Focus mode logic: what each set is pre-filled with, so logging a set is one tap.
import { EXERCISES } from './data/exercises';
import { targetTop, type PlannedExercise } from './data/program';
import { fromKg, loadTypeOf, round1, weightFromLoad, type LoadInfo, type Unit } from './load';
import { doneSets, kgOf, num, previousSession, type SetEntry, type State } from './store';
import { hitTopOfRange } from './workout';

/** Bottom of the rep/time range ("8-12" -> 8, "15" -> 15, "max" -> null). */
export const targetBottom = (target: string) => {
  const n = target.match(/\d+/g);
  return n ? Math.min(...n.map(Number)) : null;
};

/** Weight step in a unit: 2.5 kg or 5 lb. */
export const stepFor = (unit: Unit) => (unit === 'kg' ? 2.5 : 5);

/** A set's weight in `unit`, rounded to that unit's step (old sets keep their own unit). */
export function weightIn(s: SetEntry, unit: Unit) {
  const kg = kgOf(s);
  if (kg === null) return null;
  if ((s.u ?? unit) === unit) return num(s.weight);
  const step = stepFor(unit);
  return Math.round(fromKg(kg, unit) / step) * step;
}

export type Suggestion = {
  /** The set as it will be saved on one tap (done: false). */
  set: SetEntry;
  /** Why these numbers: today's earlier set, last session, a step up, or the plan's target. */
  reason: 'today' | 'last' | 'up' | 'target';
  /** Last session's matching set, for "Last time" text. */
  last?: SetEntry;
};

/**
 * What set `i` of an exercise is pre-filled with:
 * 1. a value already typed for that set today;
 * 2. else the previous set done today (same weight, the plan's reps);
 * 3. else last session's set i, one step heavier (or one pin up) when every set last time hit
 *    the top of the range, with reps back at the bottom of the range;
 * 4. else the plan's target reps, with no weight yet (first time).
 * The load type (pin, plates, colours) and any swap are remembered elsewhere and used as is.
 */
export function suggestSet(state: State, exerciseId: string, plan: PlannedExercise | undefined, date: string, i: number): Suggestion {
  const ex = EXERCISES[exerciseId];
  const kind = ex.kind;
  const unit = state.unit;
  const weighted = kind === 'weight_reps' || kind === 'weight_time';
  const lt = loadTypeOf(exerciseId, state.loadTypes);
  const machine = state.machines[exerciseId];
  const top = plan ? targetTop(plan.target) : null;
  const bottom = plan ? targetBottom(plan.target) : null;
  const today = state.logs[date]?.[exerciseId]?.sets ?? [];
  const prev = previousSession(state.logs, exerciseId, date);
  const last = prev ? (prev.sets[i] ?? prev.sets[prev.sets.length - 1]) : undefined;

  const withLoad = (l: LoadInfo, reps: string): SetEntry => ({ ...weightFromLoad(l, state.gym, machine), reps, done: false });
  const plain = (w: number | null, reps: string): SetEntry =>
    weighted ? { weight: w === null ? '' : round1(w), u: unit, reps, done: false } : { weight: '', reps, done: false };

  // 1. Typed for this set today (not yet done).
  const own = today[i];
  if (own && !own.done && (own.reps || own.weight || own.load)) return { set: { ...own, done: false }, reason: 'today', last };

  // 2. The previous set done today.
  const before = [...today.slice(0, i)].reverse().find((s) => s.done);
  if (before) {
    const reps = before.reps || String(top ?? '');
    if (weighted && before.load && before.load.t === lt && lt !== 'weight') return { set: withLoad(before.load, reps), reason: 'today', last };
    return { set: plain(weighted ? weightIn(before, unit) : null, reps), reason: 'today', last };
  }

  // 3. Last session, stepped up when it hit the top of the range on every set.
  if (prev && last) {
    const up = !!plan && hitTopOfRange(prev.sets, plan);
    const reps = up && bottom ? String(bottom) : last.reps || String(top ?? '');
    if (!weighted) {
      const r = num(last.reps) ?? 0;
      return { set: plain(null, up ? String(r + (kind === 'time' ? 10 : 1)) : last.reps), reason: up ? 'up' : 'last', last };
    }
    if (lt !== 'weight' && last.load?.t === lt) {
      const l = lt === 'stack' && up && last.load.pin !== undefined ? { ...last.load, pin: last.load.pin + 1 } : last.load;
      return { set: withLoad(l, reps), reason: up && lt === 'stack' ? 'up' : 'last', last };
    }
    const w = weightIn(last, unit);
    return { set: plain(w === null ? null : up ? w + stepFor(unit) : w, reps), reason: up ? 'up' : 'last', last };
  }

  // 4. First time: the plan's target.
  return { set: plain(null, String(top ?? bottom ?? '')), reason: 'target' };
}

/** What a set still needs before it can be logged, and how to say it. */
export function missingFor(set: SetEntry, exerciseId: string, loadType: string) {
  const kind = EXERCISES[exerciseId].kind;
  const weighted = kind === 'weight_reps' || kind === 'weight_time';
  const secs = kind === 'time' || kind === 'weight_time';
  const load = weighted && set.weight === '' && set.load?.pin === undefined;
  const reps = !(num(set.reps) && num(set.reps)! > 0);
  const loadWord = loadType === 'stack' ? 'pin' : 'weight';
  const repsWord = secs ? 'seconds' : 'reps';
  const parts = [load && `your ${loadWord}`, reps && (load ? repsWord : `your ${repsWord}`)].filter(Boolean);
  return { load, reps, message: parts.length ? `Add ${parts.join(' and ')} first` : '' };
}

/** True when the set can be logged as is (reps above zero, and a weight or pin when weighted). */
export function readyToLog(set: SetEntry, exerciseId: string) {
  const m = missingFor(set, exerciseId, set.load?.t ?? 'weight');
  return !m.load && !m.reps;
}

/** Done sets for an exercise today. */
export const doneToday = (state: State, exerciseId: string, date: string) =>
  doneSets(state.logs[date]?.[exerciseId], EXERCISES[exerciseId].kind).length;
