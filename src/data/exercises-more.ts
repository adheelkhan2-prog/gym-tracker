// The rest of the library: alternatives for swaps, and the leg and ab work used by the
// other programs. Muscles follow ExRx target/synergist listings and the EMG studies in
// src/data/exercise-sources.md.

import type { Equipment, ExerciseInfo, LogKind, Pattern } from './exercises';
import type { MuscleId } from './muscles';

const TRI: MuscleId[] = ['triceps_lateral', 'triceps_medial', 'triceps_long'];
const PECS: MuscleId[] = ['pec_major_upper', 'pec_major_lower'];
const LATS: MuscleId[] = ['upper_lats', 'lower_lats'];
const QUADS: MuscleId[] = ['vastus_group', 'rectus_femoris'];
const HAMS: MuscleId[] = ['medial_hamstrings', 'lateral_hamstrings'];
const CALVES: MuscleId[] = ['gastrocnemius', 'soleus'];

type Opts = { heavy?: boolean; press?: boolean };

const x = (
  id: string,
  name: string,
  kind: LogKind,
  equipment: Equipment,
  pattern: Pattern,
  primary: MuscleId[],
  secondary: MuscleId[],
  steps: string[],
  o: Opts = {},
): ExerciseInfo => ({ id, name, kind, equipment, pattern, primary, secondary, steps, ...o });

const W = 'weight_reps' as const;

export const MORE: ExerciseInfo[] = [
  // ---------- Chest ----------
  x('smith_bench', 'Smith Machine Bench Press', W, 'smith', 'h_press', PECS, ['anterior_delt', ...TRI], [
    'Set a flat bench under the Smith bar so it lines up with your mid-chest.',
    'Grip just wider than shoulders, shoulder blades pinched, and unhook the bar.',
    'Lower to mid-chest with elbows about 45° from your body.',
    'Press straight up until your arms are straight.',
  ], { press: true }),
  x('weighted_push_ups', 'Weighted Push-Up', W, 'bodyweight', 'h_press', PECS, ['anterior_delt', ...TRI, 'serratus_anterior'], [
    'Have a partner place a plate high on your back, or wear a weight vest.',
    'Hands just wider than shoulders, body in one straight line.',
    'Lower until your chest is a fist from the floor, elbows about 45°.',
    'Push the floor away until your arms are straight.',
  ], { press: true }),
  x('db_floor_press', 'Dumbbell Floor Press', W, 'dumbbell', 'h_press', PECS, [...TRI, 'anterior_delt'], [
    'Lie on the floor, knees bent, a dumbbell in each hand over your chest.',
    'Lower until your upper arms touch the floor, elbows about 45°.',
    'Pause for a beat, then press back up.',
  ], { press: true }),
  x('incline_smith_press', 'Incline Smith Press', W, 'smith', 'incline_press', ['pec_major_upper'], ['anterior_delt', ...TRI], [
    'Set a bench to 30° under the Smith bar so it lowers to your upper chest.',
    'Grip just wider than shoulders and unhook the bar.',
    'Lower to just under your collarbone, then press straight up.',
  ], { press: true }),
  x('incline_machine_press', 'Incline Machine Press', W, 'machine', 'incline_press', ['pec_major_upper'], ['anterior_delt', 'triceps_lateral', 'triceps_medial'], [
    'Set the seat so the handles line up with your upper chest.',
    'Press the handles forward and up until your arms are straight.',
    'Return slowly until you feel a stretch across your chest.',
  ], { press: true }),
  x('db_fly', 'Dumbbell Fly', W, 'dumbbell', 'fly', PECS, ['anterior_delt'], [
    'Lie on a flat bench with dumbbells over your chest, palms facing each other.',
    'With a soft bend in the elbows, open your arms in a wide arc.',
    'Stop when you feel a deep stretch, then hug the weights back together.',
  ]),
  x('incline_cable_fly', 'Low-to-High Cable Fly', W, 'cable', 'fly', ['pec_major_upper'], ['anterior_delt'], [
    'Set both pulleys low. Take a handle in each hand and step forward.',
    'With soft elbows, sweep your hands up and together to chin height.',
    'Squeeze your upper chest, then lower slowly.',
  ]),
  x('chest_dips', 'Chest Dip', 'reps', 'bodyweight', 'dip', ['pec_major_lower'], ['anterior_delt', ...TRI], [
    'Support yourself on parallel bars with straight arms.',
    'Lean your torso forward and lower until your shoulders are just below your elbows.',
    'Press back up, keeping the forward lean.',
  ], { press: true }),
  // ---------- Shoulders ----------
  x('bb_ohp', 'Overhead Press', W, 'barbell', 'v_press', ['anterior_delt'], ['lateral_delt', ...TRI, 'upper_traps', 'serratus_anterior'], [
    'Stand with the bar on your front shoulders, grip just outside shoulder width.',
    'Brace your abs and squeeze your glutes.',
    'Press the bar straight up, moving your head back then through once it passes.',
    'Lock out overhead, then lower to your collarbone.',
  ], { heavy: true, press: true }),
  x('machine_shoulder_press', 'Machine Shoulder Press', W, 'machine', 'v_press', ['anterior_delt'], ['lateral_delt', ...TRI], [
    'Set the seat so the handles start at shoulder height.',
    'Press up until your arms are nearly straight.',
    'Lower slowly back to shoulder height.',
  ], { press: true }),
  x('arnold_press', 'Arnold Press', W, 'dumbbell', 'v_press', ['anterior_delt'], ['lateral_delt', ...TRI], [
    'Sit with dumbbells in front of your shoulders, palms facing you.',
    'Press up while rotating your palms to face forward.',
    'Reverse the twist on the way down.',
  ], { press: true }),
  x('smith_ohp', 'Smith Machine Shoulder Press', W, 'smith', 'v_press', ['anterior_delt'], ['lateral_delt', ...TRI], [
    'Sit on an upright bench under the Smith bar.',
    'Unhook at chin height and press straight up.',
    'Lower back to chin height under control.',
  ], { press: true }),
  x('cable_lateral_raise', 'Cable Lateral Raise', W, 'cable', 'lat_raise', ['lateral_delt'], ['anterior_delt', 'upper_traps'], [
    'Stand side-on to a low pulley and take the handle in your far hand.',
    'Raise your arm out to the side to shoulder height, elbow soft.',
    'Lower slowly; the cable keeps tension at the bottom.',
  ]),
  x('seated_lateral_raise', 'Seated Lateral Raise', W, 'dumbbell', 'lat_raise', ['lateral_delt'], ['anterior_delt', 'upper_traps'], [
    'Sit on the end of a bench, dumbbells at your sides.',
    'Raise them out to shoulder height, leading with the elbows.',
    'Lower slowly without swinging.',
  ]),
  x('cable_upright_row', 'Cable Upright Row', W, 'cable', 'lat_raise', ['lateral_delt'], ['upper_traps', 'anterior_delt', 'biceps'], [
    'Hold a straight bar on a low pulley with a shoulder-width grip.',
    'Pull it up along your body, elbows leading, to lower-chest height.',
    'Stop before your elbows go above your shoulders, then lower.',
  ]),
  x('cable_front_raise', 'Cable Front Raise', W, 'cable', 'front_raise', ['anterior_delt'], ['lateral_delt', 'pec_major_upper'], [
    'Stand facing away from a low pulley, handle between your legs.',
    'Raise your straight arm forward to shoulder height.',
    'Lower slowly.',
  ]),
  x('plate_front_raise', 'Plate Front Raise', W, 'barbell', 'front_raise', ['anterior_delt'], ['lateral_delt', 'pec_major_upper'], [
    'Hold a plate at the 3 and 9 o’clock positions in front of your thighs.',
    'Raise it with straight arms to eye level.',
    'Lower under control.',
  ]),
  x('face_pull', 'Face Pull', W, 'cable', 'rear_delt', ['posterior_delt'], ['mid_traps', 'rhomboids', 'rotator_cuff'], [
    'Set a rope at upper-chest height. Grip the ends with thumbs back.',
    'Pull toward your face, splitting the rope and driving your elbows wide.',
    'Finish with hands beside your ears, then return slowly.',
  ]),
  x('cable_rear_delt_fly', 'Cable Rear Delt Fly', W, 'cable', 'rear_delt', ['posterior_delt'], ['mid_traps', 'rhomboids'], [
    'Set both pulleys at shoulder height. Cross the cables: left hand takes the right cable.',
    'With straight arms, pull them apart and back in a wide arc.',
    'Return slowly until your hands cross again.',
  ]),
  x('prone_rear_raise', 'Chest-Supported Rear Raise', W, 'dumbbell', 'rear_delt', ['posterior_delt'], ['mid_traps', 'rhomboids'], [
    'Lie face down on a bench set to about 30°, dumbbells hanging.',
    'Raise them out to the sides with soft elbows.',
    'Pause level with your body, then lower.',
  ]),
  // ---------- Back ----------
  x('chin_ups', 'Chin-Up', 'reps', 'bodyweight', 'v_pull', [...LATS, 'biceps'], ['teres_major', 'brachialis', 'rhomboids'], [
    'Hang from the bar with palms facing you, shoulder width.',
    'Pull until your chin clears the bar, elbows down to your sides.',
    'Lower all the way to a dead hang.',
  ]),
  x('assisted_pull_ups', 'Band-Assisted Pull-Up', 'reps', 'bodyweight', 'v_pull', LATS, ['teres_major', 'biceps', 'rhomboids'], [
    'Loop a band over the bar and put a knee or foot in it.',
    'Pull until your chin clears the bar.',
    'Lower slowly to straight arms. Use a lighter band as you get stronger.',
  ]),
  x('vbar_pulldown', 'Close-Grip Pulldown', W, 'cable', 'v_pull', LATS, ['teres_major', 'biceps', 'rhomboids'], [
    'Attach a V-handle and sit with thighs under the pad.',
    'Pull the handle to your upper chest, elbows close to your body.',
    'Let it rise until your arms are straight.',
  ], { heavy: true }),
  x('single_arm_pulldown', 'Single-Arm Pulldown', W, 'cable', 'v_pull', LATS, ['teres_major', 'biceps'], [
    'Set a single handle high and kneel or sit beneath it.',
    'Pull your elbow down to your side, palm turning in.',
    'Reach all the way up between reps.',
  ]),
  x('chest_supported_row', 'Chest-Supported Dumbbell Row', W, 'dumbbell', 'h_pull', ['rhomboids', 'mid_traps', ...LATS], ['posterior_delt', 'biceps'], [
    'Lie face down on a bench set to about 30°, a dumbbell in each hand.',
    'Row your elbows back past your body, squeezing your shoulder blades.',
    'Lower until your arms are straight.',
  ]),
  x('tbar_row', 'T-Bar Row', W, 'plate_loaded', 'h_pull', ['rhomboids', 'mid_traps', ...LATS], ['posterior_delt', 'biceps', 'erector_spinae'], [
    'Straddle the bar, hinge forward with a flat back, and grab the handle.',
    'Row it to your lower chest, driving your elbows back.',
    'Lower under control without rounding your back.',
  ], { heavy: true }),
  x('machine_row', 'Machine Row', W, 'machine', 'h_pull', ['rhomboids', 'mid_traps', ...LATS], ['posterior_delt', 'biceps'], [
    'Set the chest pad so you can just reach the handles.',
    'Pull the handles back until your elbows pass your body.',
    'Squeeze, then let your arms straighten.',
  ]),
  x('single_arm_cable_row', 'Single-Arm Cable Row', W, 'cable', 'h_pull', [...LATS, 'rhomboids'], ['mid_traps', 'posterior_delt', 'biceps'], [
    'Sit at a low pulley with one handle.',
    'Row it to your hip, keeping your torso square.',
    'Reach forward fully on the way back.',
  ]),
  x('inverted_row', 'Inverted Row', 'reps', 'bodyweight', 'h_pull', ['rhomboids', 'mid_traps', ...LATS], ['posterior_delt', 'biceps'], [
    'Hang under a bar set at waist height, body straight, heels on the floor.',
    'Pull your chest to the bar.',
    'Lower until your arms are straight. Raise the bar to make it easier.',
  ]),
  x('db_pullover', 'Dumbbell Pullover', W, 'dumbbell', 'pullover', LATS, ['pec_major_lower', 'teres_major', 'triceps_long', 'serratus_anterior'], [
    'Lie across a bench holding one dumbbell over your chest with both hands.',
    'With slightly bent elbows, lower it behind your head in an arc.',
    'Pull it back over your chest using your lats.',
  ]),
  x('rope_straight_arm', 'Rope Straight-Arm Pulldown', W, 'cable', 'pullover', LATS, ['teres_major', 'triceps_long', 'posterior_delt'], [
    'Attach a rope high. Hinge slightly with arms straight in front.',
    'Sweep the rope down to your thighs, flaring the ends at the bottom.',
    'Let it rise slowly to eye level.',
  ]),
  x('bb_shrug', 'Barbell Shrug', W, 'barbell', 'shrug', ['upper_traps'], ['mid_traps', 'forearm_flexors'], [
    'Hold a barbell in front of your thighs, shoulder-width grip.',
    'Shrug your shoulders straight up toward your ears.',
    'Hold a second, then lower.',
  ]),
  x('cable_shrug', 'Cable Shrug', W, 'cable', 'shrug', ['upper_traps'], ['mid_traps', 'forearm_flexors'], [
    'Hold a straight bar on a low pulley in front of your thighs.',
    'Shrug straight up, hold for a second.',
    'Lower slowly.',
  ]),
  x('deadlift', 'Deadlift', W, 'barbell', 'hinge', ['glute_max', 'erector_spinae', ...HAMS], [...QUADS, 'upper_traps', 'forearm_flexors', ...LATS], [
    'Stand with mid-foot under the bar, grip just outside your legs.',
    'Hips down, chest up, back flat. Pull the slack out of the bar.',
    'Push the floor away and stand tall, bar close to your legs.',
    'Hinge back down the same path.',
  ], { heavy: true }),
  x('trap_bar_deadlift', 'Trap Bar Deadlift', W, 'trap_bar', 'hinge', [...QUADS, 'glute_max'], [...HAMS, 'erector_spinae', 'upper_traps', 'forearm_flexors'], [
    'Stand in the middle of the trap bar and grip the handles.',
    'Hips down, chest up, back flat.',
    'Drive through your feet to stand tall, then lower the same way.',
  ], { heavy: true }),
  x('back_extension', '45° Back Extension', W, 'bodyweight', 'hinge', ['erector_spinae', 'glute_max'], HAMS, [
    'Set the pad just below your hips on a 45° bench.',
    'Hinge down with a flat back until you feel your hamstrings stretch.',
    'Raise until your body is in one straight line. Hold a plate to add load.',
  ]),
  // ---------- Arms ----------
  x('skull_crusher', 'EZ-Bar Skull Crusher', W, 'ez_bar', 'tri_overhead', ['triceps_long', 'triceps_lateral', 'triceps_medial'], [], [
    'Lie on a flat bench holding an EZ bar over your chest.',
    'Bend only at the elbows, lowering the bar to just behind your forehead.',
    'Extend back up.',
  ]),
  x('cable_overhead_ext', 'Cable Overhead Extension', W, 'cable', 'tri_overhead', ['triceps_long'], ['triceps_lateral', 'triceps_medial'], [
    'Attach a rope low, face away and hold it behind your head.',
    'Step forward into a split stance, elbows pointing forward.',
    'Extend your arms overhead, then let the rope stretch back.',
  ]),
  x('triceps_dips', 'Triceps Dip', 'reps', 'bodyweight', 'dip', TRI, ['pec_major_lower', 'anterior_delt'], [
    'Support yourself on parallel bars, body upright.',
    'Lower until your elbows reach 90°, keeping them tucked.',
    'Press back up to straight arms.',
  ], { press: true }),
  x('vbar_pushdown', 'V-Bar Pushdown', W, 'cable', 'tri_ext', ['triceps_lateral', 'triceps_medial'], ['triceps_long'], [
    'Attach a V-bar high. Elbows at your sides.',
    'Push down until your arms are straight.',
    'Let it rise until your forearms are just past parallel.',
  ]),
  x('db_kickback', 'Dumbbell Kickback', W, 'dumbbell', 'tri_ext', ['triceps_lateral', 'triceps_medial'], ['triceps_long'], [
    'Hinge forward with your upper arm pinned to your side.',
    'Straighten your arm back until it’s in line with your body.',
    'Squeeze, then lower.',
  ]),
  x('bb_curl', 'Barbell Curl', W, 'barbell', 'curl', ['biceps'], ['brachialis', 'brachioradialis'], [
    'Stand holding a barbell, palms forward, shoulder width.',
    'Curl it up keeping your elbows at your sides.',
    'Lower all the way down.',
  ]),
  x('db_curl', 'Dumbbell Curl', W, 'dumbbell', 'curl', ['biceps'], ['brachialis', 'brachioradialis'], [
    'Stand holding dumbbells, palms forward.',
    'Curl them up without swinging.',
    'Lower slowly to straight arms.',
  ]),
  x('cable_curl', 'Cable Curl', W, 'cable', 'curl', ['biceps'], ['brachialis', 'brachioradialis'], [
    'Hold a straight bar on a low pulley, palms up.',
    'Curl it up, elbows fixed at your sides.',
    'Lower slowly; the cable keeps tension at the bottom.',
  ]),
  x('preacher_curl', 'Preacher Curl', W, 'ez_bar', 'curl', ['biceps'], ['brachialis'], [
    'Sit at the preacher bench, upper arms flat on the pad.',
    'Curl the bar up toward your shoulders.',
    'Lower until your arms are almost straight.',
  ]),
  x('machine_curl', 'Machine Curl', W, 'machine', 'curl', ['biceps'], ['brachialis'], [
    'Set the seat so your elbows line up with the machine’s pivot.',
    'Curl the handles up and squeeze.',
    'Lower under control.',
  ]),
  x('rope_hammer_curl', 'Rope Hammer Curl', W, 'cable', 'hammer', ['brachialis', 'brachioradialis'], ['biceps'], [
    'Hold a rope on a low pulley, palms facing each other.',
    'Curl up keeping that neutral grip.',
    'Lower slowly.',
  ]),
  x('cross_body_hammer', 'Cross-Body Hammer Curl', W, 'dumbbell', 'hammer', ['brachialis', 'brachioradialis'], ['biceps'], [
    'Hold dumbbells at your sides, palms in.',
    'Curl one across your body toward the opposite shoulder.',
    'Lower and alternate sides.',
  ]),
  x('reverse_cable_curl', 'Reverse Cable Curl', W, 'cable', 'hammer', ['brachioradialis', 'forearm_extensors'], ['brachialis', 'biceps'], [
    'Hold a straight bar on a low pulley, palms down.',
    'Curl it up, wrists straight.',
    'Lower slowly.',
  ]),
  x('db_wrist_curl', 'Dumbbell Wrist Curl', W, 'dumbbell', 'wrist_flex', ['forearm_flexors'], ['hand_muscles'], [
    'Sit with forearms on your thighs, palms up, a dumbbell in each hand.',
    'Let them roll to your fingertips.',
    'Curl your wrists up as high as you can.',
  ]),
  x('cable_wrist_curl', 'Cable Wrist Curl', W, 'cable', 'wrist_flex', ['forearm_flexors'], ['hand_muscles'], [
    'Kneel or sit at a low pulley, forearms on a bench, palms up.',
    'Curl your wrists up against the cable.',
    'Lower slowly.',
  ]),
  x('db_reverse_wrist_curl', 'Dumbbell Reverse Wrist Curl', W, 'dumbbell', 'wrist_ext', ['forearm_extensors'], ['brachioradialis'], [
    'Sit with forearms on your thighs, palms down.',
    'Lift the backs of your hands as high as you can.',
    'Lower slowly.',
  ]),
  x('wrist_roller', 'Wrist Roller', W, 'barbell', 'wrist_ext', ['forearm_extensors', 'forearm_flexors'], ['hand_muscles', 'anterior_delt'], [
    'Hold the roller at shoulder height with straight arms.',
    'Roll the weight up by turning your wrists, one hand at a time.',
    'Roll it back down slowly. One full up-and-down is one rep.',
  ]),
  x('trap_bar_carry', 'Trap Bar Carry', 'weight_time', 'trap_bar', 'carry', ['forearm_flexors', 'hand_muscles', 'upper_traps'], ['forearm_extensors', 'mid_traps'], [
    'Stand inside a trap bar and deadlift it with a flat back.',
    'Walk tall with short, quick steps for the target time.',
    'Set it down with the same flat back.',
  ]),
  x('db_hold', 'Heavy Dumbbell Hold', 'weight_time', 'dumbbell', 'carry', ['forearm_flexors', 'hand_muscles'], ['upper_traps', 'forearm_extensors'], [
    'Pick up the heaviest dumbbells you can grip safely.',
    'Stand tall, shoulders back, and hold for the target time.',
    'Set them down before your grip opens.',
  ]),
  // ---------- Legs ----------
  x('back_squat', 'Back Squat', W, 'barbell', 'squat', [...QUADS, 'glute_max'], ['adductors', 'erector_spinae', ...HAMS], [
    'Set the bar on your upper back, hands just outside shoulders.',
    'Feet about shoulder width, toes slightly out. Brace your abs.',
    'Sit down between your heels until thighs are at least parallel.',
    'Drive up, knees tracking over your toes.',
  ], { heavy: true }),
  x('front_squat', 'Front Squat', W, 'barbell', 'squat', QUADS, ['glute_max', 'adductors', 'erector_spinae'], [
    'Rest the bar on your front shoulders, elbows high.',
    'Squat straight down, keeping your torso upright.',
    'Drive back up, elbows staying high.',
  ], { heavy: true }),
  x('goblet_squat', 'Goblet Squat', W, 'dumbbell', 'squat', [...QUADS, 'glute_max'], ['adductors', 'erector_spinae'], [
    'Hold one dumbbell vertically against your chest.',
    'Squat down between your knees, chest tall.',
    'Stand back up through your whole foot.',
  ]),
  x('leg_press', 'Leg Press', W, 'plate_loaded', 'squat', [...QUADS, 'glute_max'], ['adductors', ...HAMS], [
    'Sit with your back flat on the pad, feet shoulder width on the platform.',
    'Release the safeties and lower until your knees are near 90°.',
    'Press back up without locking your knees hard.',
  ], { heavy: true }),
  x('hack_squat', 'Hack Squat', W, 'plate_loaded', 'squat', QUADS, ['glute_max', 'adductors'], [
    'Stand on the platform with shoulders under the pads.',
    'Release the safeties and squat down to at least parallel.',
    'Drive back up through your whole foot.',
  ], { heavy: true }),
  x('smith_squat', 'Smith Machine Squat', W, 'smith', 'squat', [...QUADS, 'glute_max'], ['adductors', ...HAMS], [
    'Set the bar on your upper back, feet slightly in front of you.',
    'Unhook and squat down to at least parallel.',
    'Drive back up.',
  ]),
  x('bulgarian_split_squat', 'Bulgarian Split Squat', W, 'dumbbell', 'lunge', [...QUADS, 'glute_max'], ['adductors', 'glute_med', ...HAMS], [
    'Stand in front of a bench and rest your back foot on it.',
    'Hold dumbbells at your sides and lower your back knee toward the floor.',
    'Push through your front foot to stand. Finish one leg, then switch.',
  ]),
  x('db_lunge', 'Dumbbell Walking Lunge', W, 'dumbbell', 'lunge', [...QUADS, 'glute_max'], ['adductors', 'glute_med', ...HAMS], [
    'Hold dumbbells at your sides.',
    'Step forward and lower until your back knee nearly touches the floor.',
    'Push through your front foot and step into the next lunge.',
  ]),
  x('reverse_lunge', 'Reverse Lunge', W, 'dumbbell', 'lunge', ['glute_max', ...QUADS], ['adductors', 'glute_med', ...HAMS], [
    'Stand holding dumbbells.',
    'Step back and lower until both knees are near 90°.',
    'Push through your front heel to return.',
  ]),
  x('step_up', 'Dumbbell Step-Up', W, 'dumbbell', 'lunge', [...QUADS, 'glute_max'], ['glute_med', ...HAMS], [
    'Stand facing a knee-height box, dumbbells at your sides.',
    'Step up with one foot and drive through it to stand on the box.',
    'Step down slowly. Do all reps on one leg, then switch.',
  ]),
  x('leg_extension', 'Leg Extension', W, 'machine', 'knee_ext', QUADS, [], [
    'Sit with the pad on your lower shins and knees in line with the pivot.',
    'Straighten your legs and squeeze your quads.',
    'Lower slowly.',
  ]),
  x('sissy_squat', 'Sissy Squat', 'reps', 'bodyweight', 'knee_ext', QUADS, [], [
    'Hold a support. Rise onto your toes.',
    'Lean back and let your knees travel forward as you lower.',
    'Go as deep as you can control, then come back up.',
  ]),
  x('rdl', 'Romanian Deadlift', W, 'barbell', 'hinge', [...HAMS, 'glute_max'], ['erector_spinae', 'adductors', 'forearm_flexors'], [
    'Stand tall holding the bar at your thighs.',
    'Push your hips back with soft knees, bar sliding down your thighs.',
    'Stop when your hamstrings are fully stretched, back flat.',
    'Drive your hips forward to stand.',
  ], { heavy: true }),
  x('db_rdl', 'Dumbbell Romanian Deadlift', W, 'dumbbell', 'hinge', [...HAMS, 'glute_max'], ['erector_spinae', 'forearm_flexors'], [
    'Hold dumbbells in front of your thighs.',
    'Hinge back with soft knees until your hamstrings stretch.',
    'Squeeze your glutes to stand.',
  ]),
  x('good_morning', 'Good Morning', W, 'barbell', 'hinge', [...HAMS, 'erector_spinae'], ['glute_max', 'adductors'], [
    'Set a light bar on your upper back.',
    'Push your hips back with soft knees until your torso is near parallel.',
    'Drive your hips forward to stand.',
  ]),
  x('cable_pull_through', 'Cable Pull-Through', W, 'cable', 'hip_ext', ['glute_max'], [...HAMS, 'erector_spinae'], [
    'Face away from a low pulley holding a rope between your legs.',
    'Hinge back, letting the rope travel through your legs.',
    'Snap your hips forward and squeeze your glutes.',
  ]),
  x('lying_leg_curl', 'Lying Leg Curl', W, 'machine', 'knee_flex', HAMS, ['gastrocnemius'], [
    'Lie face down with the pad just above your heels.',
    'Curl your heels toward your glutes, hips pressed down.',
    'Lower slowly.',
  ]),
  x('seated_leg_curl', 'Seated Leg Curl', W, 'machine', 'knee_flex', HAMS, ['gastrocnemius'], [
    'Sit with knees lined up with the pivot and the thigh pad locked down.',
    'Curl the pad down and back as far as you can.',
    'Let it rise slowly.',
  ]),
  x('standing_leg_curl', 'Standing Leg Curl', W, 'machine', 'knee_flex', HAMS, ['gastrocnemius'], [
    'Stand at the machine with the pad behind one ankle.',
    'Curl your heel up toward your glute.',
    'Lower slowly. Switch legs.',
  ]),
  x('ball_leg_curl', 'Stability Ball Leg Curl', 'reps', 'bodyweight', 'knee_flex', HAMS, ['glute_max'], [
    'Lie on your back with heels on a ball, hips raised.',
    'Curl the ball toward you, keeping your hips up.',
    'Roll it back out slowly.',
  ]),
  x('glute_ham_raise', 'Glute-Ham Raise', 'reps', 'bodyweight', 'knee_flex', HAMS, ['glute_max', 'gastrocnemius'], [
    'Lock your ankles in the glute-ham bench, knees on the pad.',
    'Lower your body forward under control.',
    'Pull yourself back up with your hamstrings.',
  ]),
  x('hip_thrust', 'Barbell Hip Thrust', W, 'barbell', 'hip_ext', ['glute_max'], [...HAMS, 'glute_med', 'adductors'], [
    'Sit with your upper back against a bench, bar padded across your hips.',
    'Feet flat, about shoulder width.',
    'Drive your hips up until your body is flat from knees to shoulders.',
    'Squeeze your glutes, then lower.',
  ], { heavy: true }),
  x('glute_bridge', 'Barbell Glute Bridge', W, 'barbell', 'hip_ext', ['glute_max'], [...HAMS, 'glute_med'], [
    'Lie on the floor with a padded bar across your hips.',
    'Drive your hips up, squeezing your glutes.',
    'Lower until your glutes just touch the floor.',
  ]),
  x('single_leg_bridge', 'Single-Leg Glute Bridge', 'reps', 'bodyweight', 'hip_ext', ['glute_max'], [...HAMS, 'glute_med'], [
    'Lie on your back, one foot flat, the other leg straight.',
    'Drive through your planted heel to raise your hips.',
    'Lower slowly. Switch legs.',
  ]),
  x('standing_calf_raise', 'Standing Calf Raise', W, 'machine', 'calf', ['gastrocnemius'], ['soleus'], [
    'Stand on the step with the pads on your shoulders, heels hanging off.',
    'Lower your heels for a deep stretch.',
    'Rise as high as you can and pause.',
  ]),
  x('seated_calf_raise', 'Seated Calf Raise', W, 'machine', 'calf', ['soleus'], ['gastrocnemius'], [
    'Sit with the pad on your lower thighs, balls of your feet on the step.',
    'Lower your heels for a deep stretch.',
    'Push up as high as you can and pause.',
  ]),
  x('leg_press_calf_raise', 'Leg Press Calf Raise', W, 'plate_loaded', 'calf', ['gastrocnemius'], ['soleus'], [
    'Sit in the leg press with legs straight, balls of your feet on the platform edge.',
    'Let your toes come back for a stretch.',
    'Push the platform away with your toes.',
  ]),
  x('smith_calf_raise', 'Smith Machine Calf Raise', W, 'smith', 'calf', ['gastrocnemius'], ['soleus'], [
    'Stand on a block under the Smith bar, heels off the edge.',
    'Lower for a deep stretch.',
    'Rise as high as you can.',
  ]),
  x('db_calf_raise', 'Single-Leg Dumbbell Calf Raise', W, 'dumbbell', 'calf', CALVES, [], [
    'Stand on one foot on a step, dumbbell in the same-side hand.',
    'Lower your heel all the way down.',
    'Rise up as high as you can. Switch legs.',
  ]),
  // ---------- Abs ----------
  x('hanging_leg_raise', 'Hanging Leg Raise', 'reps', 'bodyweight', 'core_hip', ['rectus_abdominis', 'hip_flexors'], ['obliques'], [
    'Hang from a bar with straight arms.',
    'Curl your pelvis up as you lift your legs, no swinging.',
    'Lower slowly.',
  ]),
  x('captains_chair', 'Captain’s Chair Knee Raise', 'reps', 'bodyweight', 'core_hip', ['rectus_abdominis', 'hip_flexors'], ['obliques'], [
    'Rest your forearms on the pads, back against the chair.',
    'Pull your knees up toward your chest, curling your pelvis.',
    'Lower slowly.',
  ]),
  x('reverse_crunch', 'Reverse Crunch', 'reps', 'bodyweight', 'core_hip', ['rectus_abdominis'], ['obliques', 'hip_flexors'], [
    'Lie on your back, knees bent at 90°, hands by your sides.',
    'Curl your hips off the floor, bringing knees toward your chest.',
    'Lower slowly.',
  ]),
  x('lying_leg_raise', 'Lying Leg Raise', 'reps', 'bodyweight', 'core_hip', ['rectus_abdominis', 'hip_flexors'], ['obliques'], [
    'Lie on a bench, holding the end behind your head.',
    'Raise straight legs until they point at the ceiling.',
    'Lower without letting your back arch.',
  ]),
  x('cable_crunch', 'Cable Crunch', W, 'cable', 'core_flex', ['rectus_abdominis'], ['obliques'], [
    'Kneel below a high pulley holding a rope beside your head.',
    'Crunch down, bringing your ribs toward your hips.',
    'Return slowly. Hips stay still.',
  ]),
  x('machine_crunch', 'Machine Crunch', W, 'machine', 'core_flex', ['rectus_abdominis'], ['obliques'], [
    'Sit in the ab machine and grip the handles.',
    'Crunch forward, curling your spine.',
    'Return slowly.',
  ]),
  x('decline_crunch', 'Decline Crunch', 'reps', 'bodyweight', 'core_flex', ['rectus_abdominis'], ['obliques'], [
    'Lock your feet on a decline bench.',
    'Curl your shoulders up toward your hips.',
    'Lower slowly. Hold a plate to make it harder.',
  ]),
  x('ab_wheel', 'Ab Wheel Rollout', 'reps', 'bodyweight', 'core_brace', ['rectus_abdominis'], ['obliques', 'transverse_abdominis', ...LATS], [
    'Kneel holding the wheel under your shoulders.',
    'Roll out slowly, keeping your back flat.',
    'Pull back with your abs. Stop before your back sags.',
  ]),
  x('plank', 'Plank', 'time', 'bodyweight', 'core_brace', ['rectus_abdominis', 'transverse_abdominis'], ['obliques'], [
    'Set your forearms under your shoulders, body in one straight line.',
    'Squeeze your glutes and brace your abs.',
    'Hold for the target time without your hips sagging.',
  ]),
];
