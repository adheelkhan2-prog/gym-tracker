// Helpers that combine the program with what was logged.
import { EXERCISES, loadsInjury, type LogKind } from './data/exercises';
import { pickOption, targetTop, type PlannedExercise, type WorkoutDay } from './data/program';
import { dayTitle } from './theme';
import { fmtKg, platesText, type Gym, type Unit } from './load';
import { doneSets, kgOf, num, type ExerciseLog, type SetEntry, type State } from './store';

/** The exercise actually done for a slot: a remembered swap, else the plan's own pick. */
export const exerciseFor = (state: Pick<State, 'swaps' | 'variants'>, plan: PlannedExercise) => {
  const sw = state.swaps?.[plan.slot];
  return sw && EXERCISES[sw] ? sw : pickOption(plan, state.variants);
};

/** Slots shown for a day. With injury mode on, anything loading legs or abs is hidden. */
export const visiblePlans = (state: State, day: WorkoutDay) =>
  day.exercises.filter((p) => !(state.injured && loadsInjury(exerciseFor(state, p))));

/** Big title for a day: the original split keeps its punchy names. */
export const titleOf = (day: WorkoutDay) => dayTitle[day.id] ?? day.name;
export const subtitleOf = (day: WorkoutDay) => (dayTitle[day.id] ? day.name : day.focus);

export type SlotStatus = {
  plan: PlannedExercise;
  exerciseId: string;
  done: number;
  skipped: boolean;
  complete: boolean;
};

export function slotStatuses(state: State, day: WorkoutDay, date: string): SlotStatus[] {
  return visiblePlans(state, day).map((plan) => {
    const exerciseId = exerciseFor(state, plan);
    const log = state.logs[date]?.[exerciseId];
    const done = doneSets(log, EXERCISES[exerciseId].kind).length;
    const skipped = !!log?.skipped;
    return { plan, exerciseId, done, skipped, complete: skipped || done >= plan.sets };
  });
}

export function dayProgress(state: State, day: WorkoutDay, date: string) {
  const st = slotStatuses(state, day, date);
  const total = st.reduce((n, x) => n + (x.skipped ? 0 : x.plan.sets), 0);
  const done = st.reduce((n, x) => n + (x.skipped ? 0 : Math.min(x.done, x.plan.sets)), 0);
  const next = st.find((x) => !x.complete);
  return { statuses: st, total, done, next, allDone: st.every((x) => x.complete) };
}

/** True when every target set reached the top of the range (and the range has a top). */
export function hitTopOfRange(sets: SetEntry[], plan: PlannedExercise) {
  const top = targetTop(plan.target);
  if (!top || plan.target === 'max') return false;
  const finished = sets.filter((s) => s.done && num(s.reps) !== null);
  return finished.length >= plan.sets && finished.slice(0, plan.sets).every((s) => num(s.reps)! >= top);
}

export function emptySets(n: number): SetEntry[] {
  return Array.from({ length: n }, () => ({ weight: '', reps: '', done: false }));
}

/** Colour names for a colour-plate set, e.g. "red + blue". */
export const colorNames = (ids: string[], gym: Gym) =>
  ids.map((c) => gym.colors.find((x) => x.id === c)?.name.toLowerCase() ?? c).join(' + ');

/** The load part of a set: "Pin 7 · 49 kg", "2×20 + bar · 60 kg", "50 kg". */
export function loadText(s: SetEntry, unit: Unit, gym: Gym) {
  const kg = kgOf(s);
  const w = kg !== null ? fmtKg(kg, unit) : '';
  const l = s.load;
  if (l?.t === 'stack' && l.pin !== undefined) return w ? `Pin ${l.pin} · ${w}` : `Pin ${l.pin}`;
  if (l?.t === 'plates' && l.plates) return `${platesText(l.plates, l.bar ?? 0)} · ${w}`;
  if (l?.t === 'colors' && l.colors) return `${l.colors.length ? colorNames(l.colors, gym) : 'empty'}${l.bar ? ' + bar' : ''} · ${w}`;
  return w;
}

/** A whole set as text: "Pin 7 · 49 kg × 10", "12 reps", "45 s". */
export function setText(s: SetEntry, kind: LogKind, unit: Unit, gym: Gym) {
  if (kind === 'reps') return `${s.reps} reps`;
  if (kind === 'time') return `${s.reps} s`;
  return `${loadText(s, unit, gym)} × ${s.reps}${kind === 'weight_time' ? ' s' : ''}`;
}

export const logFor = (state: State, date: string, id: string): ExerciseLog | undefined => state.logs[date]?.[id];

export const WARMUP = [
  { icon: 'sync', text: 'Arm circles, 30 s each direction' },
  { icon: 'resize', text: 'Band pull-aparts × 20' },
  { icon: 'swap-vertical', text: 'Band shoulder dislocates × 10' },
  { icon: 'hand-left', text: 'Wrist circles and finger stretches, 30 s' },
  { icon: 'barbell', text: 'One light set of your first exercise × 15' },
] as const;
