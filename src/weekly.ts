// Weekly PRs and progressive overload.
//
// Weeks run Monday to Sunday. For every exercise the week's BEST set is the one with the highest
// estimated one-rep max (Epley) for loaded lifts, the most reps for bodyweight work, or the most
// seconds for timed holds. Machine-pin lifts (logged by pin) are compared by pin, then reps, and only
// with other pin sets; kg sets only with kg sets, so the two never get mixed up. Everything is
// computed from the saved logs; nothing extra is stored.

import { targetBottom, stepFor } from './sets';
import { targetTop, type PlannedExercise } from './data/program';
import { EXERCISES, type LogKind } from './data/exercises';
import { fromKg, loadTypeOf, round1, toKg, type MachineSetup, type Unit } from './load';
import { addDays, dateFromKey, doneSets, est1RM, kindOf, num, setKg, todayKey, weekKeys, type SetEntry, type State } from './store';

export type Best = {
  date: string;
  set: SetEntry;
  /** kg lifted (null for pin-only or unloaded sets). */
  kg: number | null;
  pin?: number;
  reps: number;
  /** What sets are ranked by (e1RM in kg, or pin*1000+reps, or reps/seconds). */
  score: number;
};

export type Trend = 'up' | 'down' | 'same' | 'new';

const loaded = (k: LogKind) => k === 'weight_reps' || k === 'weight_time';

/** Monday of the week containing `date`. */
export const weekStart = (date = todayKey()) => weekKeys(date)[0];

/** Pin mode: the exercise is logged by machine pin right now. */
const pinMode = (state: State, exerciseId: string) => loadTypeOf(exerciseId, state.loadTypes) === 'stack';

function scoreOf(s: SetEntry, kind: LogKind, machine: MachineSetup | undefined, pins: boolean) {
  const reps = num(s.reps) ?? 0;
  if (!loaded(kind)) return { kg: null, reps, score: reps };
  const kg = setKg(s, machine);
  const pin = s.load?.pin;
  // Pin lifts rank by pin then reps (kg per plate, if set, is shown but doesn't change the order).
  if (pins) return { kg, pin, reps, score: (pin ?? 0) * 1000 + reps };
  return { kg, reps, score: kg === null ? 0 : kind === 'weight_reps' ? est1RM(kg, reps) : kg * 1000 + reps };
}

/** Best set of an exercise across the given dates (null when it wasn't done). */
export function bestIn(state: State, exerciseId: string, dates: string[]): Best | null {
  const kind = kindOf(exerciseId);
  const machine = state.machines[exerciseId];
  const pins = loaded(kind) && pinMode(state, exerciseId);
  let best: Best | null = null;
  for (const date of dates) {
    for (const s of doneSets(state.logs[date]?.[exerciseId], kind)) {
      // Compare like with like: pin sets in pin mode, kg sets otherwise.
      if (loaded(kind) && (s.load?.pin !== undefined) !== pins) continue;
      const sc = scoreOf(s, kind, machine, pins);
      if (!best || sc.score > best.score) best = { date, set: s, ...sc };
    }
  }
  return best;
}

const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** "60 kg × 8", "Pin 7 × 12", "15 reps", "45 s". */
export function bestText(b: Best, kind: LogKind, unit: Unit) {
  if (kind === 'reps') return `${b.reps} reps`;
  if (kind === 'time') return `${b.reps} s`;
  const load = b.pin !== undefined ? `Pin ${b.pin}` : b.kg !== null ? `${round1(fromKg(b.kg, unit))} ${unit}` : '—';
  return `${load} × ${b.reps}${kind === 'weight_time' ? ' s' : ''}`;
}

export type WeekCompare = { thisWeek: Best | null; lastWeek: Best | null; trend: Trend | null; change: string };

/** This week's best set vs last week's: the trend arrow and the change ("+2.5 kg", "+1 rep"). */
export function compareWeeks(state: State, exerciseId: string, today = todayKey()): WeekCompare {
  const kind = kindOf(exerciseId);
  const monday = weekStart(today);
  const thisWeek = bestIn(state, exerciseId, weekDates(monday));
  const lastWeek = bestIn(state, exerciseId, weekDates(addDays(monday, -7)));
  if (!thisWeek) return { thisWeek, lastWeek, trend: null, change: '' };
  if (!lastWeek) return { thisWeek, lastWeek, trend: 'new', change: 'First week' };
  const unit = state.unit;
  const trend: Trend = thisWeek.score > lastWeek.score + 1e-9 ? 'up' : thisWeek.score < lastWeek.score - 1e-9 ? 'down' : 'same';
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const parts: string[] = [];
  if (loaded(kind)) {
    if (thisWeek.pin !== undefined && lastWeek.pin !== undefined) {
      if (thisWeek.pin !== lastWeek.pin) parts.push(`${sign(thisWeek.pin - lastWeek.pin)} pin`);
    } else if (thisWeek.kg !== null && lastWeek.kg !== null) {
      const d = Math.round((fromKg(thisWeek.kg, unit) - fromKg(lastWeek.kg, unit)) * 10) / 10;
      if (d !== 0) parts.push(`${sign(d)} ${unit}`);
    }
  }
  const dr = thisWeek.reps - lastWeek.reps;
  if (dr !== 0 && (parts.length === 0 || !loaded(kind))) {
    const word = kind === 'time' || kind === 'weight_time' ? 's' : Math.abs(dr) === 1 ? ' rep' : ' reps';
    parts.push(`${sign(dr)}${word}`);
  }
  return { thisWeek, lastWeek, trend, change: parts.join(', ') || 'Same as last week' };
}

/** Every exercise with a set logged this week, compared with last week (most recent first). */
export function weekBoard(state: State, today = todayKey()) {
  const dates = weekDates(weekStart(today));
  const ids = new Set<string>();
  for (const d of dates) for (const id of Object.keys(state.logs[d] ?? {})) if (EXERCISES[id]) ids.add(id);
  return [...ids]
    .map((id) => ({ exerciseId: id, ...compareWeeks(state, id, today) }))
    .filter((r) => r.thisWeek)
    .sort((a, b) => (b.thisWeek!.date > a.thisWeek!.date ? 1 : b.thisWeek!.date < a.thisWeek!.date ? -1 : a.exerciseId.localeCompare(b.exerciseId)));
}

/** All-time best score before a date. */
function bestScoreBefore(state: State, exerciseId: string, beforeDate: string) {
  const dates = Object.keys(state.logs).filter((d) => d < beforeDate);
  return bestIn(state, exerciseId, dates)?.score ?? 0;
}

export type WeeklyPR = { exerciseId: string; best: Best; previous: number };

/** PRs hit this week: exercises whose best set this week beats everything logged before this week. */
export function weeklyPRs(state: State, today = todayKey()): WeeklyPR[] {
  const monday = weekStart(today);
  const out: WeeklyPR[] = [];
  for (const r of weekBoard(state, today)) {
    const previous = bestScoreBefore(state, r.exerciseId, monday);
    if (previous > 0 && r.thisWeek!.score > previous + 1e-9) out.push({ exerciseId: r.exerciseId, best: r.thisWeek!, previous });
  }
  return out;
}

export type Stalled = { exerciseId: string; weeks: number; last: Best; suggestion: string };

/**
 * Lifts that haven't progressed for 2+ weeks: trained in at least 2 of the last 3 weeks, and no week
 * since then beat the best from before that stretch. `weeks` counts the weeks without progress.
 */
export function stalledLifts(state: State, today = todayKey(), plans: PlannedExercise[] = []): Stalled[] {
  const monday = weekStart(today);
  const ids = new Set<string>();
  for (let w = 0; w < 3; w++) for (const d of weekDates(addDays(monday, -7 * w))) for (const id of Object.keys(state.logs[d] ?? {})) if (EXERCISES[id]) ids.add(id);
  const out: Stalled[] = [];
  for (const id of ids) {
    const weeks = [0, 1, 2, 3, 4, 5, 6, 7].map((w) => bestIn(state, id, weekDates(addDays(monday, -7 * w))));
    if (weeks.slice(0, 3).filter(Boolean).length < 2) continue;
    // Count back while no week beat the best that came before it. This week only counts once you've
    // trained the lift in it (an untrained, still-running week isn't a stalled one).
    let n = 0;
    for (let w = weeks[0] ? 0 : 1; w < weeks.length; w++) {
      const wk = weeks[w];
      const before = bestScoreBefore(state, id, addDays(monday, -7 * w));
      if (before <= 0) break; // reached the first weeks of this lift: nothing to stall against
      if (wk && wk.score > before + 1e-9) break; // progressed in that week
      n++;
    }
    if (n < 2) continue;
    const last = weeks.find(Boolean)!;
    const plan = plans.find((p) => p.options.includes(id));
    out.push({ exerciseId: id, weeks: n, last, suggestion: stallTip(state, id, last, n, plan) });
  }
  return out.sort((a, b) => b.weeks - a.weeks);
}

function stallTip(state: State, id: string, last: Best, weeks: number, plan?: PlannedExercise) {
  const kind = kindOf(id);
  const top = plan ? targetTop(plan.target) : null;
  if (weeks >= 3) return 'Deload: drop about 10% for one week, then build back up. It usually breaks a plateau.';
  if (!loaded(kind)) return kind === 'time' ? 'Add 5–10 seconds to one set each session.' : 'Add one rep to one set each session.';
  if (top && last.reps >= top) return `Add the smallest step (${stepFor(state.unit)} ${state.unit}), even for one set, and rebuild the reps.`;
  return 'Keep the weight and add one rep per set before adding weight. Rest the full time between sets.';
}

export type Target = { kg: number | null; pin?: number; reps: number; text: string; lastText: string; reason: 'reps' | 'weight' | 'first' };

/**
 * This week's progressive-overload target for an exercise: from last week's best set (or the most
 * recent session), add a rep until the top of the plan's range, then add the smallest weight step
 * (2.5 kg / 5 lb, or one pin) with reps back at the bottom of the range.
 */
export function weeklyTarget(state: State, exerciseId: string, plan: PlannedExercise | undefined, today = todayKey()): Target | null {
  const kind = kindOf(exerciseId);
  const unit = state.unit;
  const monday = weekStart(today);
  const lastWeek = bestIn(state, exerciseId, weekDates(addDays(monday, -7)));
  // No set last week: fall back to the most recent earlier week that has one (not the all-time best).
  let base = lastWeek;
  const first = Object.keys(state.logs).sort()[0];
  for (let w = 2; !base && first && addDays(monday, -7 * (w - 1)) > first; w++) base = bestIn(state, exerciseId, weekDates(addDays(monday, -7 * w)));
  const top = plan ? targetTop(plan.target) : null;
  const bottom = plan ? targetBottom(plan.target) : null;
  if (!base) {
    const reps = top ?? bottom;
    const what = secsKind(kind) ? (plan && top !== bottom ? `${bottom}–${top} s` : `${reps} s`) : `${reps} reps`;
    return { kg: null, reps: reps ?? 0, text: reps ? `${what} with good form` : 'Find your working weight', lastText: '', reason: 'first' };
  }
  const lastText = `${lastWeek ? 'last week' : formatShort(base.date)} ${bestText(base, kind, unit)}`;
  const capped = top !== null && plan?.target !== 'max';
  if (!loaded(kind)) {
    const step = kind === 'time' ? 5 : 1;
    const reps = capped && base.reps >= top! ? base.reps : Math.min(capped ? top! : Infinity, base.reps + step);
    return { kg: null, reps, text: kind === 'time' ? `${reps} s` : `${reps} reps`, lastText, reason: 'reps' };
  }
  if (capped && base.reps < top!) {
    // Timed carries add 5 seconds (up to the top of the range); lifts add a rep.
    const reps = Math.min(top!, Math.max(base.reps + (secsKind(kind) ? 5 : 1), bottom ?? 0));
    return { kg: base.pin !== undefined ? null : base.kg, pin: base.pin, reps, text: textFor(base.pin !== undefined ? null : base.kg, base.pin, reps, unit, kind), lastText, reason: 'reps' };
  }
  // Top of the range reached (or no range): smallest step up, reps back to the bottom.
  const reps = bottom ?? base.reps;
  if (base.pin !== undefined) return { kg: null, pin: base.pin + 1, reps, text: textFor(null, base.pin + 1, reps, unit, kind), lastText, reason: 'weight' };
  const step = stepFor(unit);
  const inUnit = base.kg === null ? 0 : Math.round(fromKg(base.kg, unit) / step) * step + step;
  const kg = toKg(inUnit, unit);
  return { kg, reps, text: textFor(kg, undefined, reps, unit, kind), lastText, reason: 'weight' };
}

const textFor = (kg: number | null, pin: number | undefined, reps: number, unit: Unit, kind: LogKind) =>
  `${kg !== null ? `${round1(fromKg(kg, unit))} ${unit}` : pin !== undefined ? `Pin ${pin}` : '—'} × ${reps}${secsKind(kind) ? ' s' : ''}`;

/** Timed exercises log seconds in the reps field. */
export const secsKind = (kind: LogKind) => kind === 'time' || kind === 'weight_time';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatShort = (key: string) => {
  const d = dateFromKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export type WeekPoint = { week: string; best: Best | null };

/** Best set per week for the last `n` weeks (oldest first), for the weekly history chart. */
export function weeklySeries(state: State, exerciseId: string, n = 12, today = todayKey()): WeekPoint[] {
  const monday = weekStart(today);
  return Array.from({ length: n }, (_, i) => {
    const week = addDays(monday, -7 * (n - 1 - i));
    return { week, best: bestIn(state, exerciseId, weekDates(week)) };
  });
}

/** The number a weekly chart plots for a best set, in the user's unit: e1RM / kg, pin, reps or seconds. */
export function chartValue(b: Best, kind: LogKind, unit: Unit) {
  if (!loaded(kind)) return b.reps;
  if (b.pin !== undefined || b.kg === null) return b.pin ?? 0;
  return Math.round(fromKg(kind === 'weight_reps' ? est1RM(b.kg, b.reps) : b.kg, unit) * 10) / 10;
}

/**
 * A weight that's far above what you usually lift on this exercise: more than 1.5× (and 20 kg over)
 * your heaviest logged set, or, the first time, more than any sane amount for the equipment. Used to
 * ask "is that right?" before logging (a slipped digit turned 22 kg into 222 kg).
 */
export function bigJump(state: State, exerciseId: string, kg: number): boolean {
  if (!(kg > 0)) return false;
  const kind = kindOf(exerciseId);
  const machine = state.machines[exerciseId];
  let heaviest = 0;
  for (const day of Object.values(state.logs)) for (const s of doneSets(day[exerciseId], kind)) heaviest = Math.max(heaviest, setKg(s, machine) ?? 0);
  if (heaviest > 0) return kg > Math.max(heaviest * 1.5, heaviest + 20);
  const eq = EXERCISES[exerciseId]?.equipment;
  return kg > (eq === 'dumbbell' ? 80 : 250);
}
