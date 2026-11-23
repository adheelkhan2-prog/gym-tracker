/**
 * Data safety across app updates: everything a user has saved must come back unchanged after the
 * app is updated (load -> migrate), and nothing may be lost when saved data is old or unreadable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BACKUP_PREFIX,
  DEFAULT_STATE,
  STORAGE_KEY,
  loadState,
  migrate,
  prCountsByDate,
  supplementStreak,
  trainingStreak,
  type State,
} from '../store';


const TODAY = '2026-11-20';

/** A saved state that uses every feature: logs with every load type, PRs, streaks, a non-default
 * program, swaps, variants, load types, machines, gym, supplements and settings. */
function richState(): State {
  return {
    ...DEFAULT_STATE,
    unit: 'kg',
    programId: 'ppl6',
    week: ['ppl-legs-b', 'ppl-push-a', 'ppl-pull-a', null, 'ppl-push-b', 'ppl-pull-b', 'ppl-legs-a'],
    injured: false,
    restSound: false,
    blur: false,
    supplements: ['Creatine', 'Protein'],
    remindersOn: true,
    reminderTimes: ['07:30', '13:00', '19:00'],
    taken: {
      '2026-11-18': { Creatine: true, Protein: true },
      '2026-11-19': { Creatine: true, Protein: true },
      '2026-11-20': { Creatine: true, Protein: true },
    },
    variants: { 'wed-3': 'cable_crossover' },
    swaps: { 'mon-1': 'flat_db_press' },
    loadTypes: { lat_pulldown: 'stack', flat_bench: 'plates', bb_bent_row: 'colors' },
    machines: { lat_pulldown: { perPlate: 7, start: 7 } },
    gym: { ...DEFAULT_STATE.gym, bar: 15 },
    customPrograms: [],
    pending: null,
    easeInFrom: '2026-11-01',
    easeInDismissed: true,
    warmups: { '2026-11-20': true },
    sessions: {
      '2026-11-18': { dayId: 'mon', startedAt: 1, finishedAt: 2 },
      '2026-11-19': { dayId: 'tue', startedAt: 3, finishedAt: 4 },
      '2026-11-20': { dayId: 'wed', startedAt: 5, finishedAt: 6 },
    },
    logs: {
      '2026-11-18': {
        flat_bench: {
          sets: [
            { weight: '60', reps: '8', done: true, u: 'kg', load: { t: 'plates', plates: [20], bar: 20 } },
            { weight: '135', reps: '8', done: true, u: 'lb' },
          ],
        },
        lat_pulldown: { sets: [{ weight: '', reps: '10', done: true, u: 'kg', load: { t: 'stack', pin: 7 } }] },
      },
      '2026-11-19': {
        flat_bench: { sets: [{ weight: '65', reps: '8', done: true, u: 'kg' }] },
        bb_bent_row: { sets: [{ weight: '60', reps: '10', done: true, u: 'kg', load: { t: 'colors', colors: ['blue'], bar: 20 } }] },
        push_ups: { sets: [{ weight: '', reps: '20', done: true, u: 'kg' }] },
      },
      '2026-11-20': {
        flat_bench: { sets: [{ weight: '70', reps: '6', done: true, u: 'kg' }], skipped: false },
      },
    },
  };
}

beforeEach(() => AsyncStorage.clear());

describe('update keeps saved data', () => {
  test('a v3 save comes back identical after load + migrate', async () => {
    const saved = richState();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const loaded = await loadState();
    expect(loaded).toEqual(saved);
  });

  test('logs, PRs and streaks are the same before and after an update', async () => {
    const saved = richState();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const loaded = (await loadState())!;
    expect(prCountsByDate(loaded.logs)).toEqual(prCountsByDate(saved.logs));
    expect(trainingStreak(loaded, TODAY)).toBe(trainingStreak(saved, TODAY));
    expect(trainingStreak(loaded, TODAY)).toBe(3);
    expect(supplementStreak(loaded, TODAY)).toBe(3);
  });

  test('program choice, swaps, variants, load types, machines, gym and settings survive', async () => {
    const saved = richState();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const s = (await loadState())!;
    expect(s.programId).toBe('ppl6');
    expect(s.week).toEqual(saved.week);
    expect(s.swaps).toEqual(saved.swaps);
    expect(s.variants).toEqual(saved.variants);
    expect(s.loadTypes).toEqual(saved.loadTypes);
    expect(s.machines).toEqual(saved.machines);
    expect(s.gym.bar).toBe(15);
    expect([s.unit, s.injured, s.restSound, s.blur, s.remindersOn]).toEqual(['kg', false, false, false, true]);
    expect(s.reminderTimes).toEqual(['07:30', '13:00', '19:00']);
  });

  test('settings added in a later version get defaults without touching old data', () => {
    const saved: Partial<State> = { ...richState() };
    delete saved.gym;
    delete saved.machines;
    delete saved.blur;
    const s = migrate(JSON.parse(JSON.stringify(saved)), false);
    expect(s.gym).toEqual(DEFAULT_STATE.gym);
    expect(s.machines).toEqual({});
    expect(s.blur).toBe(true);
    expect(s.logs).toEqual(richState().logs);
  });

  test('logs for an exercise this version does not know are kept (an update never deletes history)', () => {
    const saved = richState();
    saved.logs['2026-11-19'].removed_in_future = { sets: [{ weight: '10', reps: '10', done: true, u: 'kg' }] };
    const s = migrate(JSON.parse(JSON.stringify(saved)), false);
    expect(s.logs['2026-11-19'].removed_in_future.sets).toHaveLength(1);
    // ...and unknown ids don't break the numbers built from logs.
    expect(() => prCountsByDate(s.logs)).not.toThrow();
  });

  test('v2 sets without their own unit keep the unit chosen at the time', async () => {
    await AsyncStorage.setItem(
      'gym-tracker/state/v2',
      JSON.stringify({ unit: 'lb', logs: { '2026-01-05': { flat_bench: { sets: [{ weight: '135', reps: '5', done: true }] } } } }),
    );
    const s = (await loadState())!;
    expect(s.logs['2026-01-05'].flat_bench.sets[0]).toEqual({ weight: '135', reps: '5', done: true, u: 'lb' });
  });

  test('v1 saves are mapped to the current exercise ids', async () => {
    await AsyncStorage.setItem(
      'gym-tracker/state/v1',
      JSON.stringify({ unit: 'kg', logs: { '2025-06-02': { Pullups: [{ weight: '', reps: '8', done: true }], Not_In_App: [] } } }),
    );
    const s = (await loadState())!;
    expect(Object.keys(s.logs['2025-06-02'])).toEqual(['pull_ups']);
    expect(s.logs['2025-06-02'].pull_ups.sets[0].u).toBe('kg');
  });

  test('unreadable saved data is backed up before the app starts fresh', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{"logs": {broken');
    expect(await loadState()).toBeNull();
    const keys = await AsyncStorage.getAllKeys();
    const backup = keys.find((k) => k.startsWith(BACKUP_PREFIX));
    expect(backup).toBeDefined();
    expect(await AsyncStorage.getItem(backup!)).toBe('{"logs": {broken');
  });

  test('a fresh install loads nothing', async () => {
    expect(await loadState()).toBeNull();
  });
});
