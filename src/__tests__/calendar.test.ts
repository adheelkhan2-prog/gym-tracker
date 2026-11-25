/** Workout calendar: month grid, day marks, month summary and one day's session. */
import { addMonths, dayMark, daySession, monthGrid, monthSummary } from '../calendar';
import { DEFAULT_STATE, type State } from '../store';

const set = (w: number, r: number) => ({ weight: String(w), reps: String(r), done: true, u: 'kg' as const });
const st = (extra: Partial<State> = {}): State => ({ ...DEFAULT_STATE, unit: 'kg', ...extra });

test('month grid: Monday first, whole weeks, every date once', () => {
  const g = monthGrid(2026, 10); // November 2026 starts on a Sunday
  expect(g[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
  expect(g[0][6]).toBe('2026-11-01');
  expect(g.flat().filter(Boolean)).toHaveLength(30);
  expect(g.every((w) => w.length === 7)).toBe(true);
  expect(addMonths({ y: 2026, m: 11 }, 1)).toEqual({ y: 2027, m: 0 });
  expect(addMonths({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 });
});

test('day marks: finished = done, sets without finishing = partial, nothing = none', () => {
  const s = st({
    logs: { '2026-11-23': { flat_bench: { sets: [set(60, 8)] } }, '2026-11-24': { flat_bench: { sets: [set(60, 8)] } } },
    sessions: { '2026-11-23': { dayId: 'mon', startedAt: 1, finishedAt: 2 }, '2026-11-25': { dayId: 'wed', finishedAt: 5 } },
  });
  expect(dayMark(s, '2026-11-23')).toBe('done');
  expect(dayMark(s, '2026-11-24')).toBe('partial');
  expect(dayMark(s, '2026-11-25')).toBeNull(); // finished with 0 sets is not a workout
});

test('month summary: workouts, volume, PRs and longest streak (rest days don\'t break it)', () => {
  const s = st({
    logs: {
      '2026-10-30': { flat_bench: { sets: [set(50, 8)] } },
      '2026-11-02': { flat_bench: { sets: [set(60, 8)] } },
      '2026-11-03': { lat_pulldown: { sets: [set(50, 10)] } },
      '2026-11-04': { flat_bench: { sets: [set(62.5, 8)] } },
      '2026-11-09': { flat_bench: { sets: [set(65, 8)] } },
    },
  });
  const m = monthSummary(s, 2026, 10, '2026-11-25');
  expect(m.workouts).toBe(4);
  expect(m.volume).toBe(60 * 8 + 50 * 10 + 62.5 * 8 + 65 * 8);
  expect(m.prs).toBe(3); // 60, 62.5, 65 each beat the best before (50 in October)
  expect(m.longestStreak).toBe(3); // Mon-Wed; Thu (scheduled, missed) breaks it
});

test('a day session lists every exercise and marks the PR set', () => {
  const s = st({
    logs: { '2026-11-17': { flat_bench: { sets: [set(60, 8)] } }, '2026-11-24': { flat_bench: { sets: [set(60, 8), set(65, 6)] } } },
    sessions: { '2026-11-24': { dayId: 'mon', startedAt: 0, finishedAt: 45 * 60000 } },
  });
  const d = daySession(s, '2026-11-24');
  expect(d.title).toBe('Chest, Biceps & Shoulders');
  expect(d.minutes).toBe(45);
  expect(d.prs).toBe(1);
  expect(d.exercises[0].sets.map((x) => x.pr)).toEqual([false, true]);
  expect(d.volume).toBe(60 * 8 + 65 * 6);
});

test('a big history (3 years, 5 days a week) summarises a month quickly', () => {
  const logs: State['logs'] = {};
  for (let i = 0; i < 365 * 3; i++) {
    const d = new Date(2024, 0, 1 + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    logs[k] = { flat_bench: { sets: [set(60 + (i % 20), 8), set(60, 8), set(60, 8)] }, lat_pulldown: { sets: [set(50, 10), set(50, 10)] } };
  }
  const t = Date.now();
  monthSummary(st({ logs }), 2026, 10, '2026-11-25');
  expect(Date.now() - t).toBeLessThan(1500);
});
