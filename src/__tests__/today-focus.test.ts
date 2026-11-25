/**
 * Today screen day choice (the "Monday shows Wednesday" bug), the ease-in card rule, and focus
 * mode's one-tap prefill / progression suggestions.
 */
import { missingFor, suggestSet, targetBottom, weightIn } from '../sets';
import { restBody } from '../restNotify';
import { DEFAULT_STATE, type State } from '../store';
import { todayDayId } from '../workout';

const MON = 1;
const D = '2026-11-23'; // a Monday
const base: State = { ...DEFAULT_STATE, programId: 'upper5', week: [null, 'mon', 'tue', 'wed', 'thu', 'fri', null], logs: {}, sessions: {} };

describe('which day Today shows', () => {
  test("today's scheduled day by default", () => {
    expect(todayDayId(base, D, MON)).toMatchObject({ id: 'mon', preview: false });
  });

  test('a session started on another day but never logged no longer pins today to it', () => {
    const s = { ...base, sessions: { [D]: { dayId: 'wed', startedAt: 1 } } };
    expect(todayDayId(s, D, MON).id).toBe('mon');
  });

  test("once sets are logged under another day, that's today's workout (and it says so)", () => {
    const s: State = {
      ...base,
      sessions: { [D]: { dayId: 'wed', startedAt: 1 } },
      logs: { [D]: { incline_bb_press: { sets: [{ weight: '60', reps: '8', done: true, u: 'kg' }] } } },
    };
    expect(todayDayId(s, D, MON)).toMatchObject({ id: 'wed', swappedDay: true, preview: false });
  });

  test('a day tapped in the week strip is a preview, not a change of today', () => {
    expect(todayDayId(base, D, MON, 'wed')).toMatchObject({ id: 'wed', preview: true, scheduled: 'mon' });
    expect(todayDayId(base, D, MON, 'mon')).toMatchObject({ id: 'mon', preview: false });
  });
});

describe('focus mode: one-tap prefill', () => {
  const plan = { slot: 'mon-1', options: ['flat_bench'], sets: 3, target: '8-10' };
  const last = (reps: string[], w = '60', u: 'kg' | 'lb' = 'kg') => ({
    '2026-11-16': { flat_bench: { sets: reps.map((r) => ({ weight: w, reps: r, done: true, u })) } },
  });

  test('first time: the plan target, no weight yet', () => {
    const r = suggestSet({ ...base, unit: 'kg' }, 'flat_bench', plan, D, 0);
    expect(r).toMatchObject({ reason: 'target', set: { weight: '', reps: '10' } });
  });

  test('last session repeated when it did not hit the top of the range', () => {
    const r = suggestSet({ ...base, unit: 'kg', logs: last(['10', '9', '8']) }, 'flat_bench', plan, D, 1);
    expect(r).toMatchObject({ reason: 'last', set: { weight: '60', reps: '9', u: 'kg' } });
  });

  test('a step up (2.5 kg) with reps back at the bottom when every set hit the top', () => {
    const r = suggestSet({ ...base, unit: 'kg', logs: last(['10', '10', '10']) }, 'flat_bench', plan, D, 0);
    expect(r).toMatchObject({ reason: 'up', set: { weight: '62.5', reps: '8' } });
  });

  test('in lb the step is 5 lb, and old kg sets convert to your unit', () => {
    const r = suggestSet({ ...base, unit: 'lb', logs: last(['10', '10', '10'], '60', 'kg') }, 'flat_bench', plan, D, 0);
    expect(r.set).toMatchObject({ weight: '135', u: 'lb' }); // 60 kg ≈ 132.3 lb -> 130 (5 lb steps) + 5
  });

  test('the next set today repeats the set just done', () => {
    const logs = { ...last(['10', '9', '8']), [D]: { flat_bench: { sets: [{ weight: '65', reps: '9', done: true, u: 'kg' as const }] } } };
    const r = suggestSet({ ...base, unit: 'kg', logs }, 'flat_bench', plan, D, 1);
    expect(r).toMatchObject({ reason: 'today', set: { weight: '65', reps: '9' } });
  });

  test('machine pins are gone: after old pin-only sets the weight starts empty (kg only), reps carry over', () => {
    const p = { slot: 'tue-1', options: ['lat_pulldown'], sets: 3, target: '10-12' };
    const pinLog = { '2026-11-17': { lat_pulldown: { sets: ['12', '11', '10'].map((r) => ({ weight: '', reps: r, done: true, u: 'kg' as const, load: { t: 'stack' as const, pin: 6 } })) } } };
    const r = suggestSet({ ...base, loadTypes: { lat_pulldown: 'stack' as const }, logs: pinLog }, 'lat_pulldown', p, D, 0).set;
    expect(r.load).toBeUndefined();
    expect(r.weight).toBe('');
    expect(r.reps).toBe('12');
  });

  test('helpers', () => {
    expect(targetBottom('8-12')).toBe(8);
    expect(targetBottom('max')).toBeNull();
    expect(weightIn({ weight: '100', reps: '5', done: true, u: 'kg' }, 'lb')).toBe(220);
  });
});

describe('rest notification text', () => {
  test('counts down with the next set', () => {
    expect(restBody(1_000_000 + 90_000, 'Set 2 · 60 kg × 10', 1_000_000)).toBe('1:30 left · Next: Set 2 · 60 kg × 10');
    expect(restBody(1_000_000, 'x', 1_000_500)).toBe('0:00 left · Next: x');
  });
});

describe('Log set validation message', () => {

  test('only one missing', () => {
    expect(missingFor({ weight: '', reps: '10', done: false }, 'flat_bench', 'weight').message).toBe('Add your weight first');
    expect(missingFor({ weight: '60', reps: '', done: false, u: 'kg' }, 'flat_bench', 'weight').message).toBe('Add your reps first');
    expect(missingFor({ weight: '60', reps: '0', done: false, u: 'kg' }, 'flat_bench', 'weight').message).toBe('Add your reps first');
    expect(missingFor({ weight: '', reps: '', done: false }, 'plank', 'timed').message).toBe('Add your seconds first');
  });
  test('weight and reps both missing; timed sets ask for seconds', () => {
    expect(missingFor({ weight: '', reps: '', done: false }, 'lat_pulldown', 'weight')).toEqual({ load: true, reps: true, message: 'Add your weight and reps first' });
    expect(missingFor({ weight: '', reps: '', done: false }, 'farmers_walk', 'weight').message).toBe('Add your weight and seconds first');
  });
});
