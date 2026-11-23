import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EXERCISES, loadsInjury, type LogKind } from './data/exercises';
import { INJURY_REGIONS, type MuscleId } from './data/muscles';
import { DEFAULT_WEEK, pickOption, type WorkoutDay } from './data/program';
import { PROGRAMS, hasLegWork, type Program } from './data/programs';
import { DEFAULT_GYM, stackKg, toKg, type Gym, type LoadInfo, type LoadType, type MachineSetup, type Unit } from './load';

export type { Unit } from './load';
/**
 * One set. `reps` holds seconds for timed exercises; `weight` is empty for reps-only ones.
 * `weight` is in the set's own unit `u` (kg or lb), so switching units never rewrites history.
 * `load` keeps the pin / plates / colours the set was logged with.
 */
export type SetEntry = { weight: string; reps: string; done: boolean; u?: Unit; load?: LoadInfo };
/** `carried`: sets of this slot done today on another exercise before a mid-workout swap. They stay
 * logged under that exercise (its history and PRs); here they only count towards the slot. */
export type ExerciseLog = { sets: SetEntry[]; skipped?: boolean; carried?: number };
export type DayLog = Record<string, ExerciseLog>; // exerciseId -> log
export type Session = { dayId: string; startedAt?: number; finishedAt?: number };

export type State = {
  unit: Unit;
  week: (string | null)[];
  logs: Record<string, DayLog>; // 'YYYY-MM-DD' -> exercises
  sessions: Record<string, Session>;
  variants: Record<string, string>; // program slot -> chosen exercise
  warmups: Record<string, boolean>; // date -> warm-up done
  injured: boolean;
  restSound: boolean;
  /** Frosted blur on glass panels (off = tinted see-through panels, lighter on the GPU). */
  blur: boolean;
  supplements: string[];
  remindersOn: boolean;
  reminderTimes: string[]; // 'HH:MM'; first is the morning reminder, the rest are follow-ups
  taken: Record<string, Record<string, boolean>>; // date -> supplement -> taken
  /** Active program. `week` above is its weekday -> day mapping. */
  programId: string;
  /** A switch confirmed for a later date (e.g. "from Monday"). */
  pending: { programId: string; week: (string | null)[]; from: string } | null;
  customPrograms: Program[];
  /** Program slot -> exercise actually done instead of the planned one. */
  swaps: Record<string, string>;
  loadTypes: Record<string, LoadType>;
  machines: Record<string, MachineSetup>;
  gym: Gym;
  /** Date injury mode was turned off: shows the "ease in" card for two weeks. */
  easeInFrom: string | null;
  easeInDismissed: boolean;
};

export const DEFAULT_STATE: State = {
  unit: 'lb',
  week: DEFAULT_WEEK,
  logs: {},
  sessions: {},
  variants: {},
  warmups: {},
  injured: true,
  restSound: true,
  blur: true,
  supplements: ['Creatine', 'Protein'],
  remindersOn: true,
  reminderTimes: ['08:00', '13:00', '19:00'],
  taken: {},
  programId: 'upper5',
  pending: null,
  customPrograms: [],
  swaps: {},
  loadTypes: {},
  machines: {},
  gym: DEFAULT_GYM,
  easeInFrom: null,
  easeInDismissed: false,
};

export const STORAGE_KEY = 'gym-tracker/state/v3';
const V2_KEY = 'gym-tracker/state/v2';
const OLD_KEY = 'gym-tracker/state/v1';
export const BACKUP_PREFIX = 'gym-tracker/state/unreadable-backup-';

// Exercises from the first version of the app that still exist in the new program.
const OLD_IDS: Record<string, string> = {
  'Barbell_Bench_Press_-_Medium_Grip': 'flat_bench',
  Incline_Dumbbell_Press: 'incline_db_press',
  Seated_Dumbbell_Press: 'db_shoulder_press',
  Side_Lateral_Raise: 'lateral_raise',
  Cable_Crossover: 'cable_crossover',
  'Triceps_Pushdown_-_Rope_Attachment': 'rope_pushdown',
  'Wide-Grip_Lat_Pulldown': 'lat_pulldown',
  Bent_Over_Barbell_Row: 'bb_bent_row',
  Seated_Cable_Rows: 'seated_cable_row',
  Dumbbell_Shrug: 'db_shrug',
  Hammer_Curls: 'hammer_curl',
  Dumbbell_Bench_Press: 'flat_db_press',
  Pullups: 'pull_ups',
};

/**
 * Read the saved state (current key, else v2, else v1) and migrate it. Returns null for a fresh
 * install. If saved data can't be read, a copy is kept under BACKUP_PREFIX before the app starts
 * fresh, so the first save can never destroy the only copy of someone's history.
 */
export async function loadState(): Promise<State | null> {
  let raw: string | null = null;
  try {
    raw = (await AsyncStorage.getItem(STORAGE_KEY)) ?? (await AsyncStorage.getItem(V2_KEY));
    if (raw) return applyPending(migrate(JSON.parse(raw), false));
    raw = await AsyncStorage.getItem(OLD_KEY);
    if (raw) return migrate(JSON.parse(raw), true);
    return null;
  } catch {
    if (raw) await AsyncStorage.setItem(`${BACKUP_PREFIX}${Date.now()}`, raw).catch(() => {});
    return null;
  }
}

/** Turn a saved state from any version into the current shape. */
export function migrate(raw: unknown, fromOld: boolean): State {
  const r = (raw ?? {}) as Partial<State> & { logs?: Record<string, Record<string, unknown>> };
  // Sets saved before v3 have no unit of their own: they were typed in the unit chosen at the time.
  const legacyUnit: Unit = r.unit === 'kg' ? 'kg' : 'lb';
  const logs: State['logs'] = {};
  for (const [date, day] of Object.entries(r.logs ?? {})) {
    const out: DayLog = {};
    for (const [id, v] of Object.entries(day ?? {})) {
      // v1 ids are mapped to the new library (unmapped ones never existed in it). From v2 on, every
      // log is kept, even for an exercise this version doesn't know (e.g. removed in an update), so
      // an update can never delete history; screens skip ids they can't show.
      const newId = fromOld ? OLD_IDS[id] : id;
      if (!newId || (fromOld && !EXERCISES[newId])) continue;
      const log = Array.isArray(v) ? { sets: v as SetEntry[] } : (v as ExerciseLog);
      out[newId] = { ...log, sets: (log.sets ?? []).map((st) => (st.u ? st : { ...st, u: legacyUnit })) };
    }
    if (Object.keys(out).length) logs[date] = out;
  }
  const merged = { ...DEFAULT_STATE, ...(r as Partial<State>) };
  const program = programById(merged, merged.programId) ?? PROGRAMS[0];
  const validWeek =
    Array.isArray(r.week) && r.week.length === 7 && r.week.every((d) => d === null || program.days.some((x) => x.id === d));
  return {
    ...merged,
    programId: program.id,
    week: validWeek ? (r.week as State['week']) : program.week,
    logs,
    sessions: fromOld ? {} : (r.sessions ?? {}),
    variants: r.variants ?? {},
    gym: { ...DEFAULT_GYM, ...(r.gym ?? {}) },
  };
}

// ---------- Programs ----------

export const allPrograms = (state: Pick<State, 'customPrograms'>) => [...PROGRAMS, ...(state.customPrograms ?? [])];

export const programById = (state: Pick<State, 'customPrograms'>, id: string | undefined) =>
  allPrograms(state).find((p) => p.id === id);

export const activeProgram = (state: State) => programById(state, state.programId) ?? PROGRAMS[0];

/** Find a workout day in any program, so old sessions still resolve after a switch. */
export function dayById(state: State, id: string | null | undefined): WorkoutDay | undefined {
  if (!id) return undefined;
  const active = activeProgram(state).days.find((d) => d.id === id);
  if (active) return active;
  for (const p of allPrograms(state)) {
    const d = p.days.find((x) => x.id === id);
    if (d) return d;
  }
  return undefined;
}

/** Apply a pending program switch once its start date arrives. */
export function applyPending(state: State, today = todayKey()): State {
  const p = state.pending;
  if (!p || p.from > today || !programById(state, p.programId)) return state;
  return { ...state, programId: p.programId, week: p.week, pending: null };
}

export const todayKey = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const dateFromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, n: number) => {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + n);
  return todayKey(d);
};

type Ctx = {
  state: State;
  ready: boolean;
  update: (fn: (s: State) => State) => void;
  /** Apply a change and write it to storage now (not after the usual short delay). Use before
   * anything heavy that could crash, e.g. the workout-complete celebration. */
  commit: (fn: (s: State) => State) => Promise<void>;
};
const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadState().then((loaded) => {
      if (loaded) setState(loaded);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 250);
  }, [state, ready]);

  // Latest state, so commit() can compute and save the next state synchronously.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const update = useCallback(
    (fn: (s: State) => State) =>
      setState((prev) => {
        const next = fn(prev);
        latest.current = next;
        return next;
      }),
    [],
  );
  const commit = useCallback(async (fn: (s: State) => State) => {
    const next = fn(latest.current);
    latest.current = next;
    setState(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);
  const value = useMemo(() => ({ state, ready, update, commit }), [state, ready, update, commit]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

// ---------- Sets ----------

export const num = (s: string | undefined) => {
  if (s === undefined || s === '') return null;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export const kindOf = (exerciseId: string): LogKind => EXERCISES[exerciseId]?.kind ?? 'weight_reps';

/** Kilograms lifted on a set, or null when it isn't known (e.g. a pin on a machine that isn't set up). */
export const kgOf = (s: SetEntry) => {
  const w = num(s.weight);
  return w === null ? null : toKg(w, s.u ?? 'lb');
};

/** kg for a set, also converting a pin-only set once its machine has kg per plate set up. */
export const setKg = (s: SetEntry, machine?: MachineSetup) => kgOf(s) ?? (s.load?.pin !== undefined ? stackKg(s.load.pin, machine) : null);

const weighted = (kind: LogKind) => kind === 'weight_reps' || kind === 'weight_time';

/** A finished set with every number its exercise needs. */
export const isComplete = (s: SetEntry, kind: LogKind) =>
  s.done && num(s.reps) !== null && (!weighted(kind) || num(s.weight) !== null || s.load?.pin !== undefined);

export const doneSets = (log: ExerciseLog | undefined, kind: LogKind) =>
  (log?.sets ?? []).filter((s) => isComplete(s, kind));

/**
 * The number a PR is judged on: kg for loaded lifts, reps (or seconds) otherwise.
 * Pin-only sets have no kg, so they score 0 here and are charted by pin instead.
 */
export const prMetric = (s: SetEntry, kind: LogKind) => (weighted(kind) ? (kgOf(s) ?? 0) : num(s.reps)!);

/** Epley estimated one-rep max. */
export const est1RM = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));

export function previousSession(logs: State['logs'], exerciseId: string, beforeDate: string) {
  const kind = kindOf(exerciseId);
  const dates = Object.keys(logs)
    .filter((d) => d < beforeDate && doneSets(logs[d][exerciseId], kind).length > 0)
    .sort();
  const date = dates[dates.length - 1];
  return date ? { date, sets: doneSets(logs[date][exerciseId], kind) } : null;
}

/** Best PR metric before a date (0 when there is no history). */
export function bestBefore(logs: State['logs'], exerciseId: string, beforeDate: string) {
  const kind = kindOf(exerciseId);
  let best = 0;
  for (const [date, day] of Object.entries(logs)) {
    if (date >= beforeDate) continue;
    for (const s of doneSets(day[exerciseId], kind)) best = Math.max(best, prMetric(s, kind));
  }
  return best;
}

/** Sets on `date` that beat everything logged before that date. */
export function prSetsOn(logs: State['logs'], date: string) {
  const out: { exerciseId: string; value: number }[] = [];
  for (const [id, log] of Object.entries(logs[date] ?? {})) {
    const kind = kindOf(id);
    const best = bestBefore(logs, id, date);
    if (best <= 0) continue; // first time is a baseline, not a record
    const top = Math.max(0, ...doneSets(log, kind).map((s) => prMetric(s, kind)));
    if (top > best) out.push({ exerciseId: id, value: top });
  }
  return out;
}

/** PRs per date in one chronological pass (running best per exercise). */
export function prCountsByDate(logs: State['logs']) {
  const best: Record<string, number> = {};
  const out: Record<string, number> = {};
  for (const date of Object.keys(logs).sort()) {
    let n = 0;
    const tops: [string, number][] = [];
    for (const [id, log] of Object.entries(logs[date])) {
      const kind = kindOf(id);
      const top = Math.max(0, ...doneSets(log, kind).map((s) => prMetric(s, kind)));
      if (!top) continue;
      if ((best[id] ?? 0) > 0 && top > best[id]) n++;
      tops.push([id, top]);
    }
    for (const [id, top] of tops) best[id] = Math.max(best[id] ?? 0, top);
    out[date] = n;
  }
  return out;
}

/** `top` is kg (or reps/seconds); `pin` is set when the exercise was only logged by machine pin. */
export type HistoryPoint = {
  date: string;
  top: number;
  topReps: number;
  e1rm: number;
  volume: number;
  seconds: number;
  pin?: number;
};

/**
 * One point per day. `machine` (the exercise's current stack setup) turns old pin-only sets into kg,
 * so logging pins first and adding kg per plate later still charts one continuous line.
 */
export function exerciseHistory(logs: State['logs'], exerciseId: string, machine?: MachineSetup): HistoryPoint[] {
  const kind = kindOf(exerciseId);
  const kgFor = (s: SetEntry) => setKg(s, machine);
  const metric = (s: SetEntry) => (kind === 'weight_reps' || kind === 'weight_time' ? (kgFor(s) ?? 0) : num(s.reps)!);
  return Object.keys(logs)
    .sort()
    .flatMap((date) => {
      const sets = doneSets(logs[date][exerciseId], kind);
      if (!sets.length) return [];
      let top = sets[0];
      let e1rm = 0;
      let volume = 0;
      let seconds = 0;
      let pin = 0;
      for (const s of sets) {
        const w = kgFor(s) ?? 0;
        const r = num(s.reps)!;
        if (kind === 'weight_time' || kind === 'time') seconds += r;
        else volume += kind === 'reps' ? r : w * r;
        const better = metric(s) > metric(top) || (metric(s) === metric(top) && r > num(top.reps)!);
        if (better) top = s;
        if (kind === 'weight_reps') e1rm = Math.max(e1rm, est1RM(w, r));
        if (s.load?.pin !== undefined && kgFor(s) === null) pin = Math.max(pin, s.load.pin);
      }
      const point: HistoryPoint = { date, top: metric(top), topReps: num(top.reps)!, e1rm, volume, seconds };
      if (point.top === 0 && pin > 0) point.pin = pin;
      return [point];
    });
}

// ---------- Days, streaks, badges ----------

/** A day counts as trained when any set was finished or any exercise was skipped for joint pain. */
export const trainedOn = (state: State, date: string) =>
  Object.entries(state.logs[date] ?? {}).some(([id, l]) => l.skipped || doneSets(l, kindOf(id)).length > 0);

/** False for a day whose every exercise is hidden by injury mode (e.g. leg day): it counts as rest. */
export function dayHasWork(state: State, dayId: string | null | undefined) {
  const day = dayById(state, dayId);
  if (!day) return false;
  if (!state.injured) return true;
  return day.exercises.some((p) => {
    const sw = state.swaps[p.slot];
    return !loadsInjury(sw && EXERCISES[sw] ? sw : pickOption(p, state.variants));
  });
}

const scheduled = (state: State, date: string) => dayHasWork(state, state.week[dateFromKey(date).getDay()]);

/** Consecutive scheduled training days trained. Rest days don't break it; today doesn't until it's over. */
export function trainingStreak(state: State, today = todayKey()) {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const d = addDays(today, -i);
    const isScheduled = scheduled(state, d);
    if (trainedOn(state, d)) n++;
    else if (isScheduled && i > 0) break;
  }
  return n;
}

export const allTaken = (state: State, date: string) =>
  state.supplements.length > 0 && state.supplements.every((x) => state.taken[date]?.[x]);

export function supplementStreak(state: State, today = todayKey()) {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const d = addDays(today, -i);
    if (allTaken(state, d)) n++;
    else if (i > 0) break;
  }
  return n;
}

/** Monday..Sunday keys of the week containing `date`. */
export function weekKeys(date = todayKey()) {
  const dow = (dateFromKey(date).getDay() + 6) % 7; // Monday = 0
  return Array.from({ length: 7 }, (_, i) => addDays(date, i - dow));
}

/** Sets per muscle this week: primary muscles count 1 per set, secondary 0.5. */
export function weeklyMuscleSets(state: State, keys = weekKeys()) {
  const out: Partial<Record<MuscleId, number>> = {};
  for (const date of keys) {
    for (const [id, log] of Object.entries(state.logs[date] ?? {})) {
      const ex = EXERCISES[id];
      if (!ex) continue;
      const n = doneSets(log, ex.kind).length;
      if (!n) continue;
      for (const m of ex.primary) out[m] = (out[m] ?? 0) + n;
      for (const m of ex.secondary) out[m] = (out[m] ?? 0) + n * 0.5;
    }
  }
  if (state.injured) for (const m of INJURY_REGIONS) delete out[m];
  return out;
}

/**
 * Show the "welcome back, ease in" card for the first two weeks after injury mode is turned OFF,
 * and only when the active program actually brings leg/ab work back (never on the upper-body
 * injury program, never while injury mode is on).
 */
export function easingIn(state: State, today = todayKey()) {
  if (state.injured || !state.easeInFrom || state.easeInDismissed) return false;
  if (!hasLegWork(activeProgram(state))) return false;
  return today < addDays(state.easeInFrom, 14);
}

export function weekSummary(state: State, today = todayKey()) {
  const keys = weekKeys(today);
  const planned = keys.filter((d) => scheduled(state, d)).length;
  const trained = keys.filter((d) => trainedOn(state, d)).length;
  const prs = keys.reduce((n, d) => n + prSetsOn(state.logs, d).length, 0);
  const supps = keys.filter((d) => allTaken(state, d)).length;
  const daysSoFar = keys.filter((d) => d <= today).length;
  return { planned, trained, prs, supps, daysSoFar };
}

export const formatDate = (key: string) =>
  dateFromKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
