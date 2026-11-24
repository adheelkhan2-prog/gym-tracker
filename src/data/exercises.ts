import { MORE } from './exercises-more';
import type { MuscleId } from './muscles';

/**
 * How a set is logged:
 * - weight_reps: weight × reps (most lifts)
 * - reps: reps only (push-ups)
 * - weight_time: weight × seconds (farmer's walk)
 */
export type LogKind = 'weight_reps' | 'reps' | 'weight_time' | 'time';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'plate_loaded'
  | 'smith'
  | 'ez_bar'
  | 'trap_bar'
  | 'bodyweight';

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  plate_loaded: 'Plate-loaded',
  smith: 'Smith machine',
  ez_bar: 'EZ bar',
  trap_bar: 'Trap bar',
  bodyweight: 'Bodyweight',
};

/** Movement pattern, used to find swaps for exercises without a researched list. */
export type Pattern =
  | 'h_press'
  | 'incline_press'
  | 'v_press'
  | 'fly'
  | 'dip'
  | 'v_pull'
  | 'h_pull'
  | 'pullover'
  | 'shrug'
  | 'lat_raise'
  | 'front_raise'
  | 'rear_delt'
  | 'tri_ext'
  | 'tri_overhead'
  | 'curl'
  | 'hammer'
  | 'wrist_flex'
  | 'wrist_ext'
  | 'carry'
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'knee_ext'
  | 'knee_flex'
  | 'hip_ext'
  | 'calf'
  | 'core_flex'
  | 'core_hip'
  | 'core_brace';

export type ExerciseInfo = {
  id: string;
  name: string;
  kind: LogKind;
  /** Heavy compound: 2 min rest instead of 90 s. */
  heavy?: boolean;
  /** Pressing movement (gets the Wednesday "keep it moderate" note). */
  press?: boolean;
  primary: MuscleId[];
  secondary: MuscleId[];
  steps: string[];
  equipment: Equipment;
  pattern: Pattern;
};

type Base = Omit<ExerciseInfo, 'equipment' | 'pattern'> & Partial<Pick<ExerciseInfo, 'equipment' | 'pattern'>>;

const TRICEPS: MuscleId[] = ['triceps_lateral', 'triceps_medial', 'triceps_long'];
const PECS: MuscleId[] = ['pec_major_upper', 'pec_major_lower'];
const LATS: MuscleId[] = ['upper_lats', 'lower_lats'];

const list: Base[] = [
  // ---------- Chest ----------
  {
    id: 'flat_bench',
    name: 'Flat Bench Press',
    kind: 'weight_reps',
    heavy: true,
    press: true,
    primary: PECS,
    secondary: ['anterior_delt', ...TRICEPS],
    steps: [
      'Lie on the bench with eyes under the bar, feet flat, shoulder blades pinched back.',
      'Grip just wider than shoulders and unrack with straight arms.',
      'Lower the bar to mid-chest with elbows about 45° from your body.',
      'Press up and slightly back until your arms are straight.',
    ],
  },
  {
    id: 'incline_db_press',
    name: 'Incline Dumbbell Press',
    kind: 'weight_reps',
    press: true,
    primary: ['pec_major_upper'],
    secondary: ['anterior_delt', 'triceps_lateral', 'triceps_medial'],
    steps: [
      'Set the bench to 30–45°. Sit back with a dumbbell on each thigh and kick them up.',
      'Start with the dumbbells over your upper chest, palms forward.',
      'Lower until you feel a stretch across the chest, elbows slightly tucked.',
      'Press up and together without clanking the weights.',
    ],
  },
  {
    id: 'incline_bb_press',
    name: 'Incline Barbell Press',
    kind: 'weight_reps',
    heavy: true,
    press: true,
    primary: ['pec_major_upper'],
    secondary: ['anterior_delt', ...TRICEPS],
    steps: [
      'Set the bench to about 30°. Pinch your shoulder blades back and plant your feet.',
      'Unrack with a grip just wider than shoulders.',
      'Lower the bar to your upper chest, just under the collarbone.',
      'Press straight up. Keep the weight moderate so shoulders stay fresh.',
    ],
  },
  {
    id: 'machine_chest_press',
    name: 'Machine Chest Press',
    kind: 'weight_reps',
    press: true,
    primary: PECS,
    secondary: ['anterior_delt', 'triceps_lateral', 'triceps_medial'],
    steps: [
      'Set the seat so the handles line up with mid-chest.',
      'Press forward until your arms are almost straight. Don’t lock out hard.',
      'Return slowly until you feel a chest stretch.',
    ],
  },
  {
    id: 'flat_db_press',
    name: 'Flat Dumbbell Press',
    kind: 'weight_reps',
    press: true,
    primary: PECS,
    secondary: ['anterior_delt', 'triceps_lateral', 'triceps_medial'],
    steps: [
      'Lie back with the dumbbells over your chest, palms forward.',
      'Lower them out to the sides until they are level with your chest.',
      'Press up in a slight arc so they meet over your chest.',
    ],
  },
  {
    id: 'cable_fly',
    name: 'Cable Fly',
    kind: 'weight_reps',
    primary: PECS,
    secondary: ['anterior_delt'],
    steps: [
      'Set both pulleys around shoulder height. Take a handle in each hand and step forward.',
      'With a soft bend in your elbows, open your arms wide until you feel a stretch.',
      'Hug the handles together in front of your chest and squeeze for a second.',
    ],
  },
  {
    id: 'cable_crossover',
    name: 'Cable Crossover',
    kind: 'weight_reps',
    primary: ['pec_major_lower', 'pec_major_upper'],
    secondary: ['anterior_delt'],
    steps: [
      'Set both pulleys high. Step forward with a staggered stance.',
      'Pull the handles down and across in front of your hips, elbows slightly bent.',
      'Let your hands cross slightly, squeeze, then return slowly.',
    ],
  },
  {
    id: 'pec_deck',
    name: 'Pec Deck',
    kind: 'weight_reps',
    primary: PECS,
    secondary: ['anterior_delt'],
    steps: [
      'Set the seat so the handles are at chest height.',
      'With a slight bend in your elbows, bring the handles together in front of you.',
      'Squeeze for a second, then open slowly until you feel a stretch.',
    ],
  },
  {
    id: 'push_ups',
    name: 'Push-Ups',
    kind: 'reps',
    press: true,
    primary: PECS,
    secondary: ['anterior_delt', ...TRICEPS, 'serratus_anterior'],
    steps: [
      'Hands just wider than shoulders, body in one straight line.',
      'Lower until your chest is a fist’s height off the floor.',
      'Push back up. Stop 1–2 reps before failure, clean reps only.',
    ],
  },
  // ---------- Shoulders ----------
  {
    id: 'db_shoulder_press',
    name: 'Dumbbell Shoulder Press',
    kind: 'weight_reps',
    heavy: true,
    press: true,
    primary: ['anterior_delt', 'lateral_delt'],
    secondary: [...TRICEPS, 'upper_traps'],
    steps: [
      'Sit upright with back support. Hold the dumbbells at shoulder height, palms forward.',
      'Press up until your arms are straight, without arching your lower back.',
      'Lower under control to ear level.',
    ],
  },
  {
    id: 'lateral_raise',
    name: 'Lateral Raise',
    kind: 'weight_reps',
    primary: ['lateral_delt'],
    secondary: ['upper_traps', 'anterior_delt'],
    steps: [
      'Stand tall with a light dumbbell in each hand at your sides.',
      'With a soft elbow bend, raise them out to the sides to shoulder height.',
      'Lead with your elbows, pause, and lower slowly.',
    ],
  },
  {
    id: 'front_raise',
    name: 'Front Raise',
    kind: 'weight_reps',
    primary: ['anterior_delt'],
    secondary: ['lateral_delt', 'pec_major_upper'],
    steps: [
      'Hold a dumbbell in each hand in front of your thighs.',
      'Raise one or both straight in front to shoulder height.',
      'Lower slowly. Don’t swing.',
    ],
  },
  {
    id: 'rear_raise',
    name: 'Bent-Over Rear Raise',
    kind: 'weight_reps',
    primary: ['posterior_delt'],
    secondary: ['mid_traps', 'rhomboids', 'rotator_cuff'],
    steps: [
      'Hinge forward until your chest is nearly parallel to the floor, back flat.',
      'Let light dumbbells hang under your chest, palms facing in.',
      'Raise them out to the sides, squeezing your rear delts, then lower slowly.',
    ],
  },
  {
    id: 'rear_delt_fly',
    name: 'Rear Delt Fly',
    kind: 'weight_reps',
    primary: ['posterior_delt'],
    secondary: ['mid_traps', 'rhomboids'],
    steps: [
      'Sit facing the pec deck (or use cables) with arms straight in front.',
      'Pull your arms back and out in a wide arc until they are in line with your body.',
      'Pause, then return slowly.',
    ],
  },
  // ---------- Back ----------
  {
    id: 'lat_pulldown',
    name: 'Lat Pulldown',
    kind: 'weight_reps',
    heavy: true,
    primary: LATS,
    secondary: ['teres_major', 'biceps', 'rhomboids'],
    steps: [
      'Sit with thighs under the pad and grip the bar just wider than shoulders.',
      'Lean back slightly and pull the bar to your upper chest, elbows down and back.',
      'Squeeze your lats, then let the bar rise under control.',
    ],
  },
  {
    id: 'wide_pulldown',
    name: 'Wide-Grip Pulldown',
    kind: 'weight_reps',
    heavy: true,
    primary: LATS,
    secondary: ['teres_major', 'rhomboids', 'biceps'],
    steps: [
      'Grip the bar wide, about 1.5× shoulder width.',
      'Pull it to your upper chest, driving your elbows down to your sides.',
      'Control the bar back up until your arms are straight.',
    ],
  },
  {
    id: 'pull_ups',
    name: 'Pull-Ups',
    kind: 'weight_reps',
    heavy: true,
    primary: LATS,
    secondary: ['teres_major', 'biceps', 'brachialis', 'rhomboids'],
    steps: [
      'Hang from the bar with an overhand grip just wider than shoulders.',
      'Pull your chest toward the bar until your chin clears it.',
      'Lower all the way down. Log 0 for bodyweight, or the extra weight you add.',
    ],
  },
  {
    id: 'seated_cable_row',
    name: 'Seated Cable Row',
    kind: 'weight_reps',
    heavy: true,
    primary: ['mid_traps', 'rhomboids', ...LATS],
    secondary: ['posterior_delt', 'biceps', 'erector_spinae'],
    steps: [
      'Sit tall with knees slightly bent and grab the handle.',
      'Pull it to your belly, squeezing your shoulder blades together.',
      'Let your arms straighten and shoulders reach forward, without rounding your back.',
    ],
  },
  {
    id: 'single_arm_db_row',
    name: 'Single-Arm Dumbbell Row',
    kind: 'weight_reps',
    heavy: true,
    primary: [...LATS, 'rhomboids'],
    secondary: ['posterior_delt', 'biceps', 'teres_major'],
    steps: [
      'Put one hand and knee on a bench, back flat, dumbbell hanging in the other hand.',
      'Row the dumbbell toward your hip, elbow close to your body.',
      'Lower until your arm is straight and repeat. Then switch sides.',
    ],
  },
  {
    id: 'bb_bent_row',
    name: 'Barbell Bent-Over Row',
    kind: 'weight_reps',
    heavy: true,
    primary: [...LATS, 'mid_traps', 'rhomboids'],
    secondary: ['posterior_delt', 'biceps', 'erector_spinae'],
    steps: [
      'Hinge forward about 45° with a flat back, bar hanging at your knees.',
      'Row the bar to your lower ribs, elbows back.',
      'Lower with control. Keep your torso still.',
    ],
  },
  {
    id: 'db_bent_row',
    name: 'Dumbbell Bent-Over Row',
    kind: 'weight_reps',
    heavy: true,
    primary: [...LATS, 'mid_traps', 'rhomboids'],
    secondary: ['posterior_delt', 'biceps', 'erector_spinae'],
    steps: [
      'Hinge forward with a flat back, a dumbbell in each hand, palms facing in.',
      'Row both dumbbells toward your hips.',
      'Lower slowly until your arms are straight.',
    ],
  },
  {
    id: 'straight_arm_pulldown',
    name: 'Straight-Arm Pulldown',
    kind: 'weight_reps',
    primary: LATS,
    secondary: ['teres_major', 'triceps_long'],
    steps: [
      'Face a high cable with a bar or rope. Hinge slightly with arms straight.',
      'Sweep the handle down to your thighs, keeping your arms straight.',
      'Squeeze your lats, then let it rise slowly.',
    ],
  },
  {
    id: 'db_shrug',
    name: 'Dumbbell Shrug',
    kind: 'weight_reps',
    primary: ['upper_traps'],
    secondary: ['forearm_flexors', 'hand_muscles'],
    steps: [
      'Stand tall with heavy dumbbells at your sides.',
      'Shrug your shoulders straight up toward your ears.',
      'Hold for a second at the top, then lower slowly. Don’t roll them.',
    ],
  },
  // ---------- Triceps ----------
  {
    id: 'triceps_pushdown',
    name: 'Triceps Pushdown',
    kind: 'weight_reps',
    primary: ['triceps_lateral', 'triceps_medial'],
    secondary: ['triceps_long'],
    steps: [
      'Stand at a high cable with a straight or V bar, elbows pinned to your sides.',
      'Push the bar down until your arms are straight.',
      'Let it rise to about chest height without moving your elbows.',
    ],
  },
  {
    id: 'rope_pushdown',
    name: 'Rope Pushdown',
    kind: 'weight_reps',
    primary: ['triceps_lateral', 'triceps_medial'],
    secondary: ['triceps_long'],
    steps: [
      'Use the rope on a high cable, elbows tucked to your sides.',
      'Push down and spread the rope ends apart at the bottom.',
      'Return slowly, elbows staying still.',
    ],
  },
  {
    id: 'overhead_db_ext',
    name: 'Overhead Dumbbell Extension',
    kind: 'weight_reps',
    primary: ['triceps_long'],
    secondary: ['triceps_lateral', 'triceps_medial'],
    steps: [
      'Sit or stand holding one dumbbell overhead with both hands.',
      'Lower it behind your head, elbows pointing up.',
      'Extend back up until your arms are straight.',
    ],
  },
  {
    id: 'close_grip_bench',
    name: 'Close-Grip Bench Press',
    kind: 'weight_reps',
    heavy: true,
    press: true,
    primary: TRICEPS,
    secondary: ['pec_major_lower', 'anterior_delt'],
    steps: [
      'Lie on the bench and grip the bar about shoulder width.',
      'Lower to your lower chest with elbows tucked close to your body.',
      'Press up, pushing through your triceps.',
    ],
  },
  // ---------- Biceps ----------
  {
    id: 'incline_db_curl',
    name: 'Incline Dumbbell Curl',
    kind: 'weight_reps',
    primary: ['biceps'],
    secondary: ['brachialis', 'forearm_flexors'],
    steps: [
      'Sit back on a 45–60° incline bench, arms hanging straight down.',
      'Curl both dumbbells up without moving your upper arms.',
      'Lower all the way for a full stretch.',
    ],
  },
  {
    id: 'ez_curl',
    name: 'EZ-Bar Curl',
    kind: 'weight_reps',
    primary: ['biceps'],
    secondary: ['brachialis', 'brachioradialis'],
    steps: [
      'Hold the EZ bar on the angled grips, arms straight.',
      'Curl it up, keeping your elbows at your sides.',
      'Squeeze at the top, then lower slowly.',
    ],
  },
  {
    id: 'hammer_curl',
    name: 'Hammer Curl',
    kind: 'weight_reps',
    primary: ['brachialis', 'brachioradialis'],
    secondary: ['biceps'],
    steps: [
      'Hold dumbbells at your sides, palms facing each other.',
      'Curl them up keeping that neutral grip.',
      'Lower slowly. Don’t swing.',
    ],
  },
  {
    id: 'concentration_curl',
    name: 'Concentration Curl',
    kind: 'weight_reps',
    primary: ['biceps'],
    secondary: ['brachialis'],
    steps: [
      'Sit on a bench and rest the back of your upper arm on your inner thigh.',
      'Curl the dumbbell up toward your shoulder.',
      'Squeeze hard at the top and lower all the way down.',
    ],
  },
  // ---------- Forearms & grip ----------
  {
    id: 'wrist_curl',
    name: 'Wrist Curl',
    kind: 'weight_reps',
    primary: ['forearm_flexors'],
    secondary: ['hand_muscles'],
    steps: [
      'Sit with forearms on your thighs, palms up, wrists just past your knees.',
      'Let the weight roll down to your fingers.',
      'Curl your wrists up as high as you can.',
    ],
  },
  {
    id: 'reverse_wrist_curl',
    name: 'Reverse Wrist Curl',
    kind: 'weight_reps',
    primary: ['forearm_extensors'],
    secondary: ['brachioradialis'],
    steps: [
      'Sit with forearms on your thighs, palms down, wrists past your knees.',
      'Lower the weight by bending your wrists down.',
      'Raise the back of your hands up as high as you can.',
    ],
  },
  {
    id: 'bb_reverse_curl',
    name: 'Barbell Reverse Curl',
    kind: 'weight_reps',
    primary: ['brachioradialis', 'forearm_extensors'],
    secondary: ['biceps', 'brachialis'],
    steps: [
      'Hold a barbell with an overhand grip, shoulder width.',
      'Curl it up keeping your wrists straight and elbows at your sides.',
      'Lower slowly.',
    ],
  },
  {
    id: 'farmers_walk',
    name: 'Farmer’s Walk',
    kind: 'weight_time',
    primary: ['forearm_flexors', 'hand_muscles', 'upper_traps'],
    secondary: ['forearm_extensors', 'mid_traps'],
    steps: [
      'Pick up heavy dumbbells or handles, standing tall, shoulders back.',
      'Walk with short, controlled steps for the target time.',
      'Set them down with control. Grip is the goal, not distance.',
    ],
  },
];

// Equipment and movement pattern for the original upper-body exercises.
const META: Record<string, [Equipment, Pattern]> = {
  flat_bench: ['barbell', 'h_press'],
  incline_db_press: ['dumbbell', 'incline_press'],
  incline_bb_press: ['barbell', 'incline_press'],
  machine_chest_press: ['machine', 'h_press'],
  flat_db_press: ['dumbbell', 'h_press'],
  cable_fly: ['cable', 'fly'],
  cable_crossover: ['cable', 'fly'],
  pec_deck: ['machine', 'fly'],
  push_ups: ['bodyweight', 'h_press'],
  db_shoulder_press: ['dumbbell', 'v_press'],
  lateral_raise: ['dumbbell', 'lat_raise'],
  front_raise: ['dumbbell', 'front_raise'],
  rear_raise: ['dumbbell', 'rear_delt'],
  rear_delt_fly: ['machine', 'rear_delt'],
  lat_pulldown: ['cable', 'v_pull'],
  wide_pulldown: ['cable', 'v_pull'],
  pull_ups: ['bodyweight', 'v_pull'],
  seated_cable_row: ['cable', 'h_pull'],
  single_arm_db_row: ['dumbbell', 'h_pull'],
  bb_bent_row: ['barbell', 'h_pull'],
  db_bent_row: ['dumbbell', 'h_pull'],
  straight_arm_pulldown: ['cable', 'pullover'],
  db_shrug: ['dumbbell', 'shrug'],
  triceps_pushdown: ['cable', 'tri_ext'],
  rope_pushdown: ['cable', 'tri_ext'],
  overhead_db_ext: ['dumbbell', 'tri_overhead'],
  close_grip_bench: ['barbell', 'h_press'],
  incline_db_curl: ['dumbbell', 'curl'],
  ez_curl: ['ez_bar', 'curl'],
  hammer_curl: ['dumbbell', 'hammer'],
  concentration_curl: ['dumbbell', 'curl'],
  wrist_curl: ['barbell', 'wrist_flex'],
  reverse_wrist_curl: ['barbell', 'wrist_ext'],
  bb_reverse_curl: ['barbell', 'hammer'],
  farmers_walk: ['dumbbell', 'carry'],
};

export const EXERCISES: Record<string, ExerciseInfo> = Object.fromEntries(
  [...list, ...MORE].map((e) => {
    const m = META[e.id];
    return [e.id, { ...e, equipment: e.equipment ?? m?.[0] ?? 'machine', pattern: e.pattern ?? m?.[1] ?? 'h_press' } as ExerciseInfo];
  }),
);

export const EXERCISE_LIST = Object.values(EXERCISES);

