// Researched swaps. Each alternative trains the same primary and secondary muscles with a similar
// movement pattern; "same" = same muscles and pattern, "close" = same main muscle, slightly
// different emphasis or pattern. Evidence for every pair is in src/data/exercise-sources.md.

import { EXERCISE_LIST, EXERCISES, loadsInjury } from './exercises';

export type SwapMatch = 'same' | 'close';
export type Swap = { id: string; match: SwapMatch; why: string };

const same = (id: string, why: string): Swap => ({ id, match: 'same', why });
const close = (id: string, why: string): Swap => ({ id, match: 'close', why });

export const SWAPS: Record<string, Swap[]> = {
  // ---------- Chest ----------
  flat_bench: [
    same('flat_db_press', 'Same horizontal press for chest, front delts and triceps; similar pec activation in EMG studies.'),
    same('machine_chest_press', 'Same pressing path on a fixed track; pec and triceps activity close to the bench.'),
    same('smith_bench', 'Bench press on a guided bar; pec activity is similar, less stabiliser demand.'),
    close('weighted_push_ups', 'Loaded push-ups match bench strength gains and pec activation at similar loads.'),
    close('db_floor_press', 'Same press, shorter range: stops at the floor, so a bit more triceps.'),
  ],
  flat_db_press: [
    same('flat_bench', 'Same horizontal press with a barbell; you can load it heavier.'),
    same('machine_chest_press', 'Same pressing path on a fixed track, easy to push close to failure.'),
    same('smith_bench', 'Guided bar, same muscles, no balancing needed.'),
    close('db_floor_press', 'Same dumbbell press with a shorter range; a little more triceps.'),
  ],
  incline_db_press: [
    same('incline_bb_press', 'Same incline angle and muscles: upper chest, front delts, triceps.'),
    same('incline_smith_press', 'Incline press on a guided bar; same upper-chest emphasis.'),
    same('incline_machine_press', 'Incline pressing path on a machine; upper chest and front delts.'),
    close('incline_cable_fly', 'Low-to-high fly hits the upper chest without the triceps.'),
  ],
  incline_bb_press: [
    same('incline_db_press', 'Same incline press with dumbbells; more range of motion.'),
    same('incline_smith_press', 'Same bar path, guided; upper chest and front delts.'),
    same('incline_machine_press', 'Incline machine press; same muscles on a fixed track.'),
    close('incline_cable_fly', 'Isolates the upper chest without triceps.'),
  ],
  machine_chest_press: [
    same('flat_db_press', 'Same horizontal press with free weights.'),
    same('flat_bench', 'Same press with a barbell; similar pec activation.'),
    same('smith_bench', 'Guided bar press; similar stability to a machine.'),
    close('weighted_push_ups', 'Bodyweight press with load; similar pec and triceps work.'),
  ],
  cable_fly: [
    same('pec_deck', 'Same fly arc on a machine; ACE found pec deck among the top chest moves.'),
    same('cable_crossover', 'Same cable fly from a high pulley; lower-chest bias.'),
    same('db_fly', 'Same fly motion with dumbbells; most tension at the stretch.'),
    close('incline_cable_fly', 'Low-to-high cable fly; same move with an upper-chest bias.'),
  ],
  cable_crossover: [
    same('cable_fly', 'Same cable fly from shoulder height.'),
    same('pec_deck', 'Same fly arc on a machine.'),
    same('db_fly', 'Same fly motion with dumbbells.'),
    close('chest_dips', 'Dips also bias the lower chest, with more triceps.'),
  ],
  pec_deck: [
    same('cable_fly', 'Same fly arc with cables; constant tension.'),
    same('cable_crossover', 'Same fly from a high pulley.'),
    same('db_fly', 'Same fly with dumbbells; more stretch, less tension at the top.'),
    close('incline_cable_fly', 'Same fly from low pulleys; upper-chest bias.'),
  ],
  push_ups: [
    same('weighted_push_ups', 'Same push-up with added load; progress when reps get high.'),
    same('machine_chest_press', 'Same horizontal press for chest and triceps, adjustable load.'),
    close('flat_db_press', 'Same pressing muscles with free weights.'),
    close('chest_dips', 'Bodyweight press; more lower chest and triceps.'),
  ],
  chest_dips: [
    same('weighted_push_ups', 'Bodyweight press for chest and triceps you can load.'),
    close('cable_crossover', 'High-to-low cable path also biases the lower chest.'),
    close('machine_chest_press', 'Same pressing muscles with less shoulder stretch.'),
    close('triceps_dips', 'Same bars, upright torso: more triceps, less chest.'),
  ],
  // ---------- Shoulders ----------
  db_shoulder_press: [
    same('machine_shoulder_press', 'Same vertical press on a fixed path; front delts and triceps.'),
    same('bb_ohp', 'Same overhead press with a barbell; heavier loading.'),
    same('arnold_press', 'Dumbbell press with a twist; same front and side delt work.'),
    same('smith_ohp', 'Overhead press on a guided bar.'),
  ],
  bb_ohp: [
    same('db_shoulder_press', 'Same vertical press with dumbbells; similar delt activation.'),
    same('machine_shoulder_press', 'Same press on a fixed path, less balance needed.'),
    same('smith_ohp', 'Guided bar overhead press.'),
    close('arnold_press', 'Dumbbell press with rotation; more front delt.'),
  ],
  arnold_press: [
    same('db_shoulder_press', 'Same dumbbell overhead press without the twist.'),
    same('machine_shoulder_press', 'Same vertical press on a machine.'),
    same('bb_ohp', 'Same overhead press with a barbell.'),
  ],
  lateral_raise: [
    same('cable_lateral_raise', 'Same side-delt raise; cable keeps tension at the bottom.'),
    same('seated_lateral_raise', 'Same raise seated; no body swing.'),
    close('cable_upright_row', 'Wide-grip upright row hits side delts and traps.'),
  ],
  front_raise: [
    same('cable_front_raise', 'Same front raise with constant cable tension.'),
    same('plate_front_raise', 'Same front raise holding a plate.'),
    close('db_shoulder_press', 'Front delts are the prime mover in overhead pressing.'),
  ],
  rear_raise: [
    same('rear_delt_fly', 'Same rear-delt fly on the reverse pec deck.'),
    same('cable_rear_delt_fly', 'Same rear-delt arc with cables.'),
    same('prone_rear_raise', 'Same raise lying on an incline bench; no lower-back strain.'),
    close('face_pull', 'Rear delts plus mid traps and rotator cuff.'),
  ],
  rear_delt_fly: [
    same('cable_rear_delt_fly', 'Same rear-delt fly with cables.'),
    same('rear_raise', 'Same rear-delt raise with dumbbells, bent over.'),
    same('prone_rear_raise', 'Chest-supported rear raise; same muscles.'),
    close('face_pull', 'Rear delts plus mid traps and rotator cuff.'),
  ],
  face_pull: [
    same('cable_rear_delt_fly', 'Rear delts and mid traps with cables.'),
    same('rear_delt_fly', 'Rear delts on the reverse pec deck.'),
    close('prone_rear_raise', 'Rear delt raise; less rotator cuff work.'),
    close('rear_raise', 'Bent-over rear raise with dumbbells.'),
  ],
  // ---------- Back ----------
  lat_pulldown: [
    same('pull_ups', 'Same vertical pull; lats and biceps activity similar to the pulldown.'),
    same('wide_pulldown', 'Same pulldown with a wider grip.'),
    same('vbar_pulldown', 'Same pulldown with a close neutral grip; similar lat activation.'),
    same('assisted_pull_ups', 'Pull-up with band help when bodyweight reps are too hard.'),
    close('single_arm_pulldown', 'One arm at a time; more range for each lat.'),
  ],
  wide_pulldown: [
    same('lat_pulldown', 'Same pulldown with a shoulder-width grip.'),
    same('pull_ups', 'Same vertical pull with your bodyweight.'),
    same('vbar_pulldown', 'Close-grip pulldown; lats work about the same.'),
    same('assisted_pull_ups', 'Pull-up with band help.'),
  ],
  pull_ups: [
    same('lat_pulldown', 'Same vertical pull on a cable; load is adjustable.'),
    same('assisted_pull_ups', 'Same pull-up with a band taking some bodyweight.'),
    same('chin_ups', 'Underhand pull-up; similar lats, more biceps.'),
    same('wide_pulldown', 'Wide-grip pulldown; same muscles.'),
  ],
  seated_cable_row: [
    same('machine_row', 'Same seated horizontal row on a machine.'),
    same('chest_supported_row', 'Same row with your chest on a bench; no lower-back load.'),
    same('single_arm_cable_row', 'Same cable row one arm at a time.'),
    close('bb_bent_row', 'Free-weight row; more lower-back work.'),
    close('inverted_row', 'Bodyweight horizontal row.'),
  ],
  single_arm_db_row: [
    same('single_arm_cable_row', 'Same one-arm row with a cable.'),
    same('chest_supported_row', 'Same dumbbell row, both arms, chest supported.'),
    same('seated_cable_row', 'Same horizontal row on a cable.'),
    close('bb_bent_row', 'Two-arm barbell row; more lower-back work.'),
  ],
  bb_bent_row: [
    same('db_bent_row', 'Same bent-over row with dumbbells.'),
    same('tbar_row', 'Same hinged row on a T-bar; similar back activation.'),
    same('chest_supported_row', 'Same row with your chest supported; lower back rests.'),
    same('seated_cable_row', 'Same horizontal row seated on a cable.'),
  ],
  db_bent_row: [
    same('bb_bent_row', 'Same bent-over row with a barbell.'),
    same('chest_supported_row', 'Same dumbbell row, chest supported.'),
    same('tbar_row', 'Hinged row on a T-bar.'),
    same('seated_cable_row', 'Same horizontal row on a cable.'),
  ],
  straight_arm_pulldown: [
    same('rope_straight_arm', 'Same move with a rope; a bit more range at the bottom.'),
    same('db_pullover', 'Same shoulder-extension pattern for the lats with a dumbbell.'),
    close('lat_pulldown', 'Vertical pull for the lats; adds biceps.'),
  ],
  db_pullover: [
    same('straight_arm_pulldown', 'Same lat-dominant shoulder extension on a cable.'),
    same('rope_straight_arm', 'Same pattern with a rope on a cable.'),
    close('lat_pulldown', 'Vertical pull for the lats; adds biceps.'),
  ],
  db_shrug: [
    same('bb_shrug', 'Same shrug with a barbell; heavier loading.'),
    same('cable_shrug', 'Same shrug on a cable.'),
    close('farmers_walk', 'Heavy carry works the upper traps and grip.'),
  ],
  deadlift: [
    same('trap_bar_deadlift', 'Same hip-and-knee pull; slightly more quads, less lower back.'),
    close('rdl', 'Hip hinge with less knee bend; more hamstrings.'),
    close('db_rdl', 'Dumbbell hinge; hamstrings and glutes.'),
    close('back_extension', 'Lower back and glutes, no spinal loading from a bar.'),
  ],
  // ---------- Arms ----------
  triceps_pushdown: [
    same('rope_pushdown', 'Same pushdown with a rope; ACE ranked pushdowns near the top for triceps.'),
    same('vbar_pushdown', 'Same pushdown with a V-bar.'),
    same('db_kickback', 'Same elbow extension with arms at your sides; ACE found kickbacks among the best.'),
    close('triceps_dips', 'Bodyweight triceps press; ranked highly by ACE.'),
  ],
  rope_pushdown: [
    same('triceps_pushdown', 'Same pushdown with a straight bar.'),
    same('vbar_pushdown', 'Same pushdown with a V-bar.'),
    same('db_kickback', 'Same elbow extension with dumbbells.'),
    close('triceps_dips', 'Bodyweight triceps press.'),
  ],
  overhead_db_ext: [
    same('cable_overhead_ext', 'Same overhead extension; stretches the long head (Maeo 2022).'),
    same('skull_crusher', 'Lying extension; long head works at a long length.'),
    close('triceps_pushdown', 'Arms-at-side extension; less long-head stretch.'),
  ],
  skull_crusher: [
    same('overhead_db_ext', 'Overhead extension; same long-head stretch.'),
    same('cable_overhead_ext', 'Overhead extension on a cable.'),
    close('close_grip_bench', 'Compound triceps press; adds chest.'),
    close('triceps_pushdown', 'Elbow extension with arms at your sides.'),
  ],
  close_grip_bench: [
    same('triceps_dips', 'Compound triceps press with bodyweight.'),
    close('skull_crusher', 'Isolates all three triceps heads.'),
    close('db_floor_press', 'Press that stops at the floor; triceps-heavy lockout.'),
    close('weighted_push_ups', 'Narrow-hand push-ups load triceps and chest.'),
  ],
  incline_db_curl: [
    same('db_curl', 'Same supinated curl standing; biceps primary.'),
    same('cable_curl', 'Same curl with constant cable tension.'),
    same('preacher_curl', 'Same biceps curl, upper arm fixed.'),
    close('concentration_curl', 'Top-rated biceps move in the ACE study.'),
  ],
  ez_curl: [
    same('bb_curl', 'Same two-handed curl with a straight bar.'),
    same('cable_curl', 'Same curl on a cable.'),
    same('db_curl', 'Same curl with dumbbells.'),
    same('preacher_curl', 'EZ curl on a preacher bench.'),
    close('machine_curl', 'Biceps curl on a machine.'),
  ],
  bb_curl: [
    same('ez_curl', 'Same curl; angled grip is easier on the wrists.'),
    same('cable_curl', 'Same curl on a cable.'),
    same('db_curl', 'Same curl with dumbbells.'),
    close('preacher_curl', 'Curl with the upper arm fixed.'),
  ],
  concentration_curl: [
    same('preacher_curl', 'Upper arm braced, same strict biceps curl.'),
    same('machine_curl', 'Strict curl on a machine.'),
    same('db_curl', 'Same supinated dumbbell curl.'),
    close('cable_curl', 'Curl with constant cable tension.'),
  ],
  hammer_curl: [
    same('rope_hammer_curl', 'Same neutral-grip curl with a rope.'),
    same('cross_body_hammer', 'Same neutral grip, across the body.'),
    close('bb_reverse_curl', 'Overhand curl; brachioradialis and forearm extensors.'),
    close('reverse_cable_curl', 'Overhand curl on a cable.'),
  ],
  bb_reverse_curl: [
    same('reverse_cable_curl', 'Same overhand curl on a cable.'),
    close('hammer_curl', 'Neutral-grip curl; brachioradialis and brachialis.'),
    close('rope_hammer_curl', 'Neutral-grip curl with a rope.'),
  ],
  wrist_curl: [
    same('db_wrist_curl', 'Same wrist flexion with dumbbells.'),
    same('cable_wrist_curl', 'Same wrist flexion on a cable.'),
    close('wrist_roller', 'Rolls through flexion and extension.'),
  ],
  reverse_wrist_curl: [
    same('db_reverse_wrist_curl', 'Same wrist extension with dumbbells.'),
    close('wrist_roller', 'Rolls through extension and flexion.'),
    close('bb_reverse_curl', 'Overhand curl; forearm extensors work hard.'),
  ],
  farmers_walk: [
    same('trap_bar_carry', 'Same loaded carry holding a trap bar.'),
    same('db_hold', 'Same grip and trap work without walking.'),
    close('db_shrug', 'Upper traps and grip under heavy load.'),
  ],
  // ---------- Legs ----------
  back_squat: [
    same('front_squat', 'Same squat; similar quad and glute activity, less load on the lower back.'),
    same('hack_squat', 'Machine squat; quads and glutes with a fixed path.'),
    same('leg_press', 'Same knee and hip extension, no spinal load.'),
    same('smith_squat', 'Squat on a guided bar.'),
    close('goblet_squat', 'Dumbbell squat; lighter, good for learning depth.'),
  ],
  front_squat: [
    same('back_squat', 'Same squat with the bar on your back.'),
    same('hack_squat', 'Upright machine squat; quad-focused.'),
    same('goblet_squat', 'Front-loaded squat with a dumbbell.'),
    close('leg_press', 'Quads and glutes, no spinal load.'),
  ],
  leg_press: [
    same('hack_squat', 'Machine squat; same quads and glutes.'),
    same('back_squat', 'Free-weight squat; same muscles plus core.'),
    same('smith_squat', 'Guided squat; same muscles.'),
    close('bulgarian_split_squat', 'Single-leg squat; quads and glutes one side at a time.'),
  ],
  bulgarian_split_squat: [
    same('db_lunge', 'Same split-stance pattern; quads and glutes.'),
    same('reverse_lunge', 'Stepping back; slightly more glutes.'),
    same('step_up', 'Single-leg knee and hip extension.'),
    close('leg_press', 'Bilateral; same quads and glutes.'),
  ],
  leg_extension: [
    same('sissy_squat', 'Knee extension with bodyweight; quads only.'),
    close('hack_squat', 'Quad-dominant machine squat.'),
    close('front_squat', 'Quad-dominant free-weight squat.'),
    close('bulgarian_split_squat', 'Single-leg; quads with glutes.'),
  ],
  rdl: [
    same('db_rdl', 'Same hip hinge with dumbbells.'),
    same('good_morning', 'Hip hinge with the bar on your back; hamstrings and lower back.'),
    close('back_extension', 'Hinge on a 45° bench; lower back and glutes.'),
    close('cable_pull_through', 'Cable hinge; glute-biased.'),
  ],
  lying_leg_curl: [
    same('seated_leg_curl', 'Same knee flexion; seated grows the hamstrings a bit more (Maeo 2021).'),
    same('standing_leg_curl', 'Same knee flexion one leg at a time.'),
    same('ball_leg_curl', 'Knee flexion with bodyweight on a ball.'),
    close('glute_ham_raise', 'Bodyweight knee flexion; hard.'),
  ],
  seated_leg_curl: [
    same('lying_leg_curl', 'Same knee flexion lying down.'),
    same('standing_leg_curl', 'Same knee flexion standing.'),
    same('ball_leg_curl', 'Knee flexion with bodyweight.'),
    close('rdl', 'Hamstrings via the hip, not the knee.'),
  ],
  hip_thrust: [
    same('glute_bridge', 'Same hip extension from the floor; similar glute activation.'),
    same('single_leg_bridge', 'Same bridge one leg at a time, bodyweight.'),
    close('cable_pull_through', 'Glute-dominant hip extension, standing.'),
    close('back_squat', 'Squats grew the glutes about as much as hip thrusts in a 9-week trial (Plotkin 2023).'),
  ],
  standing_calf_raise: [
    same('leg_press_calf_raise', 'Same straight-knee calf raise; gastrocnemius-focused.'),
    same('smith_calf_raise', 'Same straight-knee raise on a Smith machine.'),
    same('db_calf_raise', 'Single-leg standing raise with a dumbbell.'),
    close('seated_calf_raise', 'Bent knee shifts the work to the soleus.'),
  ],
  seated_calf_raise: [
    close('standing_calf_raise', 'Straight knee; more gastrocnemius.'),
    close('leg_press_calf_raise', 'Straight knee calf raise on the leg press.'),
    close('db_calf_raise', 'Standing single-leg raise.'),
  ],
  // ---------- Abs ----------
  hanging_leg_raise: [
    same('captains_chair', 'Same knee raise supported on your forearms.'),
    same('reverse_crunch', 'Same pelvis curl on the floor.'),
    same('lying_leg_raise', 'Same leg raise lying on a bench.'),
    close('ab_wheel', 'Top-rated rectus abdominis move in EMG studies.'),
  ],
  cable_crunch: [
    same('machine_crunch', 'Same loaded spinal flexion on a machine.'),
    same('decline_crunch', 'Same crunch on a decline bench.'),
    close('reverse_crunch', 'Abs flex from the bottom up.'),
    close('ab_wheel', 'High rectus abdominis activity.'),
  ],
  plank: [
    same('ab_wheel', 'Anti-extension like the plank; much harder.'),
    close('reverse_crunch', 'Rectus abdominis through a range of motion.'),
    close('captains_chair', 'Rectus abdominis and hip flexors.'),
  ],
};

/**
 * Swaps for an exercise. Uses the researched list when there is one; otherwise falls back to
 * exercises with the same movement pattern and the same main muscle, labelled "close".
 * With injury mode on, anything that loads the legs or abs is left out.
 */
export function swapsFor(id: string, injured: boolean): Swap[] {
  const ex = EXERCISES[id];
  if (!ex) return [];
  const list =
    SWAPS[id] ??
    EXERCISE_LIST.filter((o) => o.id !== id && o.pattern === ex.pattern && o.primary.some((m) => ex.primary.includes(m)))
      .slice(0, 4)
      .map((o) => close(o.id, 'Same movement pattern and main muscle.'));
  return list.filter((s) => EXERCISES[s.id] && !(injured && loadsInjury(s.id)));
}
