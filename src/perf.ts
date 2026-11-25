// Speed checks for test builds only. With EXPO_PUBLIC_PERF=1 at build time (the emulator perf
// run), the app logs timing marks to logcat and, on a fresh install, starts with a large fake
// history so Progress can be measured realistically. Normal builds never set the flag: the
// constant is inlined as false and none of this runs.
import type { State } from './store';

export const PERF = process.env.EXPO_PUBLIC_PERF === '1';

/** "[perf] name 1732540000000" in logcat (epoch ms), test builds only. */
export function perfMark(name: string) {
  if (PERF) console.log(`[perf] ${name} ${Date.now()}`);
}

/** About 2.5 years of the Upper Body 5-Day split, Mon-Fri, 7 exercises x 3 sets a day. */
export function bigHistory(base: State, today = new Date()): State {
  const logs: State['logs'] = {};
  const sessions: State['sessions'] = {};
  const taken: State['taken'] = {};
  const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const pad = (n: number) => String(n).padStart(2, '0');
  for (let i = 900; i >= 1; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    taken[k] = { Creatine: true, Protein: i % 9 !== 0 };
    const wd = d.getDay();
    if (wd === 0 || wd === 6 || i % 11 === 0) continue;
    const dayId = days[wd - 1];
    const ids: Record<string, string[]> = {
      mon: ['flat_bench', 'incline_db_press', 'cable_fly', 'incline_db_curl', 'ez_curl', 'front_raise', 'lateral_raise'],
      tue: ['lat_pulldown', 'seated_cable_row', 'single_arm_db_row', 'rear_raise', 'db_shrug', 'triceps_pushdown', 'overhead_db_ext'],
      wed: ['incline_bb_press', 'machine_chest_press', 'pec_deck', 'wrist_curl', 'reverse_wrist_curl', 'bb_reverse_curl', 'farmers_walk'],
      thu: ['db_shoulder_press', 'lateral_raise', 'rear_delt_fly', 'close_grip_bench', 'rope_pushdown', 'hammer_curl', 'concentration_curl'],
      fri: ['wide_pulldown', 'bb_bent_row', 'seated_cable_row', 'straight_arm_pulldown', 'flat_db_press', 'cable_crossover', 'lateral_raise'],
    };
    const w = 20 + Math.floor((900 - i) / 30);
    logs[k] = Object.fromEntries(
      ids[dayId].map((id) => [id, { sets: [0, 1, 2].map((s) => ({ weight: String(w + (s === 0 ? 2.5 : 0)), reps: String(8 + ((i + s) % 5)), done: true, u: 'kg' as const })) }]),
    );
    sessions[k] = { dayId, startedAt: d.getTime() + 18 * 3600000, finishedAt: d.getTime() + 18 * 3600000 + 55 * 60000 };
  }
  return { ...base, unit: 'kg', logs, sessions, taken };
}
