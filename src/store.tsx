import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_WEEK } from './data/program';

export type Unit = 'kg' | 'lb';
export type SetEntry = { weight: string; reps: string; done: boolean };
export type DayLog = Record<string, SetEntry[]>; // exerciseId -> sets

export type State = {
  unit: Unit;
  week: (string | null)[];
  logs: Record<string, DayLog>; // 'YYYY-MM-DD' -> exercise logs
  supplements: string[];
  remindersOn: boolean;
  reminderTimes: string[]; // 'HH:MM'; first is the morning reminder, the rest are follow-ups
  taken: Record<string, Record<string, boolean>>; // date -> supplement -> taken
};

const DEFAULT_STATE: State = {
  unit: 'lb',
  week: DEFAULT_WEEK,
  logs: {},
  supplements: ['Creatine', 'Protein'],
  remindersOn: true,
  reminderTimes: ['08:00', '13:00', '19:00'],
  taken: {},
};

const KEY = 'gym-tracker/state/v1';

export const todayKey = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type Ctx = {
  state: State;
  ready: boolean;
  update: (fn: (s: State) => State) => void;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
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

// ---------- Workout helpers ----------

export const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Epley estimated one-rep max. */
export const est1RM = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));

const doneSets = (sets: SetEntry[] | undefined) =>
  (sets ?? []).filter((s) => s.done && num(s.weight) !== null && num(s.reps) !== null);

/** The most recent logged session for an exercise before a given date. */
export function previousSession(logs: State['logs'], exerciseId: string, beforeDate: string) {
  const dates = Object.keys(logs)
    .filter((d) => d < beforeDate && doneSets(logs[d][exerciseId]).length > 0)
    .sort();
  const date = dates[dates.length - 1];
  return date ? { date, sets: doneSets(logs[date][exerciseId]) } : null;
}

export type HistoryPoint = { date: string; topWeight: number; topReps: number; e1rm: number; volume: number };

export function exerciseHistory(logs: State['logs'], exerciseId: string): HistoryPoint[] {
  return Object.keys(logs)
    .sort()
    .flatMap((date) => {
      const sets = doneSets(logs[date][exerciseId]);
      if (!sets.length) return [];
      let top = sets[0];
      let best = 0;
      let volume = 0;
      for (const s of sets) {
        const w = num(s.weight)!;
        const r = num(s.reps)!;
        volume += w * r;
        if (w > num(top.weight)! || (w === num(top.weight)! && r > num(top.reps)!)) top = s;
        best = Math.max(best, est1RM(w, r));
      }
      return [{ date, topWeight: num(top.weight)!, topReps: num(top.reps)!, e1rm: best, volume }];
    });
}

/** Heaviest weight ever completed for an exercise (before a date, if given). */
export function bestWeight(logs: State['logs'], exerciseId: string, beforeDate?: string) {
  let best = 0;
  for (const [date, day] of Object.entries(logs)) {
    if (beforeDate && date >= beforeDate) continue;
    for (const s of doneSets(day[exerciseId])) best = Math.max(best, num(s.weight)!);
  }
  return best;
}

export const formatDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
