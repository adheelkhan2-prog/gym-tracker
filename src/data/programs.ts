// The program library. Templates follow published, evidence-based splits; every source is
// listed in src/data/exercise-sources.md. Day ids are unique across programs so old sessions
// always point at the right day, and slots are unique so swaps are remembered per program.

import { DAYS, DEFAULT_WEEK, type PlannedExercise, type WorkoutDay } from './program';

export type Program = {
  id: string;
  name: string;
  /** One-line focus for the card. */
  focus: string;
  /** Longer note on who it suits. */
  blurb: string;
  days: WorkoutDay[];
  /** Weekday (0 = Sunday) -> day id, or null for rest. Days may repeat (Arnold split). */
  week: (string | null)[];
  custom?: boolean;
  /** Rotating plan: no fixed weekdays; each workout is the next day in order (Day 1, 2, 3, 1, ...). */
  rotation?: boolean;
};

const ex = (day: string, n: number, id: string, sets: number, target: string, note?: string): PlannedExercise => ({
  slot: `${day}-${n}`,
  options: [id],
  sets,
  target,
  note,
});

/** Build a day from [exercise, sets, target] rows; slots are numbered from 1. */
const day = (id: string, name: string, focus: string, rows: [string, number, string, string?][]): WorkoutDay => ({
  id,
  name,
  focus,
  exercises: rows.map(([e, sets, target, note], i) => ex(id, i + 1, e, sets, target, note)),
});

const R = null;

export const PROGRAMS: Program[] = [
  {
    id: 'upper5',
    name: 'Upper Body 5-Day',
    focus: 'Chest, back, shoulders, arms. No legs or abs.',
    blurb: 'Your current split. Every muscle above the waist twice a week while your legs and abs rest.',
    days: DAYS,
    week: DEFAULT_WEEK,
  },
  {
    id: 'ppl6',
    name: 'Push / Pull / Legs',
    focus: 'Every muscle twice a week, 6 days.',
    blurb: 'The classic high-frequency split. Heavy compound first, then accessories. Best when you can train six days.',
    days: [
      day('ppl-push-a', 'Push A', 'Heavy bench, then shoulders and triceps', [
        ['flat_bench', 4, '6-8'],
        ['db_shoulder_press', 3, '8-10'],
        ['incline_db_press', 3, '8-12'],
        ['lateral_raise', 3, '12-20'],
        ['triceps_pushdown', 3, '10-15'],
        ['overhead_db_ext', 3, '10-15'],
      ]),
      day('ppl-pull-a', 'Pull A', 'Deadlift, then vertical and horizontal pulls', [
        ['deadlift', 3, '5'],
        ['pull_ups', 3, '6-10'],
        ['seated_cable_row', 3, '8-12'],
        ['face_pull', 3, '12-15'],
        ['ez_curl', 3, '8-12'],
        ['hammer_curl', 3, '10-12'],
      ]),
      day('ppl-legs-a', 'Legs A', 'Squat-focused', [
        ['back_squat', 4, '6-8'],
        ['rdl', 3, '8-10'],
        ['leg_press', 3, '10-12'],
        ['lying_leg_curl', 3, '10-12'],
        ['standing_calf_raise', 4, '10-15'],
        ['hanging_leg_raise', 3, '10-15'],
      ]),
      day('ppl-push-b', 'Push B', 'Overhead press first, more volume', [
        ['bb_ohp', 4, '6-8'],
        ['incline_bb_press', 3, '8-10'],
        ['machine_chest_press', 3, '10-12'],
        ['cable_fly', 3, '12-15'],
        ['lateral_raise', 4, '15-20'],
        ['rope_pushdown', 3, '10-15'],
      ]),
      day('ppl-pull-b', 'Pull B', 'Rows first, rear delts and arms', [
        ['bb_bent_row', 4, '6-8'],
        ['lat_pulldown', 3, '8-12'],
        ['single_arm_db_row', 3, '10-12'],
        ['rear_delt_fly', 3, '12-15'],
        ['incline_db_curl', 3, '10-12'],
        ['db_shrug', 3, '10-15'],
      ]),
      day('ppl-legs-b', 'Legs B', 'Single-leg and glute-focused', [
        ['bulgarian_split_squat', 3, '8-10'],
        ['hip_thrust', 3, '8-12'],
        ['leg_extension', 3, '12-15'],
        ['seated_leg_curl', 3, '10-12'],
        ['seated_calf_raise', 4, '12-15'],
        ['cable_crunch', 3, '10-15'],
      ]),
    ],
    week: [R, 'ppl-push-a', 'ppl-pull-a', 'ppl-legs-a', 'ppl-push-b', 'ppl-pull-b', 'ppl-legs-b'],
  },
  {
    id: 'pplul5',
    name: 'PPL + Upper / Lower',
    focus: 'Push, pull, legs, then upper and lower. 5 days.',
    blurb: 'Hits everything twice a week in five sessions. A good middle ground between PPL and Upper/Lower.',
    days: [
      day('pplul-push', 'Push', 'Chest, shoulders, triceps', [
        ['flat_bench', 3, '6-8'],
        ['incline_db_press', 3, '8-12'],
        ['db_shoulder_press', 3, '8-10'],
        ['lateral_raise', 3, '12-20'],
        ['triceps_pushdown', 3, '10-15'],
      ]),
      day('pplul-pull', 'Pull', 'Back, rear delts, biceps', [
        ['pull_ups', 3, '6-10'],
        ['bb_bent_row', 3, '6-10'],
        ['seated_cable_row', 3, '10-12'],
        ['face_pull', 3, '12-15'],
        ['ez_curl', 3, '8-12'],
      ]),
      day('pplul-legs', 'Legs', 'Squat and hinge', [
        ['back_squat', 3, '6-8'],
        ['rdl', 3, '8-10'],
        ['leg_extension', 3, '12-15'],
        ['lying_leg_curl', 3, '10-12'],
        ['standing_calf_raise', 3, '10-15'],
      ]),
      day('pplul-upper', 'Upper', 'Lighter upper body, more reps', [
        ['incline_bb_press', 3, '8-10'],
        ['single_arm_db_row', 3, '8-12'],
        ['machine_chest_press', 3, '10-12'],
        ['lat_pulldown', 3, '10-12'],
        ['rope_pushdown', 3, '10-15'],
        ['hammer_curl', 3, '10-12'],
      ]),
      day('pplul-lower', 'Lower', 'Machines and single-leg work', [
        ['leg_press', 3, '10-12'],
        ['hip_thrust', 3, '8-12'],
        ['bulgarian_split_squat', 3, '8-10'],
        ['seated_leg_curl', 3, '10-12'],
        ['seated_calf_raise', 3, '12-15'],
        ['hanging_leg_raise', 3, '10-15'],
      ]),
    ],
    week: [R, 'pplul-push', 'pplul-pull', 'pplul-legs', R, 'pplul-upper', 'pplul-lower'],
  },
  {
    id: 'ul4',
    name: 'Upper / Lower',
    focus: 'Power days and hypertrophy days. 4 days.',
    blurb: 'Two heavier days for strength, two higher-rep days for size (PHUL-style). Plenty of recovery between sessions.',
    days: [
      day('ul-upper-power', 'Upper Power', 'Heavy press and row', [
        ['flat_bench', 4, '5-8'],
        ['bb_bent_row', 4, '5-8'],
        ['db_shoulder_press', 3, '8-10'],
        ['lat_pulldown', 3, '8-10'],
        ['ez_curl', 2, '8-10'],
        ['skull_crusher', 2, '8-10'],
      ]),
      day('ul-lower-power', 'Lower Power', 'Heavy squat and deadlift', [
        ['back_squat', 4, '5-8'],
        ['deadlift', 3, '5'],
        ['leg_press', 3, '10-12'],
        ['lying_leg_curl', 3, '8-10'],
        ['standing_calf_raise', 4, '8-12'],
      ]),
      day('ul-upper-hyp', 'Upper Hypertrophy', 'More reps, more pump', [
        ['incline_db_press', 3, '8-12'],
        ['cable_fly', 3, '12-15'],
        ['seated_cable_row', 3, '10-12'],
        ['single_arm_db_row', 3, '10-12'],
        ['lateral_raise', 3, '12-20'],
        ['incline_db_curl', 3, '10-12'],
        ['rope_pushdown', 3, '10-15'],
      ]),
      day('ul-lower-hyp', 'Lower Hypertrophy', 'Front squat, single-leg and isolation', [
        ['front_squat', 3, '8-10'],
        ['rdl', 3, '10-12'],
        ['bulgarian_split_squat', 3, '10-12'],
        ['leg_extension', 3, '12-15'],
        ['seated_leg_curl', 3, '12-15'],
        ['seated_calf_raise', 4, '12-15'],
        ['cable_crunch', 3, '10-15'],
      ]),
    ],
    week: [R, 'ul-upper-power', 'ul-lower-power', R, 'ul-upper-hyp', 'ul-lower-hyp', R],
  },
  {
    id: 'fb3',
    name: 'Full Body',
    focus: 'Whole body every session. 3 days.',
    blurb: 'Each muscle three times a week with fewer sets per session. Great when time is short or you’re coming back.',
    days: [
      day('fb-a', 'Full Body A', 'Squat, bench, row', [
        ['back_squat', 3, '6-8'],
        ['flat_bench', 3, '6-8'],
        ['bb_bent_row', 3, '8-10'],
        ['lateral_raise', 2, '12-20'],
        ['ez_curl', 2, '10-12'],
        ['plank', 2, '30-60'],
      ]),
      day('fb-b', 'Full Body B', 'Hinge, incline, pulldown', [
        ['rdl', 3, '8-10'],
        ['incline_db_press', 3, '8-12'],
        ['lat_pulldown', 3, '8-12'],
        ['db_shoulder_press', 3, '8-10'],
        ['rope_pushdown', 2, '10-15'],
        ['standing_calf_raise', 3, '10-15'],
      ]),
      day('fb-c', 'Full Body C', 'Machines and glutes', [
        ['leg_press', 3, '10-12'],
        ['machine_chest_press', 3, '10-12'],
        ['seated_cable_row', 3, '10-12'],
        ['hip_thrust', 3, '8-12'],
        ['rear_delt_fly', 2, '12-15'],
        ['hammer_curl', 2, '10-12'],
      ]),
    ],
    week: [R, 'fb-a', R, 'fb-b', R, 'fb-c', R],
  },
  {
    id: 'bro5',
    name: 'Bro Split',
    focus: 'One muscle group a day. 5 days.',
    blurb: 'Lots of volume for one area per session, each muscle once a week. Fun and focused; keep weekly sets high.',
    days: [
      day('bro-chest', 'Chest', 'Presses and flyes', [
        ['flat_bench', 4, '6-10'],
        ['incline_db_press', 3, '8-12'],
        ['machine_chest_press', 3, '10-12'],
        ['cable_fly', 3, '12-15'],
        ['chest_dips', 2, '8-12'],
      ]),
      day('bro-back', 'Back', 'Width and thickness', [
        ['pull_ups', 3, '6-10'],
        ['bb_bent_row', 4, '6-10'],
        ['lat_pulldown', 3, '10-12'],
        ['seated_cable_row', 3, '10-12'],
        ['straight_arm_pulldown', 3, '12-15'],
        ['db_shrug', 3, '10-15'],
      ]),
      day('bro-shoulders', 'Shoulders', 'All three delt heads', [
        ['bb_ohp', 4, '6-10'],
        ['lateral_raise', 4, '12-20'],
        ['rear_delt_fly', 3, '12-15'],
        ['front_raise', 2, '12-15'],
        ['face_pull', 3, '12-15'],
      ]),
      day('bro-legs', 'Legs', 'Quads, hamstrings, calves', [
        ['back_squat', 4, '6-10'],
        ['leg_press', 3, '10-12'],
        ['rdl', 3, '8-10'],
        ['leg_extension', 3, '12-15'],
        ['lying_leg_curl', 3, '10-12'],
        ['standing_calf_raise', 4, '10-15'],
      ]),
      day('bro-arms', 'Arms & Abs', 'Biceps, triceps, abs', [
        ['ez_curl', 3, '8-12'],
        ['close_grip_bench', 3, '6-10'],
        ['incline_db_curl', 3, '10-12'],
        ['overhead_db_ext', 3, '10-12'],
        ['hammer_curl', 3, '10-12'],
        ['rope_pushdown', 3, '12-15'],
        ['cable_crunch', 3, '10-15'],
      ]),
    ],
    week: [R, 'bro-chest', 'bro-back', 'bro-shoulders', 'bro-legs', 'bro-arms', R],
  },
  {
    id: 'arnold6',
    name: 'Arnold Split',
    focus: 'Chest & back, shoulders & arms, legs. Twice a week.',
    blurb: 'Antagonist pairings, each muscle twice a week over six days. High volume; best with some training years behind you.',
    days: [
      day('arn-cb', 'Chest & Back', 'Push and pull pairs', [
        ['flat_bench', 4, '6-10'],
        ['pull_ups', 4, '6-10'],
        ['incline_db_press', 3, '8-12'],
        ['bb_bent_row', 3, '8-10'],
        ['cable_fly', 3, '12-15'],
        ['db_pullover', 3, '10-12'],
      ]),
      day('arn-sa', 'Shoulders & Arms', 'Delts, then biceps and triceps', [
        ['arnold_press', 4, '8-10'],
        ['lateral_raise', 3, '12-15'],
        ['bb_curl', 3, '8-10'],
        ['close_grip_bench', 3, '8-10'],
        ['incline_db_curl', 3, '10-12'],
        ['skull_crusher', 3, '10-12'],
        ['wrist_curl', 3, '15'],
      ]),
      day('arn-legs', 'Legs', 'Squat, hinge, calves, abs', [
        ['back_squat', 4, '6-10'],
        ['rdl', 3, '8-10'],
        ['leg_extension', 3, '12-15'],
        ['lying_leg_curl', 3, '10-12'],
        ['standing_calf_raise', 5, '10-15'],
        ['hanging_leg_raise', 3, '10-15'],
      ]),
    ],
    week: [R, 'arn-cb', 'arn-sa', 'arn-legs', 'arn-cb', 'arn-sa', 'arn-legs'],
  },
];


export const trainingDays = (week: (string | null)[]) => week.filter(Boolean).length;
