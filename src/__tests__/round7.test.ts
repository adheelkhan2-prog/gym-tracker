/** Round 7: Done only with sets, per-supplement streaks / rename / delete, editing and deleting logged sets. */
import { missingFor, suggestSet } from '../sets';
import {
  DEFAULT_STATE,
  keepKgLifts,
  migrate,
  addSupplement,
  editSet,
  exerciseHistory,
  finishedOn,
  removeSupplement,
  renameSupplement,
  supplementStreakFor,
  trainedOn,
  type State,
} from '../store';

const base = (extra: Partial<State> = {}): State => ({ ...DEFAULT_STATE, unit: 'kg', ...extra });

describe('a day is Done only when finished with sets logged', () => {
  test('finished with no sets: not Done, not trained', () => {
    const s = base({ sessions: { '2026-11-25': { dayId: 'wed', finishedAt: 1 } }, logs: { '2026-11-25': { flat_bench: { sets: [{ weight: '', reps: '', done: false }] } } } });
    expect(finishedOn(s, '2026-11-25')).toBe(false);
    expect(trainedOn(s, '2026-11-25')).toBe(false);
  });
  test('finished with a set: Done', () => {
    const s = base({ sessions: { '2026-11-25': { dayId: 'wed', finishedAt: 1 } }, logs: { '2026-11-25': { flat_bench: { sets: [{ weight: '60', reps: '8', done: true, u: 'kg' }] } } } });
    expect(finishedOn(s, '2026-11-25')).toBe(true);
  });
});

describe('supplements: each its own streak, rename and delete', () => {
  const taken = {
    '2026-11-23': { Creatine: true, Protein: true },
    '2026-11-24': { Creatine: true },
    '2026-11-25': { Creatine: true, Protein: true },
  };
  test('streaks are per supplement', () => {
    const s = base({ taken });
    expect(supplementStreakFor(s, 'Creatine', '2026-11-25')).toBe(3);
    expect(supplementStreakFor(s, 'Protein', '2026-11-25')).toBe(1);
  });
  test('rename keeps the streak and the reminders', () => {
    const r = { on: true, morning: '07:00', followUps: [], lastCall: null };
    const s = renameSupplement(base({ taken, suppReminders: { Creatine: r } }), 'Creatine', 'Creatine HCl');
    expect(s.supplements).toEqual(['Creatine HCl', 'Protein']);
    expect(supplementStreakFor(s, 'Creatine HCl', '2026-11-25')).toBe(3);
    expect(s.suppReminders['Creatine HCl']).toEqual(r);
    expect(s.suppReminders.Creatine).toBeUndefined();
    // A name already in the stack, or blank, changes nothing.
    const s0 = base({ taken });
    expect(renameSupplement(s0, 'Creatine', 'Protein')).toBe(s0);
    expect(renameSupplement(s0, 'Creatine', '  ')).toBe(s0);
  });
  test('add gets the default reminders; delete keeps the days it was taken', () => {
    const added = addSupplement(base({ taken }), ' Fish oil ');
    expect(added.supplements).toEqual(['Creatine', 'Protein', 'Fish oil']);
    expect(added.suppReminders['Fish oil']).toMatchObject({ on: true, morning: '08:00' });
    const gone = removeSupplement(added, 'Creatine');
    expect(gone.supplements).toEqual(['Protein', 'Fish oil']);
    expect(gone.taken).toEqual(taken);
  });
});

describe('editing and deleting a logged set', () => {
  const logs: State['logs'] = {
    '2026-11-20': { db_shoulder_press: { sets: [{ weight: '22', reps: '12', done: true, u: 'kg' }, { weight: '222', reps: '12', done: true, u: 'kg' }] } },
  };
  test('fixing a typo changes the history and the chart', () => {
    const s = editSet(base({ logs }), 'db_shoulder_press', { date: '2026-11-20', i: 1 }, { weight: '22', reps: '12', done: true, u: 'kg' });
    expect(exerciseHistory(s.logs, 'db_shoulder_press')[0].top).toBe(22);
  });
  test('deleting a set; deleting the last one removes the exercise (and the empty day)', () => {
    const one = editSet(base({ logs }), 'db_shoulder_press', { date: '2026-11-20', i: 1 }, null);
    expect(one.logs['2026-11-20'].db_shoulder_press.sets).toHaveLength(1);
    const none = editSet(one, 'db_shoulder_press', { date: '2026-11-20', i: 0 }, null);
    expect(none.logs['2026-11-20']).toBeUndefined();
  });
  test('deleting the only logged set after a mid-workout swap keeps the sets carried over', () => {
    const s = base({ logs: { '2026-11-20': { pec_deck: { sets: [{ weight: '40', reps: '12', done: true, u: 'kg' }], carried: 2 } } } });
    const after = editSet(s, 'pec_deck', { date: '2026-11-20', i: 0 }, null);
    expect(after.logs['2026-11-20'].pec_deck).toEqual({ sets: [], carried: 2 });
  });
  test('a set that no longer exists changes nothing', () => {
    const s = base({ logs });
    expect(editSet(s, 'db_shoulder_press', { date: '2026-11-21', i: 0 }, null)).toBe(s);
  });
});

describe('tap-only − / + steps', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { stepOf } = require('../sets') as typeof import('../sets');
  test('pin 1, reps 1, seconds 5', () => {
    expect(stepOf('pin', 'kg', false, 7, 1)).toBe(1);
    expect(stepOf('reps', 'kg', false, 10, -1)).toBe(1);
    expect(stepOf('secs', 'kg', false, 30, 1)).toBe(5);
  });
  test('kg 2.5, but 1 for dumbbells under 10 kg; lb 5 / 2', () => {
    expect(stepOf('weight', 'kg', false, 60, 1)).toBe(2.5);
    expect(stepOf('weight', 'kg', true, 8, 1)).toBe(1);
    expect(stepOf('weight', 'kg', true, 10, -1)).toBe(1);
    expect(stepOf('weight', 'kg', true, 10, 1)).toBe(2.5);
    expect(stepOf('weight', 'lb', false, 135, 1)).toBe(5);
    expect(stepOf('weight', 'lb', true, 15, 1)).toBe(2);
  });
});

describe('machine pins are kept', () => {
  test('after an update, a cable or machine lift you logged in kg stays in kg', () => {
    const logs: State['logs'] = { '2026-11-17': { seated_cable_row: { sets: [{ weight: '50', reps: '10', done: true, u: 'kg' }] } } };
    expect(keepKgLifts({}, logs)).toEqual({ seated_cable_row: 'weight' });
    expect(keepKgLifts({ seated_cable_row: 'stack' }, logs)).toEqual({ seated_cable_row: 'stack' });
    expect(migrate({ ...DEFAULT_STATE, logs }, false).loadTypes.seated_cable_row).toBe('weight');
  });
  test('pin mode needs a pin and never pre-fills a hidden kg weight', () => {
    expect(missingFor({ weight: '60', reps: '10', done: false, u: 'kg' }, 'lat_pulldown', 'stack').message).toBe('Add your pin first');
    const s = base({ loadTypes: { lat_pulldown: 'stack' }, logs: { '2026-11-17': { lat_pulldown: { sets: [{ weight: '60', reps: '10', done: true, u: 'kg' }] } } } });
    const p = { slot: 'tue-1', options: ['lat_pulldown'], sets: 3, target: '8-12' };
    expect(suggestSet(s, 'lat_pulldown', p, '2026-11-24', 0).set.weight).toBe('');
  });
});
