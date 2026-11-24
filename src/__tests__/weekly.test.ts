/** Weekly PRs, stalled lifts, progressive-overload targets and the weekly chart series. */
import { DEFAULT_STATE, type SetEntry, type State } from '../store';
import { compareWeeks, stalledLifts, weekBoard, weekStart, weeklyPRs, weeklySeries, weeklyTarget } from '../weekly';

const TODAY = '2026-11-25'; // a Wednesday; this week starts Monday 23 Nov
const kg = (w: number, r: number): SetEntry => ({ weight: String(w), reps: String(r), done: true, u: 'kg' });
const plan = { slot: 'mon-1', options: ['flat_bench'], sets: 3, target: '6-8' };
const st = (logs: State['logs'], extra: Partial<State> = {}): State => ({ ...DEFAULT_STATE, unit: 'kg', logs, ...extra });

describe('weeks', () => {
  test('a week runs Monday to Sunday', () => {
    expect(weekStart('2026-11-25')).toBe('2026-11-23');
    expect(weekStart('2026-11-29')).toBe('2026-11-23'); // Sunday
    expect(weekStart('2026-11-30')).toBe('2026-11-30'); // next Monday
  });
});

describe('this week vs last week', () => {
  test('heavier this week: up, with the weight change', () => {
    const s = st({ '2026-11-17': { flat_bench: { sets: [kg(60, 8), kg(60, 7)] } }, '2026-11-24': { flat_bench: { sets: [kg(62.5, 8)] } } });
    expect(compareWeeks(s, 'flat_bench', TODAY)).toMatchObject({ trend: 'up', change: '+2.5 kg' });
  });
  test('same weight, one more rep: up, "+1 rep"', () => {
    const s = st({ '2026-11-17': { flat_bench: { sets: [kg(60, 7)] } }, '2026-11-24': { flat_bench: { sets: [kg(60, 8)] } } });
    expect(compareWeeks(s, 'flat_bench', TODAY)).toMatchObject({ trend: 'up', change: '+1 rep' });
  });
  test('fewer reps at the same weight: down; identical: same', () => {
    const down = st({ '2026-11-17': { flat_bench: { sets: [kg(60, 8)] } }, '2026-11-24': { flat_bench: { sets: [kg(60, 6)] } } });
    expect(compareWeeks(down, 'flat_bench', TODAY)).toMatchObject({ trend: 'down', change: '-2 reps' });
    const same = st({ '2026-11-17': { flat_bench: { sets: [kg(60, 8)] } }, '2026-11-24': { flat_bench: { sets: [kg(60, 8)] } } });
    expect(compareWeeks(same, 'flat_bench', TODAY)).toMatchObject({ trend: 'same', change: 'Same as last week' });
  });
  test('a heavier set with fewer reps can still be the better week (estimated 1RM)', () => {
    const s = st({ '2026-11-17': { flat_bench: { sets: [kg(60, 8)] } }, '2026-11-24': { flat_bench: { sets: [kg(70, 5)] } } });
    expect(compareWeeks(s, 'flat_bench', TODAY)).toMatchObject({ trend: 'up', change: '+10 kg' });
  });
  test('kg/lb: the change is shown in your unit', () => {
    const s = st({ '2026-11-17': { flat_bench: { sets: [kg(60, 8)] } }, '2026-11-24': { flat_bench: { sets: [kg(62.5, 8)] } } }, { unit: 'lb' });
    expect(compareWeeks(s, 'flat_bench', TODAY).change).toBe('+5.5 lb');
  });
  test('first time: "new"; nothing this week: no trend', () => {
    expect(compareWeeks(st({ '2026-11-24': { flat_bench: { sets: [kg(60, 8)] } } }), 'flat_bench', TODAY).trend).toBe('new');
    expect(compareWeeks(st({ '2026-11-17': { flat_bench: { sets: [kg(60, 8)] } } }), 'flat_bench', TODAY).trend).toBeNull();
  });
  test('the board lists every exercise done this week', () => {
    const s = st({ '2026-11-24': { flat_bench: { sets: [kg(60, 8)] }, lat_pulldown: { sets: [kg(50, 10)] } }, '2026-11-10': { cable_fly: { sets: [kg(10, 12)] } } });
    expect(weekBoard(s, TODAY).map((r) => r.exerciseId).sort()).toEqual(['flat_bench', 'lat_pulldown']);
  });
});

describe('weekly PR board', () => {
  test('a best set this week that beats everything before the week is a PR; first-ever weeks are not', () => {
    const s = st({
      '2026-11-03': { flat_bench: { sets: [kg(60, 8)] } },
      '2026-11-24': { flat_bench: { sets: [kg(62.5, 8)] }, lat_pulldown: { sets: [kg(50, 10)] } },
    });
    expect(weeklyPRs(s, TODAY).map((p) => p.exerciseId)).toEqual(['flat_bench']);
  });
});

describe('stalled lifts', () => {
  test('no progress for 2+ weeks while training it: stalled, with a suggestion', () => {
    const s = st({
      '2026-11-03': { flat_bench: { sets: [kg(60, 8)] } }, // best
      '2026-11-10': { flat_bench: { sets: [kg(60, 7)] } },
      '2026-11-17': { flat_bench: { sets: [kg(60, 8)] } },
      '2026-11-24': { flat_bench: { sets: [kg(60, 8)] } },
    });
    const [x] = stalledLifts(s, TODAY, [plan]);
    expect(x.exerciseId).toBe('flat_bench');
    expect(x.weeks).toBeGreaterThanOrEqual(2);
    expect(x.suggestion).toMatch(/Deload|smallest step/);
  });
  test('progressing lifts are never stalled', () => {
    const s = st({
      '2026-11-03': { flat_bench: { sets: [kg(60, 6)] } },
      '2026-11-10': { flat_bench: { sets: [kg(60, 7)] } },
      '2026-11-17': { flat_bench: { sets: [kg(60, 8)] } },
      '2026-11-24': { flat_bench: { sets: [kg(62.5, 6)] } },
    });
    expect(stalledLifts(s, TODAY, [plan])).toEqual([]);
  });
});

describe('target this week (progressive overload)', () => {
  test('below the top of the range: same weight, one more rep', () => {
    const s = st({ '2026-11-17': { flat_bench: { sets: [kg(60, 7)] } } });
    expect(weeklyTarget(s, 'flat_bench', plan, TODAY)).toMatchObject({ kg: 60, reps: 8, text: '60 kg × 8', lastText: 'last week 60 kg × 7', reason: 'reps' });
  });
  test('top of the range: the smallest weight step, reps back to the bottom', () => {
    const s = st({ '2026-11-17': { flat_bench: { sets: [kg(60, 8)] } } });
    expect(weeklyTarget(s, 'flat_bench', plan, TODAY)).toMatchObject({ kg: 62.5, reps: 6, text: '62.5 kg × 6', reason: 'weight' });
  });
  test('in lb the step is 5 lb', () => {
    const s = st({ '2026-11-17': { flat_bench: { sets: [{ weight: '135', reps: '8', done: true, u: 'lb' }] } } }, { unit: 'lb' });
    expect(weeklyTarget(s, 'flat_bench', plan, TODAY)!.text).toBe('140 lb × 6');
  });
  test('machine pin: one pin up at the top of the range', () => {
    const p = { slot: 'tue-1', options: ['lat_pulldown'], sets: 3, target: '10-12' };
    const s = st({ '2026-11-17': { lat_pulldown: { sets: [{ weight: '', reps: '12', done: true, load: { t: 'stack', pin: 6 } }] } } });
    expect(weeklyTarget(s, 'lat_pulldown', p, TODAY)).toMatchObject({ pin: 7, reps: 10, text: 'Pin 7 × 10' });
  });
  test('no set last week: uses the most recent week; never done: a first-time hint', () => {
    const s = st({ '2026-11-03': { flat_bench: { sets: [kg(60, 6)] } } });
    expect(weeklyTarget(s, 'flat_bench', plan, TODAY)!.lastText).toBe('3 Nov 60 kg × 6');
    expect(weeklyTarget(st({}), 'flat_bench', plan, TODAY)).toMatchObject({ reason: 'first', text: '8 reps with good form' });
  });
  test('bodyweight: one more rep', () => {
    const p = { slot: 'x', options: ['push_ups'], sets: 3, target: 'max' };
    const s = st({ '2026-11-17': { push_ups: { sets: [{ weight: '', reps: '20', done: true }] } } });
    expect(weeklyTarget(s, 'push_ups', p, TODAY)).toMatchObject({ reps: 21, text: '21 reps' });
  });
});

test('weekly series: one point per week, oldest first, empty weeks kept', () => {
  const s = st({ '2026-11-10': { flat_bench: { sets: [kg(60, 8)] } }, '2026-11-24': { flat_bench: { sets: [kg(62.5, 8)] } } });
  const pts = weeklySeries(s, 'flat_bench', 3, TODAY);
  expect(pts.map((p) => p.week)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
  expect(pts.map((p) => p.best?.kg ?? null)).toEqual([60, null, 62.5]);
});
