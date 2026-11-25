// The workout calendar's data: a Monday-first month grid, what each day shows (workout finished,
// partial, supplements all taken), a month summary and one day's session. Everything is computed
// from the saved log for just the dates asked for; nothing extra is stored.
import { EXERCISES } from './data/exercises';
import {
  activeProgram,
  allTaken,
  dateFromKey,
  dayById,
  dayHasWork,
  doneSets,
  finishedOn,
  kgOf,
  prMetric,
  prSetsOn,
  todayKey,
  trainedOn,
  type SetEntry,
  type State,
} from './store';
import { volumeOn } from './totals';

/** Highest pin among pin-only sets of an exercise on a day (0 if none). */
const topPin = (sets: SetEntry[]) => Math.max(0, ...sets.filter((x) => x.done && x.load?.pin !== undefined && kgOf(x) === null).map((x) => x.load!.pin!));

/**
 * PRs on a day: kg (or reps / seconds) records as in the weekly tracker, plus machine-pin records
 * (pins are compared only with pins). Exercise -> what the record is judged on.
 */
export function dayPRs(state: Pick<State, 'logs'>, date: string): Map<string, { kind: 'metric' | 'pin'; value: number }> {
  const out = new Map<string, { kind: 'metric' | 'pin'; value: number }>();
  for (const p of prSetsOn(state.logs, date)) out.set(p.exerciseId, { kind: 'metric', value: p.value });
  for (const [id, l] of Object.entries(state.logs[date] ?? {})) {
    if (out.has(id)) continue;
    const today = topPin(l.sets);
    if (!today) continue;
    let before = 0;
    for (const [d, day] of Object.entries(state.logs)) if (d < date && day[id]) before = Math.max(before, topPin(day[id].sets));
    if (before > 0 && today > before) out.set(id, { kind: 'pin', value: today });
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Shift a { y, m } month by n months. */
export const addMonths = (ym: { y: number; m: number }, n: number) => {
  const t = ym.y * 12 + ym.m + n;
  return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
};

/** Every date of the month (keys), in order. */
export function monthDates(y: number, m: number) {
  const days = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => keyOf(y, m, i + 1));
}

/** Weeks of 7 cells, Monday first; cells outside the month are null. */
export function monthGrid(y: number, m: number): (string | null)[][] {
  const dates = monthDates(y, m);
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday = 0
  const cells: (string | null)[] = [...Array(lead).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** What a day shows: 'done' (finished with sets), 'partial' (sets logged, not finished) or null. */
export function dayMark(state: Pick<State, 'logs' | 'sessions'>, date: string): 'done' | 'partial' | null {
  if (!trainedOn(state, date)) return null;
  return finishedOn(state, date) ? 'done' : 'partial';
}

export type MonthSummary = { workouts: number; volume: number; prs: number; longestStreak: number };

/**
 * Workouts done, total volume (kg), PRs and the longest training streak in the month. A streak
 * counts trained days in a row; rest days in your week don't break it (rotating plans: 3+ days off do).
 */
export function monthSummary(state: State, y: number, m: number, today = todayKey()): MonthSummary {
  const dates = monthDates(y, m).filter((d) => d <= today);
  const rotation = !!activeProgram(state).rotation;
  let workouts = 0;
  let volume = 0;
  let prs = 0;
  let run = 0;
  let best = 0;
  let gap = 0;
  for (const d of dates) {
    if (trainedOn(state, d)) {
      workouts++;
      volume += volumeOn(state, d);
      prs += dayPRs(state, d).size;
      run++;
      gap = 0;
      best = Math.max(best, run);
    } else if (d < today) {
      const scheduled = dayHasWork(state, state.week[dateFromKey(d).getDay()]);
      if (rotation ? ++gap >= 3 : scheduled) run = 0;
    }
  }
  return { workouts, volume: Math.round(volume), prs, longestStreak: best };
}

export type SessionSet = { i: number; set: SetEntry; pr: boolean };
export type DaySession = {
  title: string | null;
  exercises: { id: string; sets: SessionSet[] }[];
  prs: number;
  minutes: number | null;
  volume: number;
  finished: boolean;
  supps: boolean;
};

/** One day's session for the calendar: the workout, every exercise with its logged sets (PR sets marked). */
export function daySession(state: State, date: string): DaySession {
  const ses = state.sessions[date];
  const day = dayById(state, ses?.dayId);
  const prTop = dayPRs(state, date);
  const exercises = Object.entries(state.logs[date] ?? {})
    .filter(([id, l]) => EXERCISES[id] && doneSets(l, EXERCISES[id].kind).length > 0)
    .map(([id, l]) => {
      const kind = EXERCISES[id].kind;
      let marked = false;
      const sets = l.sets
        .map((set, i) => ({ i, set }))
        .filter(({ set }) => doneSets({ sets: [set] }, kind).length > 0)
        .map(({ i, set }) => {
          // The first set that reached the day's record gets the trophy.
          const rec = prTop.get(id);
          const pr = !marked && !!rec && (rec.kind === 'pin' ? set.load?.pin === rec.value && kgOf(set) === null : prMetric(set, kind) >= rec.value);
          if (pr) marked = true;
          return { i, set, pr };
        });
      return { id, sets };
    });
  const minutes = ses?.startedAt != null && ses.finishedAt != null ? Math.max(1, Math.round((ses.finishedAt - ses.startedAt) / 60000)) : null;
  return {
    title: day ? day.name : exercises.length ? 'Workout' : null,
    exercises,
    prs: prTop.size,
    minutes,
    volume: volumeOn(state, date),
    finished: finishedOn(state, date),
    supps: allTaken(state, date),
  };
}
