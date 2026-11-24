/**
 * Load types (kg/lb, machine pin, bodyweight, timed), the old plate/colour logs converting to kg,
 * PRs/charts/volume numbers,
 * programs + injury mode, and How to images for every exercise the app can show.
 */
import { EXERCISES } from '../data/exercises';
import { EXERCISE_3D } from '../data/exercise-3d';
import { howToImages } from '../data/how-to';
import { PROGRAMS } from '../data/programs';
import { SWAPS, swapsFor } from '../data/swaps';
import {
  LB,
  fmtKg,
  fromKg,
  loadTypeOf,
  loadTypesFor,
  round1,
  stackKg,
  toKg,
  weightFromLoad,
} from '../load';
import { DEFAULT_STATE, applyPending, exerciseHistory, kgOf, migrate, plateToKg, prCountsByDate, setKg, trainingStreak, type SetEntry, type State } from '../store';
import { loadText, visiblePlans } from '../workout';
import { volumeOn } from '../xp';

const set = (weight: string, reps: string, u: 'kg' | 'lb', load?: SetEntry['load']): SetEntry => ({ weight, reps, done: true, u, load });

describe('kg / lb', () => {
  test('conversions are exact and round-trip', () => {
    expect(LB).toBe(0.45359237);
    expect(toKg(100, 'lb')).toBeCloseTo(45.359237, 6);
    expect(fromKg(toKg(225, 'lb'), 'lb')).toBeCloseTo(225, 9);
    expect(toKg(60, 'kg')).toBe(60);
  });

  test('display follows the chosen unit; the saved set never changes', () => {
    const s = set('100', '5', 'kg');
    expect(fmtKg(kgOf(s)!, 'kg')).toBe('100 kg');
    expect(fmtKg(kgOf(s)!, 'lb')).toBe('220.5 lb');
    expect(fmtKg(kgOf(set('135', '5', 'lb'))!, 'kg')).toBe('61.2 kg');
    expect(s).toEqual(set('100', '5', 'kg'));
  });

  test('round1 shows whole numbers when close, otherwise one decimal', () => {
    expect(round1(61.99)).toBe('62');
    expect(round1(61.23)).toBe('61.2');
  });
});

describe('old barbell-plate and colour-plate sets become plain kg', () => {
  const old = (load: object, weight = '') => ({ weight, reps: '5', done: true, u: 'kg', load }) as unknown as SetEntry;

  test('the kg they saved is kept exactly, and the plates are dropped', () => {
    expect(plateToKg(old({ t: 'plates', plates: [20, 5], bar: 20 }, '70'))).toEqual({ weight: '70', reps: '5', done: true, u: 'kg' });
    expect(plateToKg(old({ t: 'colors', colors: ['red'], bar: 20 }, '70'))).toEqual({ weight: '70', reps: '5', done: true, u: 'kg' });
  });

  test('a missing total is worked out from the plates (and your old gym colours)', () => {
    expect(plateToKg(old({ t: 'plates', plates: [20, 10, 2.5], bar: 20 })).weight).toBe('85');
    expect(plateToKg(old({ t: 'colors', colors: ['red', 'blue'], bar: 20 })).weight).toBe('110');
    expect(plateToKg(old({ t: 'colors', colors: ['c1', 'c1'], bar: 15 }), { colors: [{ id: 'c1', kg: 12.5 }] }).weight).toBe('65');
  });

  test('pins and plain sets are untouched', () => {
    const pin = { ...weightFromLoad({ t: 'stack', pin: 7 }), reps: '10', done: true };
    expect(plateToKg(pin)).toBe(pin);
    expect(plateToKg(set('60', '5', 'kg'))).toEqual(set('60', '5', 'kg'));
  });

  test('on load: history, PRs and volume stay the same; plate load types and My gym are gone', () => {
    const logs = {
      '2026-11-02': { flat_bench: { sets: [old({ t: 'plates', plates: [20], bar: 20 }, '60')] } },
      '2026-11-09': { flat_bench: { sets: [old({ t: 'colors', colors: ['blue', 'green'], bar: 20 }, '80')] } },
    };
    const before = prCountsByDate(logs as State['logs']);
    const s = migrate({ ...DEFAULT_STATE, logs, loadTypes: { flat_bench: 'plates', lat_pulldown: 'stack' }, gym: { bar: 20 } }, false);
    expect(s.logs['2026-11-09'].flat_bench.sets[0]).toEqual({ weight: '80', reps: '5', done: true, u: 'kg' });
    expect(prCountsByDate(s.logs)).toEqual(before);
    expect(exerciseHistory(s.logs, 'flat_bench').map((p) => p.top)).toEqual([60, 80]);
    expect(s.loadTypes).toEqual({ lat_pulldown: 'stack' });
    expect('gym' in s).toBe(false);
  });
});

describe('machine pin', () => {
  test('pin 1 is the starting weight, each pin adds kg per plate', () => {
    expect(stackKg(1, { perPlate: 7 })).toBe(7);
    expect(stackKg(7, { perPlate: 7 })).toBe(49);
    expect(stackKg(5, { perPlate: 5, start: 10 })).toBe(30);
    expect(stackKg(7, undefined)).toBeNull();
    expect(stackKg(7, {})).toBeNull();
  });

  test('a pin logged before setup has no kg; it converts once kg per plate is set', () => {
    const s: SetEntry = { ...weightFromLoad({ t: 'stack', pin: 7 }, undefined), reps: '10', done: true };
    expect(s.weight).toBe('');
    expect(kgOf(s)).toBeNull();
    expect(setKg(s, { perPlate: 7 })).toBe(49);
    expect(loadText(s, 'kg')).toBe('Pin 7');
  });
});

describe('PRs, charts and volume use the right numbers', () => {
  const logs: State['logs'] = {
    '2026-11-02': { flat_bench: { sets: [set('60', '5', 'kg')] } },
    '2026-11-09': { flat_bench: { sets: [set('135', '5', 'lb')] } }, // 61.2 kg: a PR
    '2026-11-16': { flat_bench: { sets: [set('130', '5', 'lb')] } }, // 59 kg: not a PR
    '2026-11-17': { lat_pulldown: { sets: [{ ...weightFromLoad({ t: 'stack', pin: 7 }), reps: '10', done: true }] } },
  };

  test('PRs compare kg across units', () => {
    expect(prCountsByDate(logs)).toMatchObject({ '2026-11-02': 0, '2026-11-09': 1, '2026-11-16': 0 });
  });

  test('chart points are kg, whatever unit each set was logged in', () => {
    const h = exerciseHistory(logs, 'flat_bench');
    expect(h.map((p) => Math.round(p.top * 10) / 10)).toEqual([60, 61.2, 59]);
  });

  test('pin-only sets chart and count in volume once the machine is set up', () => {
    const machines = { lat_pulldown: { perPlate: 7 } };
    expect(exerciseHistory(logs, 'lat_pulldown', machines.lat_pulldown)[0].top).toBe(49);
    expect(volumeOn({ ...DEFAULT_STATE, logs, machines }, '2026-11-17')).toBe(490);
    expect(volumeOn({ ...DEFAULT_STATE, logs, machines: {} }, '2026-11-17')).toBe(0);
  });

  test('switching kg/lb changes no stored number, so PRs and volume stay the same', () => {
    const kg: State = { ...DEFAULT_STATE, unit: 'kg', logs };
    const lb: State = { ...kg, unit: 'lb' };
    expect(prCountsByDate(lb.logs)).toEqual(prCountsByDate(kg.logs));
    expect(volumeOn(lb, '2026-11-09')).toBe(volumeOn(kg, '2026-11-09'));
  });
});

describe('load type choices', () => {
  test('each kind of equipment offers the right load types', () => {
    expect(loadTypesFor('lat_pulldown')).toEqual(['stack', 'weight']);
    expect(loadTypesFor('flat_bench')).toEqual(['weight']);
    expect(loadTypesFor('ez_curl')).toEqual(['weight']);
    expect(loadTypesFor('lateral_raise')).toEqual(['weight']);
    expect(loadTypesFor('push_ups')).toEqual(['bodyweight']);
  });

  test("a saved load type that doesn't fit the exercise falls back to the default", () => {
    expect(loadTypeOf('lateral_raise', { lateral_raise: 'stack' })).toBe('weight');
    expect(loadTypeOf('lat_pulldown', { lat_pulldown: 'weight' })).toBe('weight');
  });
});

describe('programs and injury mode', () => {
  test('there are 7 built-in programs, every exercise in them exists', () => {
    expect(PROGRAMS).toHaveLength(7);
    for (const p of PROGRAMS) for (const d of p.days) for (const e of d.exercises) for (const o of e.options) expect(EXERCISES[o]).toBeDefined();
  });

  test('switching programs keeps every log and the streak', () => {
    const logs: State['logs'] = { '2026-11-16': { flat_bench: { sets: [set('60', '5', 'kg')] } } };
    const before: State = { ...DEFAULT_STATE, logs, programId: 'upper5', sessions: { '2026-11-16': { dayId: 'mon', finishedAt: 1 } } };
    const after = applyPending({ ...before, pending: { programId: 'ppl6', week: PROGRAMS[1].week, from: '2026-11-17' } }, '2026-11-17');
    expect(after.programId).toBe('ppl6');
    expect(after.logs).toBe(before.logs);
    expect(after.sessions).toBe(before.sessions);
    expect(trainingStreak(after, '2026-11-16')).toBe(trainingStreak(before, '2026-11-16'));
  });

  test('injury mode is gone: every exercise of every program day shows, and old saves drop the setting', () => {
    for (const p of PROGRAMS) for (const d of p.days) expect(visiblePlans(DEFAULT_STATE, d)).toHaveLength(d.exercises.length);
    const old = migrate({ ...DEFAULT_STATE, injured: true, easeInFrom: '2026-11-01', easeInDismissed: false }, false);
    expect('injured' in old || 'easeInFrom' in old || 'easeInDismissed' in old).toBe(false);
  });
});

describe('How to images', () => {
  // Every exercise the app can show: all program options plus every swap.
  const shown = new Set<string>();
  for (const p of PROGRAMS) for (const d of p.days) for (const e of d.exercises) e.options.forEach((o) => shown.add(o));
  for (const id of [...shown]) {
    swapsFor(id).forEach((s) => shown.add(s.id));
    (SWAPS[id] ?? []).forEach((s) => shown.add(s.id));
  }

  test('every exercise in the 7 programs and their swaps has start + end images', () => {
    const missing = [...shown].filter((id) => {
      const img = howToImages(id);
      return !img || img.start == null || img.end == null;
    });
    expect(missing).toEqual([]);
    expect(shown.size).toBeGreaterThan(100);
  });

  test('clay images are used wherever an approved render exists', () => {
    for (const id of Object.keys(EXERCISE_3D)) expect(howToImages(id)?.clay).toBe(true);
    expect(Object.keys(EXERCISE_3D)).toHaveLength(117);
  });
});
