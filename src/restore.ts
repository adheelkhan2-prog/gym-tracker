// Bringing back workouts from a copy of the saved data kept on the phone when it once couldn't be
// read (`unreadable-backup-*`): the app had started fresh, so those workouts were missing. Each copy
// is merged once, only where today's data has nothing for that exercise; nothing is ever removed.
import type { DayLog, SetEntry, State } from './store';

/** A number as typed ("62,5" counts as 62.5), else null. */
const parse = (v: string | undefined) => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** A set that was ticked as logged and has any number on it (reps, seconds, a weight or a pin). */
export const isLoggedSet = (s: SetEntry) => !!s.done && ((parse(s.reps) ?? 0) > 0 || parse(s.weight) !== null || s.load?.pin !== undefined);

const loggedIn = (log: { sets?: SetEntry[] } | undefined) => (log?.sets ?? []).filter(isLoggedSet).length;

/**
 * Add the copy's workouts that today's data doesn't have: an exercise on a date that has no logged
 * sets now, but has some in the copy. Returns the new logs and the dates that gained workouts.
 */
export function mergeLogs(current: State['logs'], copy: State['logs']): { logs: State['logs']; dates: string[] } {
  const logs: State['logs'] = { ...current };
  const dates: string[] = [];
  for (const [date, day] of Object.entries(copy)) {
    let gained = false;
    const next: DayLog = { ...(logs[date] ?? {}) };
    for (const [id, log] of Object.entries(day ?? {})) {
      if (!log || !Array.isArray(log.sets) || !loggedIn(log)) continue;
      // Today's data wins wherever it has anything for that exercise (even unticked typing).
      if (next[id]) continue;
      next[id] = { ...log, sets: log.sets.map((s) => ({ ...s })) };
      gained = true;
    }
    if (gained) {
      logs[date] = next;
      dates.push(date);
    }
  }
  return { logs, dates: dates.sort() };
}

/** Merge each not-yet-merged copy (already migrated to the current shape) into the state. */
export function restoreFrom(state: State, copies: { key: string; state: Pick<State, 'logs' | 'sessions'> }[]): State {
  let logs = state.logs;
  let sessions = state.sessions;
  const restored = [...(state.restored ?? [])];
  const found = new Set(state.restoreNote?.dates ?? []);
  for (const c of copies) {
    if (restored.includes(c.key)) continue;
    restored.push(c.key);
    const m = mergeLogs(logs, c.state.logs ?? {});
    logs = m.logs;
    for (const d of m.dates) {
      found.add(d);
      // Keep which workout day it was (for the plan's set count); a finished mark comes along too.
      if (!sessions[d] && c.state.sessions?.[d]) sessions = { ...sessions, [d]: c.state.sessions[d] };
    }
  }
  if (restored.length === (state.restored ?? []).length) return state;
  return { ...state, logs, sessions, restored, restoreNote: found.size ? { dates: [...found].sort() } : (state.restoreNote ?? null) };
}
