// XP, levels and ranks. Everything is derived from the log, so it can't drift.
import { EXERCISES } from './data/exercises';
import { doneSets, num, prCountsByDate, type State } from './store';

export const XP = { set: 10, pr: 50, workout: 40 } as const;

/** Total XP needed to reach a level (level 1 starts at 0). */
export const xpForLevel = (level: number) => Math.round(150 * Math.pow(Math.max(0, level - 1), 1.5));

export function levelFor(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, floor, next, into: xp - floor, span: next - floor, progress: (xp - floor) / (next - floor) };
}

export const RANKS = [
  { name: 'Rookie', from: 1 },
  { name: 'Iron', from: 3 },
  { name: 'Bronze', from: 6 },
  { name: 'Silver', from: 10 },
  { name: 'Gold', from: 15 },
  { name: 'Beast', from: 20 },
] as const;

export const rankFor = (level: number) => [...RANKS].reverse().find((r) => level >= r.from)!;

/** XP earned on one day: every finished set, every PR, and finishing the workout. */
export function xpOn(state: State, date: string, prCounts = prCountsByDate(state.logs)) {
  let sets = 0;
  for (const [id, log] of Object.entries(state.logs[date] ?? {})) {
    const kind = EXERCISES[id]?.kind;
    if (kind) sets += doneSets(log, kind).length;
  }
  const prs = prCounts[date] ?? 0;
  const finished = state.sessions[date]?.finishedAt ? 1 : 0;
  return { sets, prs, finished, total: sets * XP.set + prs * XP.pr + finished * XP.workout };
}

export function totalXp(state: State, upTo?: string) {
  const dates = new Set([...Object.keys(state.logs), ...Object.keys(state.sessions)]);
  const prCounts = prCountsByDate(state.logs);
  let xp = 0;
  for (const d of dates) if (!upTo || d <= upTo) xp += xpOn(state, d, prCounts).total;
  return xp;
}

/** Weight × reps over loaded lifts on a day. */
export function volumeOn(state: State, date: string) {
  let v = 0;
  for (const [id, log] of Object.entries(state.logs[date] ?? {})) {
    if (EXERCISES[id]?.kind !== 'weight_reps') continue;
    for (const s of doneSets(log, 'weight_reps')) v += num(s.weight)! * num(s.reps)!;
  }
  return Math.round(v);
}

/** The most recent earlier session of the same workout day, for "vs last Monday" comparisons. */
export function previousSameDay(state: State, date: string, dayId: string) {
  const prev = Object.entries(state.sessions)
    .filter(([d, s]) => d < date && s.dayId === dayId && volumeOn(state, d) > 0)
    .map(([d]) => d)
    .sort()
    .pop();
  return prev ?? null;
}

/** Percent change, rounded; null when there's nothing to compare against. */
export const pctChange = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
