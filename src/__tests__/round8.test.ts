/** Round 8: day status from logged sets, restoring workouts from older copies, set pre-fill. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayMark as calendarMarkFor } from '../calendar';
import { PROGRAMS } from '../data/programs';
import { mergeLogs } from '../restore';
import { prefillReps } from '../sets';
import { BACKUP_PREFIX, DEFAULT_STATE, STORAGE_KEY, dayStatus, loadState, trainedOn, trainingStreak, weekSummary, type State } from '../store';

const kg = (w: number, r: number, done = true) => ({ weight: String(w), reps: String(r), done, u: 'kg' as const });
const st = (extra: Partial<State> = {}): State => ({ ...DEFAULT_STATE, unit: 'kg', ...extra });
const mon = PROGRAMS[0].days.find((d) => d.id === 'mon')!;
const planned = mon.exercises.reduce((n, e) => n + e.sets, 0);

beforeEach(() => AsyncStorage.clear());

describe('a day counts from the sets actually logged', () => {
  test('logged sets without Finish: trained; most of the plan = finished, some = partial', () => {
    const many = Array.from({ length: Math.ceil(planned * 0.75) }, () => kg(60, 8));
    const s = st({
      logs: { '2026-11-23': { flat_bench: { sets: many } }, '2026-11-24': { flat_bench: { sets: [kg(60, 8)] } } },
      sessions: { '2026-11-23': { dayId: 'mon', startedAt: 1 }, '2026-11-24': { dayId: 'mon', startedAt: 1 } },
    });
    expect(trainedOn(s, '2026-11-23')).toBe(true);
    expect(dayStatus(s, '2026-11-23', '2026-11-27')).toBe('finished');
    expect(dayStatus(s, '2026-11-24', '2026-11-27')).toBe('partial');
    expect(calendarMarkFor(s, '2026-11-23')).toBe('done');
    expect(calendarMarkFor(s, '2026-11-24')).toBe('partial');
  });

  test('today is finished only by Finish, however many sets are logged', () => {
    const s = st({ logs: { '2026-11-27': { flat_bench: { sets: Array.from({ length: planned }, () => kg(60, 8)) } } }, sessions: { '2026-11-27': { dayId: 'mon' } } });
    expect(dayStatus(s, '2026-11-27', '2026-11-27')).toBe('partial');
  });

  test('a ticked set with any number counts (e.g. an old set saved without a weight)', () => {
    const s = st({ logs: { '2026-11-24': { db_shrug: { sets: [{ weight: '', reps: '12', done: true }] } } } });
    expect(trainedOn(s, '2026-11-24')).toBe(true);
    // Unticked typing or an empty ticked set never counts.
    const t = st({ logs: { '2026-11-24': { db_shrug: { sets: [kg(20, 12, false), { weight: '', reps: '', done: true }] } } } });
    expect(trainedOn(t, '2026-11-24')).toBe(false);
  });

  test('the week count and streak include Tuesday and Wednesday trained without Finish', () => {
    const s = st({
      week: [null, 'mon', 'tue', 'wed', 'thu', 'fri', null],
      logs: { '2026-11-24': { db_row: { sets: [kg(30, 10)] } }, '2026-11-25': { pec_deck: { sets: [{ weight: '', reps: '12', done: true, load: { t: 'stack', pin: 7 } }] } } },
    });
    expect(weekSummary(s, '2026-11-26').trained).toBe(2);
    expect(trainingStreak(s, '2026-11-26')).toBe(2);
  });
});

describe('workouts come back from older copies on the phone, never deleting anything', () => {
  test('merge adds only what is missing; today wins where both have sets', () => {
    const now = { '2026-11-26': { flat_bench: { sets: [kg(70, 8)] } }, '2026-11-24': { db_row: { sets: [kg(32, 10)] } } };
    const old = { '2026-11-24': { db_row: { sets: [kg(30, 10)] }, db_shrug: { sets: [kg(20, 12)] } }, '2026-11-25': { pec_deck: { sets: [kg(40, 12)] } } };
    const m = mergeLogs(now, old);
    expect(m.logs['2026-11-24'].db_row.sets[0].weight).toBe('32');
    expect(m.logs['2026-11-24'].db_shrug.sets).toHaveLength(1);
    expect(m.logs['2026-11-25'].pec_deck.sets).toHaveLength(1);
    expect(m.logs['2026-11-26']).toEqual(now['2026-11-26']);
    expect(m.dates).toEqual(['2026-11-24', '2026-11-25']);
  });

  test('a backup of unreadable data is merged into the current save once, with a note', async () => {
    const current = st({ logs: { '2026-11-26': { flat_bench: { sets: [kg(70, 8)] } } } });
    const backup = st({ logs: { '2026-11-24': { db_row: { sets: [kg(30, 10)] } }, '2026-11-25': { pec_deck: { sets: [kg(40, 12)] } } } });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    await AsyncStorage.setItem(`${BACKUP_PREFIX}123`, JSON.stringify(backup));
    const a = (await loadState())!;
    expect(Object.keys(a.logs).sort()).toEqual(['2026-11-24', '2026-11-25', '2026-11-26']);
    expect(a.restoreNote?.dates).toEqual(['2026-11-24', '2026-11-25']);
    // The copy is never deleted, and merging it again changes nothing.
    expect(await AsyncStorage.getItem(`${BACKUP_PREFIX}123`)).not.toBeNull();
    // (Here the restored Wednesday is deleted afterwards on purpose: it must stay deleted.)
    const { '2026-11-25': _gone, ...kept } = a.logs;
    void _gone;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...a, restoreNote: null, logs: kept }));
    const b = (await loadState())!;
    expect(b.restoreNote).toBeNull();
    expect(b.logs['2026-11-25']).toBeUndefined();
  });

  test('unreadable saved data with no copy elsewhere starts fresh but keeps the raw text', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{not json');
    expect(await loadState()).toBeNull();
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some((k) => k.startsWith(BACKUP_PREFIX))).toBe(true);
  });
});

describe('set pre-fill', () => {
  const plan = mon.exercises[0]; // flat bench, 8-10
  test('reps: last session’s same set, else the plan’s target', () => {
    const s = st({ logs: { '2026-11-16': { flat_bench: { sets: [kg(60, 9), kg(60, 8)] } } } });
    expect(prefillReps(s, 'flat_bench', plan, '2026-11-23', 0)).toBe('9');
    expect(prefillReps(s, 'flat_bench', plan, '2026-11-23', 1)).toBe('8');
    expect(prefillReps(s, 'flat_bench', plan, '2026-11-23', 2)).toBe('10');
    expect(prefillReps(st(), 'flat_bench', plan, '2026-11-23', 0)).toBe('10');
  });
});
