/**
 * The one-pass history indexes (PRs per day, lift histories, running bests) must give exactly the
 * same answers as the old full scans, on a varied random history: kg and lb, machine pins (with and
 * without kg per plate), bodyweight reps, timed holds, unfinished sets and an exercise this version
 * doesn't know.
 */
import { DEFAULT_STATE, allHistories, doneSets, exerciseHistory, kgOf, kindOf, prMetric, prSetsOn, type SetEntry, type State } from '../store';
import { dayPRs } from '../calendar';
import { bestIn, bestScoreBefore, stalledLifts, weeklyPRs } from '../weekly';

// Small deterministic random numbers.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const IDS = ['flat_bench', 'lat_pulldown', 'push_ups', 'farmers_walk', 'seated_cable_row', 'old_removed'];
function randomState(): State {
  const logs: State['logs'] = {};
  for (let i = 0; i < 400; i++) {
    if (rnd() < 0.4) continue;
    const d = new Date(2025, 0, 1 + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    logs[k] = {};
    for (const id of IDS) {
      if (rnd() < 0.5) continue;
      const sets: SetEntry[] = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => {
        const r = rnd();
        const reps = String(1 + Math.floor(rnd() * 15));
        const done = rnd() < 0.9;
        if (r < 0.2) return { weight: '', u: 'kg', reps, done, load: { t: 'stack', pin: 1 + Math.floor(rnd() * 15) } };
        if (r < 0.3) return { weight: String(20 + Math.floor(rnd() * 100)), u: 'lb', reps, done };
        if (r < 0.35) return { weight: '', reps, done };
        return { weight: String(10 + Math.floor(rnd() * 40) * 2.5), u: 'kg', reps, done };
      });
      logs[k][id] = { sets };
    }
  }
  return { ...DEFAULT_STATE, unit: 'kg', logs, machines: { seated_cable_row: { perPlate: 5 } }, loadTypes: { lat_pulldown: 'stack' } };
}

// The old implementations, scanning everything every time.
function oldBestBefore(logs: State['logs'], id: string, before: string) {
  const kind = kindOf(id);
  let best = 0;
  for (const [date, day] of Object.entries(logs)) if (date < before) for (const s of doneSets(day[id], kind)) best = Math.max(best, prMetric(s, kind));
  return best;
}
function oldPrSetsOn(logs: State['logs'], date: string) {
  const out: { exerciseId: string; value: number }[] = [];
  for (const [id, log] of Object.entries(logs[date] ?? {})) {
    const kind = kindOf(id);
    const best = oldBestBefore(logs, id, date);
    if (best <= 0) continue;
    const top = Math.max(0, ...doneSets(log, kind).map((s) => prMetric(s, kind)));
    if (top > best) out.push({ exerciseId: id, value: top });
  }
  return out;
}
const topPin = (sets: SetEntry[]) => Math.max(0, ...sets.filter((x) => x.done && x.load?.pin !== undefined && kgOf(x) === null).map((x) => x.load!.pin!));
function oldDayPRs(state: State, date: string) {
  const out = new Map<string, { kind: 'metric' | 'pin'; value: number }>();
  for (const p of oldPrSetsOn(state.logs, date)) out.set(p.exerciseId, { kind: 'metric', value: p.value });
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

describe('one-pass history indexes match the old full scans', () => {
  for (let run = 0; run < 3; run++) {
    const state = randomState();
    const dates = Object.keys(state.logs).sort();
    test(`PRs on every day (history ${run + 1})`, () => {
      let n = 0;
      for (const d of [...dates, '2024-12-31', '2026-06-01']) {
        expect(prSetsOn(state.logs, d)).toEqual(oldPrSetsOn(state.logs, d));
        // Same records (the order isn't used anywhere: callers look records up by exercise).
        expect(new Map(dayPRs(state, d))).toEqual(oldDayPRs(state, d));
        n += oldDayPRs(state, d).size;
      }
      expect(n).toBeGreaterThan(5); // the history really has records of both kinds in it
    });
    test(`lift histories (history ${run + 1})`, () => {
      const all = allHistories(state.logs, IDS, state.machines);
      for (const id of IDS) expect(all[id]).toEqual(exerciseHistory(state.logs, id, state.machines[id]));
    });
    test(`best before a date and the weekly views (history ${run + 1})`, () => {
      for (const id of IDS)
        for (const d of dates.filter((_, i) => i % 7 === 0)) {
          const old = bestIn(state, id, dates.filter((x) => x < d))?.score ?? 0;
          expect(bestScoreBefore(state, id, d)).toBe(old);
        }
      expect(() => weeklyPRs(state, dates[dates.length - 1])).not.toThrow();
      expect(() => stalledLifts(state, dates[dates.length - 1])).not.toThrow();
    });
  }
  test('a changed history is never answered from the old cache', () => {
    const state = randomState();
    const d = Object.keys(state.logs).sort().pop()!;
    const before = prSetsOn(state.logs, d);
    const logs = { ...state.logs, [d]: { ...state.logs[d], flat_bench: { sets: [{ weight: '500', reps: '1', done: true, u: 'kg' as const }] } } };
    expect(prSetsOn(logs, d).find((p) => p.exerciseId === 'flat_bench')?.value).toBe(500);
    expect(prSetsOn(state.logs, d)).toEqual(before);
  });
});
