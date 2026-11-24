/** Rotating plans: each workout is the next day in order. */
import { PROGRAMS, type Program } from '../data/programs';
import { DEFAULT_STATE, trainingStreak, weekSummary, type State } from '../store';
import { nextInRotation, todayDayId } from '../workout';

const rot: Program = {
  id: 'custom-rot',
  name: 'Rotation',
  focus: '',
  blurb: '',
  custom: true,
  rotation: true,
  week: [null, null, null, null, null, null, null],
  days: ['A', 'B', 'C'].map((n) => ({ id: `r${n}`, name: n, focus: '', exercises: [{ slot: `r${n}-1`, options: ['flat_bench'], sets: 3, target: '8-10' }] })),
};
const base: State = { ...DEFAULT_STATE, programId: rot.id, customPrograms: [rot], week: rot.week, logs: {}, sessions: {} };
const done = (date: string, dayId: string, s: State): State => ({
  ...s,
  sessions: { ...s.sessions, [date]: { dayId, startedAt: 1, finishedAt: 2 } },
  logs: { ...s.logs, [date]: { flat_bench: { sets: [{ weight: '60', reps: '8', done: true, u: 'kg' }] } } },
});

test('first workout of a rotating plan is its first day; then the next in order, wrapping round', () => {
  expect(nextInRotation(base, '2026-11-24')).toBe('rA');
  const a = done('2026-11-20', 'rA', base);
  expect(nextInRotation(a, '2026-11-24')).toBe('rB');
  const c = done('2026-11-22', 'rC', done('2026-11-21', 'rB', a));
  expect(nextInRotation(c, '2026-11-24')).toBe('rA');
});

test('Today shows the next rotation day on any weekday (no rest days by weekday)', () => {
  const a = done('2026-11-20', 'rA', base);
  expect(todayDayId(a, '2026-11-24', 2).id).toBe('rB');
  expect(todayDayId(a, '2026-11-29', 0).id).toBe('rB'); // a Sunday too
});

test('weekday plans are unchanged', () => {
  const st: State = { ...DEFAULT_STATE, programId: 'upper5', week: PROGRAMS[0].week, logs: {}, sessions: {} };
  expect(todayDayId(st, '2026-11-24', 2).id).toBe(PROGRAMS[0].week[2]);
});

test('rotating plans: the streak survives rest days and breaks after 3+ days off', () => {
  const s = done('2026-11-23', 'rC', done('2026-11-21', 'rB', done('2026-11-20', 'rA', base)));
  expect(trainingStreak(s, '2026-11-24')).toBe(3); // one or two rest days in between are fine
  const gap = done('2026-11-16', 'rC', s);
  expect(trainingStreak(gap, '2026-11-24')).toBe(3); // 17-19 Nov: 3 days off broke it
});

test('rotating plans plan one session per rotation day in the week summary', () => {
  expect(weekSummary(base, '2026-11-24').planned).toBe(3);
});

