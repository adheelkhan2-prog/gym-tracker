// Mon–Fri upper-body split. Sat and Sun are rest days. No leg or ab exercises (injury).

import { EXERCISES } from './exercises';

export type PlannedExercise = {
  /** Stable key for this slot in the day (used for variant choices). */
  slot: string;
  /** One exercise, or the options of an "X OR Y" slot. */
  options: string[];
  sets: number;
  /** Target, e.g. "8-10", "max", "30-40". Unit comes from the exercise's log kind. */
  target: string;
  note?: string;
};

export type WorkoutDay = {
  id: string;
  name: string;
  focus: string;
  exercises: PlannedExercise[];
  /** Shown on pressing exercises of this day. */
  pressNote?: string;
};

const one = (slot: string, id: string, sets: number, target: string, note?: string): PlannedExercise => ({
  slot,
  options: [id],
  sets,
  target,
  note,
});

export const DAYS: WorkoutDay[] = [
  {
    id: 'mon',
    name: 'Chest, Biceps & Shoulders',
    focus: 'Push hard on presses, pump the arms',
    exercises: [
      one('mon-1', 'flat_bench', 3, '8-10'),
      one('mon-2', 'incline_db_press', 3, '8-12'),
      one('mon-3', 'cable_fly', 3, '12-15'),
      one('mon-4', 'incline_db_curl', 3, '10-12'),
      one('mon-5', 'ez_curl', 3, '8-12'),
      one('mon-6', 'front_raise', 2, '12-15'),
      one('mon-7', 'lateral_raise', 4, '12-20'),
    ],
  },
  {
    id: 'tue',
    name: 'Back & Triceps',
    focus: 'Pull wide, squeeze every row',
    exercises: [
      one('tue-1', 'lat_pulldown', 3, '8-12'),
      one('tue-2', 'seated_cable_row', 3, '8-12'),
      one('tue-3', 'single_arm_db_row', 3, '10-12'),
      one('tue-4', 'rear_raise', 3, '12-15'),
      one('tue-5', 'db_shrug', 3, '12-15'),
      one('tue-6', 'triceps_pushdown', 3, '10-15'),
      one('tue-7', 'overhead_db_ext', 3, '10-15'),
    ],
  },
  {
    id: 'wed',
    name: 'Chest & Forearms',
    focus: 'Moderate presses, crush the grip work',
    pressNote: 'Keep press weights moderate: shoulders and triceps are trained tomorrow.',
    exercises: [
      one('wed-1', 'incline_bb_press', 3, '6-10'),
      one('wed-2', 'machine_chest_press', 3, '10-12'),
      { slot: 'wed-3', options: ['pec_deck', 'cable_crossover'], sets: 3, target: '12-15' },
      one('wed-4', 'push_ups', 2, 'max', 'Max clean reps. Stop 1–2 reps before failure.'),
      one('wed-5', 'wrist_curl', 3, '15'),
      one('wed-6', 'reverse_wrist_curl', 3, '15'),
      one('wed-7', 'bb_reverse_curl', 3, '12-15'),
      one('wed-8', 'farmers_walk', 3, '30-40'),
    ],
  },
  {
    id: 'thu',
    name: 'Shoulders & Arms',
    focus: 'Big delts, full arm day',
    exercises: [
      one('thu-1', 'db_shoulder_press', 3, '8-12'),
      one('thu-2', 'lateral_raise', 3, '15-20'),
      one('thu-3', 'rear_delt_fly', 3, '12-15'),
      one('thu-4', 'close_grip_bench', 3, '8-10'),
      one('thu-5', 'rope_pushdown', 3, '10-15'),
      one('thu-6', 'hammer_curl', 3, '10-12'),
      one('thu-7', 'concentration_curl', 3, '10-12'),
    ],
  },
  {
    id: 'fri',
    name: 'Back & Chest',
    focus: 'Finish the week strong',
    exercises: [
      { slot: 'fri-1', options: ['wide_pulldown', 'pull_ups'], sets: 3, target: '8-12' },
      { slot: 'fri-2', options: ['bb_bent_row', 'db_bent_row'], sets: 3, target: '8-10' },
      one('fri-3', 'seated_cable_row', 3, '10-12'),
      one('fri-4', 'straight_arm_pulldown', 3, '12-15'),
      one('fri-5', 'flat_db_press', 3, '10-12'),
      one('fri-6', 'cable_crossover', 3, '12-15'),
    ],
  },
];

/** Weekday (0 = Sunday) -> day id, or null for rest. */
export const DEFAULT_WEEK: (string | null)[] = [null, 'mon', 'tue', 'wed', 'thu', 'fri', null];

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const dayById = (id: string | null | undefined) => DAYS.find((d) => d.id === id);

/** Rest between sets: 2 min on heavy compounds, 90 s otherwise. */
export const restFor = (exerciseId: string) => (EXERCISES[exerciseId]?.heavy ? 120 : 90);

/** Top of the rep/time range ("8-12" -> 12, "15" -> 15, "max" -> null). */
export const targetTop = (target: string) => {
  const n = target.match(/\d+/g);
  return n ? Math.max(...n.map(Number)) : null;
};

/** The exercise used for a slot, given the remembered variant choices. */
export const pickOption = (p: PlannedExercise, variants: Record<string, string>) =>
  p.options.includes(variants[p.slot]) ? variants[p.slot] : p.options[0];

/** Every exercise id that appears anywhere in the program. */
export const ALL_EXERCISE_IDS = [...new Set(DAYS.flatMap((d) => d.exercises.flatMap((e) => e.options)))];
