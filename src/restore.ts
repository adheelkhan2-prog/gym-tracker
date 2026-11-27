// Bringing back workouts from older copies of the saved data that are still on the phone: a copy
// kept when saved data couldn't be read once (`unreadable-backup-*`), and the saves of older app
// versions (v2, v1), which are never deleted. Each copy is merged once; nothing is ever removed.
import type { DayLog, SetEntry, State } from './store';

/** A set that was ticked as logged and has any number on it (reps, seconds, a weight or a pin). */
export const isLoggedSet = (s: SetEntry) =>
  !!s.done && ((Number(s.reps) || 0) > 0 || (s.weight !== '' && Number.isFinite(Number(s.weight))) || s.load?.pin !== undefined);

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
      if (loggedIn(next[id]) > 0) continue; // today's data wins wherever it has sets
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
