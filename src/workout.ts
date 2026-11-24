// Helpers that combine the program with what was logged.
import { EXERCISES, type LogKind } from './data/exercises';
import { pickOption, targetTop, type PlannedExercise, type WorkoutDay } from './data/program';
import { dayTitle } from './theme';
import { fmtKg, type Unit } from './load';
import { doneSets, kgOf, num, type DayLog, type ExerciseLog, type SetEntry, type State } from './store';

/** The exercise actually done for a slot: a remembered swap, else the plan's own pick. */
export const exerciseFor = (state: Pick<State, 'swaps' | 'variants'>, plan: PlannedExercise) => {
  const sw = state.swaps?.[plan.slot];
  return sw && EXERCISES[sw] ? sw : pickOption(plan, state.variants);
};

/** Slots shown for a day (any whose exercise this version doesn't know are skipped). */
export const visiblePlans = (state: State, day: WorkoutDay) =>
  day.exercises.filter((p) => !!EXERCISES[exerciseFor(state, p)]);

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
    // Sets done before a mid-workout swap count towards the slot too.
    const done = doneSets(log, EXERCISES[exerciseId].kind).length + (log?.carried ?? 0);
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

/** The load part of a set: "Pin 7 · 49 kg", "Pin 7", "50 kg". */
export function loadText(s: SetEntry, unit: Unit) {
  const kg = kgOf(s);
  const w = kg !== null ? fmtKg(kg, unit) : '';
  const l = s.load;
  if (l?.t === 'stack' && l.pin !== undefined) return w ? `Pin ${l.pin} · ${w}` : `Pin ${l.pin}`;
  return w;
}

/** A whole set as text: "Pin 7 · 49 kg × 10", "12 reps", "45 s". */
export function setText(s: SetEntry, kind: LogKind, unit: Unit) {
  if (kind === 'reps') return `${s.reps} reps`;
  if (kind === 'time') return `${s.reps} s`;
  return `${loadText(s, unit)} × ${s.reps}${kind === 'weight_time' ? ' s' : ''}`;
}

export const logFor = (state: State, date: string, id: string): ExerciseLog | undefined => state.logs[date]?.[id];

export const WARMUP = [
  { icon: 'sync', text: 'Arm circles, 30 s each direction' },
  { icon: 'resize', text: 'Band pull-aparts × 20' },
  { icon: 'swap-vertical', text: 'Band shoulder dislocates × 10' },
  { icon: 'hand-left', text: 'Wrist circles and finger stretches, 30 s' },
  { icon: 'barbell', text: 'One light set of your first exercise × 15' },
] as const;

/**
 * Which workout day the Today screen shows.
 * - `picked`: a day tapped in the week strip (a preview, with a way back to today).
 * - Otherwise today's scheduled day, unless sets were already logged today under another day
 *   (you chose to train that one today); a session started but never logged no longer pins a day.
 */
export function todayDayId(state: State, date: string, weekday: number, picked?: string | null) {
  const scheduled = state.week[weekday] ?? null;
  if (picked) return { id: picked, preview: picked !== scheduled, scheduled };
  const sessionDay = state.sessions[date]?.dayId;
  const logged = Object.values(state.logs[date] ?? {}).some((l) => l.skipped || l.sets.some((s) => s.done));
  const id = sessionDay && logged ? sessionDay : scheduled;
  return { id, preview: false, scheduled, swappedDay: !!(sessionDay && logged && sessionDay !== scheduled) };
}

/**
 * Swap a slot to another exercise mid-workout. Sets already logged stay under the exercise they
 * were done on (history and PRs stay correct); the new exercise carries how many of the slot's
 * sets are already done, so only the remaining sets are left. Swapping back works the same way.
 */
export function swapSlot(state: State, date: string, plan: PlannedExercise, to: string): State {
  const from = exerciseFor(state, plan);
  if (from === to) return state;
  const day = state.logs[date] ?? {};
  const slotDone = (id: string) => doneSets(day[id], EXERCISES[id]?.kind ?? 'weight_reps').length;
  const total = slotDone(from) + (day[from]?.carried ?? 0);
  const carried = Math.max(0, total - slotDone(to));
  const swaps = { ...state.swaps };
  if (to === pickOption(plan, state.variants)) delete swaps[plan.slot];
  else swaps[plan.slot] = to;
  if (total === 0 && !day[to]) return { ...state, swaps };
  // The exercise left behind keeps its own sets (history, PRs) but no longer carries this slot's
  // count: that moves to the new exercise, so nothing is counted twice or left stale.
  const nextDay: DayLog = { ...day, [to]: { ...(day[to] ?? { sets: [] }), carried } };
  if (day[from]?.carried !== undefined) {
    const { carried: _c, ...rest } = day[from]!;
    void _c;
    nextDay[from] = rest;
  }
  const logs = { ...state.logs, [date]: nextDay };
  return { ...state, swaps, logs };
}
