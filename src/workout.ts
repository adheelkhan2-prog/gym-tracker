// Helpers that combine the program with what was logged.
import { EXERCISES } from './data/exercises';
import { pickOption, targetTop, type PlannedExercise, type WorkoutDay } from './data/program';
import { doneSets, num, type ExerciseLog, type SetEntry, type State } from './store';

export type SlotStatus = {
  plan: PlannedExercise;
  exerciseId: string;
  done: number;
  skipped: boolean;
  complete: boolean;
};

export function slotStatuses(state: State, day: WorkoutDay, date: string): SlotStatus[] {
  return day.exercises.map((plan) => {
    const exerciseId = pickOption(plan, state.variants);
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

export const logFor = (state: State, date: string, id: string): ExerciseLog | undefined => state.logs[date]?.[id];

export const WARMUP = [
  { icon: 'sync', text: 'Arm circles, 30 s each direction' },
  { icon: 'resize', text: 'Band pull-aparts × 20' },
  { icon: 'swap-vertical', text: 'Band shoulder dislocates × 10' },
  { icon: 'hand-left', text: 'Wrist circles and finger stretches, 30 s' },
  { icon: 'barbell', text: 'One light set of your first exercise × 15' },
] as const;
