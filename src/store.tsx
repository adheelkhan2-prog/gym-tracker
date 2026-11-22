import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EXERCISES, type LogKind } from './data/exercises';
import { INJURY_REGIONS, type MuscleId } from './data/muscles';
import { DAYS, DEFAULT_WEEK } from './data/program';

export type Unit = 'kg' | 'lb';
/** One set. `reps` holds seconds for timed exercises; `weight` is empty for reps-only ones. */
export type SetEntry = { weight: string; reps: string; done: boolean };
export type ExerciseLog = { sets: SetEntry[]; skipped?: boolean };
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
  supplements: string[];
  remindersOn: boolean;
  reminderTimes: string[]; // 'HH:MM'; first is the morning reminder, the rest are follow-ups
  taken: Record<string, Record<string, boolean>>; // date -> supplement -> taken
};

export const DEFAULT_STATE: State = {
  unit: 'lb',
  week: DEFAULT_WEEK,
  logs: {},
  sessions: {},
  variants: {},
  warmups: {},
  injured: true,
  supplements: ['Creatine', 'Protein'],
  remindersOn: true,
  reminderTimes: ['08:00', '13:00', '19:00'],
  taken: {},
};

export const STORAGE_KEY = 'gym-tracker/state/v2';
const OLD_KEY = 'gym-tracker/state/v1';

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

/** Turn a saved state from any version into the current shape. */
export function migrate(raw: unknown, fromOld: boolean): State {
  const r = (raw ?? {}) as Partial<State> & { logs?: Record<string, Record<string, unknown>> };
  const logs: State['logs'] = {};
  for (const [date, day] of Object.entries(r.logs ?? {})) {
    const out: DayLog = {};
    for (const [id, v] of Object.entries(day ?? {})) {
      const newId = fromOld ? OLD_IDS[id] : id;
      if (!newId || !EXERCISES[newId]) continue;
      out[newId] = Array.isArray(v) ? { sets: v as SetEntry[] } : (v as ExerciseLog);
    }
    if (Object.keys(out).length) logs[date] = out;
  }
  const validWeek =
    Array.isArray(r.week) && r.week.length === 7 && r.week.every((d) => d === null || DAYS.some((x) => x.id === d));
  return {
    ...DEFAULT_STATE,
    ...(r as Partial<State>),
    week: validWeek ? (r.week as State['week']) : DEFAULT_WEEK,
    logs,
    sessions: fromOld ? {} : (r.sessions ?? {}),
    variants: r.variants ?? {},
  };
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

type Ctx = { state: State; ready: boolean; update: (fn: (s: State) => State) => void };
const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setState(migrate(JSON.parse(raw), false));
        else {
          const old = await AsyncStorage.getItem(OLD_KEY);
          if (old) setState(migrate(JSON.parse(old), true));
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 250);
  }, [state, ready]);

  const update = useCallback((fn: (s: State) => State) => setState(fn), []);
  const value = useMemo(() => ({ state, ready, update }), [state, ready, update]);
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

/** A finished set with every number its exercise needs. */
export const isComplete = (s: SetEntry, kind: LogKind) =>
  s.done && num(s.reps) !== null && (kind === 'reps' || num(s.weight) !== null);

export const doneSets = (log: ExerciseLog | undefined, kind: LogKind) =>
  (log?.sets ?? []).filter((s) => isComplete(s, kind));

/** The number a PR is judged on: weight for loaded lifts, reps for push-ups. */
export const prMetric = (s: SetEntry, kind: LogKind) => (kind === 'reps' ? num(s.reps)! : num(s.weight)!);

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

export type HistoryPoint = { date: string; top: number; topReps: number; e1rm: number; volume: number; seconds: number };

export function exerciseHistory(logs: State['logs'], exerciseId: string): HistoryPoint[] {
  const kind = kindOf(exerciseId);
  return Object.keys(logs)
    .sort()
    .flatMap((date) => {
      const sets = doneSets(logs[date][exerciseId], kind);
      if (!sets.length) return [];
      let top = sets[0];
      let e1rm = 0;
      let volume = 0;
      let seconds = 0;
      for (const s of sets) {
        const w = num(s.weight) ?? 0;
        const r = num(s.reps)!;
        if (kind === 'weight_time') seconds += r;
        else volume += kind === 'reps' ? r : w * r;
        const better = prMetric(s, kind) > prMetric(top, kind) || (prMetric(s, kind) === prMetric(top, kind) && r > num(top.reps)!);
        if (better) top = s;
        if (kind === 'weight_reps') e1rm = Math.max(e1rm, est1RM(w, r));
      }
      return [{ date, top: prMetric(top, kind), topReps: num(top.reps)!, e1rm, volume, seconds }];
    });
}

// ---------- Days, streaks, badges ----------

/** A day counts as trained when any set was finished or any exercise was skipped for joint pain. */
export const trainedOn = (state: State, date: string) =>
  Object.entries(state.logs[date] ?? {}).some(([id, l]) => l.skipped || doneSets(l, kindOf(id)).length > 0);

const scheduled = (state: State, date: string) => state.week[dateFromKey(date).getDay()] !== null;

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
