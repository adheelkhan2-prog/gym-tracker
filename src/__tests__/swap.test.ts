/** Mid-workout swaps (focus mode / exercise screen) and the exact-primary swap rule. */
import { EXERCISES } from '../data/exercises';
import { PROGRAMS } from '../data/programs';
import { SWAPS, samePrimary, swapsFor } from '../data/swaps';
import { DEFAULT_STATE, type SetEntry, type State } from '../store';
import { exerciseFor, slotStatuses, swapSlot } from '../workout';

const D = '2026-11-23';
const day = PROGRAMS[0].days.find((d) => d.id === 'mon')!;
const plan = day.exercises[0]; // flat_bench, 3 sets
const set = (w: string): SetEntry => ({ weight: w, reps: '10', done: true, u: 'kg' });
const base: State = { ...DEFAULT_STATE, programId: 'upper5', injured: true, logs: {}, swaps: {}, variants: {} };

describe('swapping mid-workout', () => {
  test('logged sets stay under the original; the remaining sets continue on the new exercise', () => {
    const s0: State = { ...base, logs: { [D]: { flat_bench: { sets: [set('60'), set('60')] } } } };
    const s1 = swapSlot(s0, D, plan, 'flat_db_press');
    expect(exerciseFor(s1, plan)).toBe('flat_db_press');
    expect(s1.logs[D].flat_bench.sets).toHaveLength(2); // history and PRs untouched
    expect(s1.logs[D].flat_db_press.carried).toBe(2);
    const st = slotStatuses(s1, day, D)[0];
    expect(st).toMatchObject({ exerciseId: 'flat_db_press', done: 2, complete: false });
    // One more set on the new exercise completes the slot.
    const s2: State = { ...s1, logs: { ...s1.logs, [D]: { ...s1.logs[D], flat_db_press: { ...s1.logs[D].flat_db_press, sets: [set('24')] } } } };
    expect(slotStatuses(s2, day, D)[0]).toMatchObject({ done: 3, complete: true });
  });

  test('swapping back never double-counts', () => {
    const s0: State = { ...base, logs: { [D]: { flat_bench: { sets: [set('60')] } } } };
    const s1 = swapSlot(s0, D, plan, 'flat_db_press');
    const s2: State = { ...s1, logs: { ...s1.logs, [D]: { ...s1.logs[D], flat_db_press: { ...s1.logs[D].flat_db_press, sets: [set('24')] } } } };
    const s3 = swapSlot(s2, D, plan, 'flat_bench');
    expect(exerciseFor(s3, plan)).toBe('flat_bench');
    expect(s3.swaps[plan.slot]).toBeUndefined();
    expect(slotStatuses(s3, day, D)[0].done).toBe(2);
  });

  test('a swap before any set just changes the exercise', () => {
    const s1 = swapSlot(base, D, plan, 'machine_chest_press');
    expect(exerciseFor(s1, plan)).toBe('machine_chest_press');
    expect(s1.logs[D]).toBeUndefined();
  });
});

describe('swap options', () => {
  test('every offered swap has exactly the same primary muscles, and there are no "close" options', () => {
    for (const id of Object.keys(EXERCISES)) {
      for (const sw of swapsFor(id, false)) {
        expect(samePrimary(id, sw.id)).toBe(true);
        expect(sw.match).toBe('same');
      }
    }
    for (const list of Object.values(SWAPS)) for (const sw of list) expect(sw.match).toBe('same');
  });

  test('exercises with no exact match get no swaps rather than a near miss', () => {
    expect(swapsFor('db_shoulder_press', false)).toEqual([]);
  });
});
