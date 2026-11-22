#!/usr/bin/env python3
"""Download how-to images (start/end) from free-exercise-db (yuhonas/free-exercise-db, Unlicense /
public domain), downscale them and write src/data/exercise-images.ts.

Only free-exercise-db is used. Exercises without a matching entry are left out and listed in
src/data/exercise-sources.md under "Missing images".

Run from the repo root:  python3 -I scripts/fetch-exercise-images.py
"""
import io, os, sys, urllib.request
from PIL import Image

BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

# app exercise id -> free-exercise-db id
FEDB = {
    'flat_bench': 'Barbell_Bench_Press_-_Medium_Grip',
    'incline_db_press': 'Incline_Dumbbell_Press',
    'incline_bb_press': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    'machine_chest_press': 'Machine_Bench_Press',
    'flat_db_press': 'Dumbbell_Bench_Press',
    'cable_crossover': 'Cable_Crossover',
    'pec_deck': 'Butterfly',
    'push_ups': 'Pushups',
    'db_shoulder_press': 'Dumbbell_Shoulder_Press',
    'lateral_raise': 'Side_Lateral_Raise',
    'front_raise': 'Front_Dumbbell_Raise',
    'rear_raise': 'Seated_Bent-Over_Rear_Delt_Raise',
    'rear_delt_fly': 'Reverse_Machine_Flyes',
    'lat_pulldown': 'Full_Range-Of-Motion_Lat_Pulldown',
    'wide_pulldown': 'Wide-Grip_Lat_Pulldown',
    'pull_ups': 'Pullups',
    'seated_cable_row': 'Seated_Cable_Rows',
    'single_arm_db_row': 'One-Arm_Dumbbell_Row',
    'bb_bent_row': 'Bent_Over_Barbell_Row',
    'db_bent_row': 'Bent_Over_Two-Dumbbell_Row',
    'straight_arm_pulldown': 'Straight-Arm_Pulldown',
    'db_shrug': 'Dumbbell_Shrug',
    'triceps_pushdown': 'Triceps_Pushdown',
    'rope_pushdown': 'Triceps_Pushdown_-_Rope_Attachment',
    'overhead_db_ext': 'Standing_Dumbbell_Triceps_Extension',
    'close_grip_bench': 'Close-Grip_Barbell_Bench_Press',
    'incline_db_curl': 'Incline_Dumbbell_Curl',
    'ez_curl': 'EZ-Bar_Curl',
    'hammer_curl': 'Hammer_Curls',
    'concentration_curl': 'Concentration_Curls',
    'wrist_curl': 'Seated_Palm-Up_Barbell_Wrist_Curl',
    'reverse_wrist_curl': 'Seated_Palms-Down_Barbell_Wrist_Curl',
    'bb_reverse_curl': 'Reverse_Barbell_Curl',
    'farmers_walk': 'Farmers_Walk',
    'smith_bench': 'Smith_Machine_Bench_Press',
    'weighted_push_ups': 'Pushups',
    'db_floor_press': 'Dumbbell_Floor_Press',
    'incline_smith_press': 'Smith_Machine_Incline_Bench_Press',
    'incline_machine_press': 'Leverage_Incline_Chest_Press',
    'db_fly': 'Dumbbell_Flyes',
    'incline_cable_fly': 'Incline_Cable_Flye',
    'chest_dips': 'Dips_-_Chest_Version',
    'bb_ohp': 'Standing_Military_Press',
    'machine_shoulder_press': 'Machine_Shoulder_Military_Press',
    'arnold_press': 'Arnold_Dumbbell_Press',
    'smith_ohp': 'Smith_Machine_Overhead_Shoulder_Press',
    'cable_lateral_raise': 'Standing_Low-Pulley_Deltoid_Raise',
    'seated_lateral_raise': 'Seated_Side_Lateral_Raise',
    'cable_upright_row': 'Upright_Cable_Row',
    'cable_front_raise': 'Front_Cable_Raise',
    'plate_front_raise': 'Front_Plate_Raise',
    'face_pull': 'Face_Pull',
    'cable_rear_delt_fly': 'Cable_Rear_Delt_Fly',
    'prone_rear_raise': 'Dumbbell_Lying_Rear_Lateral_Raise',
    'chin_ups': 'Chin-Up',
    'assisted_pull_ups': 'Band_Assisted_Pull-Up',
    'vbar_pulldown': 'V-Bar_Pulldown',
    'single_arm_pulldown': 'One_Arm_Lat_Pulldown',
    'chest_supported_row': 'Dumbbell_Incline_Row',
    'tbar_row': 'T-Bar_Row_with_Handle',
    'machine_row': 'Leverage_Iso_Row',
    'single_arm_cable_row': 'Seated_One-arm_Cable_Pulley_Rows',
    'inverted_row': 'Inverted_Row',
    'db_pullover': 'Straight-Arm_Dumbbell_Pullover',
    'rope_straight_arm': 'Rope_Straight-Arm_Pulldown',
    'bb_shrug': 'Barbell_Shrug',
    'cable_shrug': 'Cable_Shrugs',
    'deadlift': 'Barbell_Deadlift',
    'trap_bar_deadlift': 'Trap_Bar_Deadlift',
    'back_extension': 'Hyperextensions_Back_Extensions',
    'skull_crusher': 'EZ-Bar_Skullcrusher',
    'cable_overhead_ext': 'Cable_Rope_Overhead_Triceps_Extension',
    'triceps_dips': 'Dips_-_Triceps_Version',
    'vbar_pushdown': 'Triceps_Pushdown_-_V-Bar_Attachment',
    'db_kickback': 'Tricep_Dumbbell_Kickback',
    'bb_curl': 'Barbell_Curl',
    'db_curl': 'Dumbbell_Bicep_Curl',
    'cable_curl': 'Standing_Biceps_Cable_Curl',
    'preacher_curl': 'Preacher_Curl',
    'machine_curl': 'Machine_Bicep_Curl',
    'rope_hammer_curl': 'Cable_Hammer_Curls_-_Rope_Attachment',
    'cross_body_hammer': 'Cross_Body_Hammer_Curl',
    'reverse_cable_curl': 'Reverse_Cable_Curl',
    'db_wrist_curl': 'Seated_Dumbbell_Palms-Up_Wrist_Curl',
    'cable_wrist_curl': 'Cable_Wrist_Curl',
    'db_reverse_wrist_curl': 'Seated_Dumbbell_Palms-Down_Wrist_Curl',
    'wrist_roller': 'Wrist_Roller',
    'trap_bar_carry': 'Rickshaw_Carry',
    'back_squat': 'Barbell_Full_Squat',
    'front_squat': 'Front_Barbell_Squat',
    'goblet_squat': 'Goblet_Squat',
    'leg_press': 'Leg_Press',
    'hack_squat': 'Hack_Squat',
    'smith_squat': 'Smith_Machine_Squat',
    'bulgarian_split_squat': 'Split_Squat_with_Dumbbells',
    'db_lunge': 'Dumbbell_Lunges',
    'reverse_lunge': 'Dumbbell_Rear_Lunge',
    'step_up': 'Dumbbell_Step_Ups',
    'leg_extension': 'Leg_Extensions',
    'sissy_squat': 'Weighted_Sissy_Squat',
    'rdl': 'Romanian_Deadlift',
    'db_rdl': 'Stiff-Legged_Dumbbell_Deadlift',
    'good_morning': 'Good_Morning',
    'cable_pull_through': 'Pull_Through',
    'lying_leg_curl': 'Lying_Leg_Curls',
    'seated_leg_curl': 'Seated_Leg_Curl',
    'standing_leg_curl': 'Standing_Leg_Curl',
    'ball_leg_curl': 'Ball_Leg_Curl',
    'glute_ham_raise': 'Glute_Ham_Raise',
    'hip_thrust': 'Barbell_Hip_Thrust',
    'glute_bridge': 'Barbell_Glute_Bridge',
    'single_leg_bridge': 'Single_Leg_Glute_Bridge',
    'standing_calf_raise': 'Standing_Calf_Raises',
    'seated_calf_raise': 'Seated_Calf_Raise',
    'leg_press_calf_raise': 'Calf_Press_On_The_Leg_Press_Machine',
    'smith_calf_raise': 'Smith_Machine_Calf_Raise',
    'db_calf_raise': 'Standing_Dumbbell_Calf_Raise',
    'hanging_leg_raise': 'Hanging_Leg_Raise',
    'captains_chair': 'Knee_Hip_Raise_On_Parallel_Bars',
    'reverse_crunch': 'Reverse_Crunch',
    'lying_leg_raise': 'Flat_Bench_Lying_Leg_Raise',
    'cable_crunch': 'Cable_Crunch',
    'machine_crunch': 'Ab_Crunch_Machine',
    'decline_crunch': 'Decline_Crunch',
    'ab_wheel': 'Ab_Roller',
    'plank': 'Plank',
}

def main():
    out_dir = 'assets/exercises'
    os.makedirs(out_dir, exist_ok=True)
    ok = {}
    for app_id, fid in FEDB.items():
        files = []
        for i in (0, 1):
            dst = f'{out_dir}/{app_id}-{i}.jpg'
            if not os.path.exists(dst):
                try:
                    raw = urllib.request.urlopen(f'{BASE}{fid}/{i}.jpg', timeout=30).read()
                except Exception as e:
                    print('missing', app_id, fid, i, e, file=sys.stderr)
                    break
                im = Image.open(io.BytesIO(raw)).convert('RGB')
                w = 360
                im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
                im.save(dst, 'JPEG', quality=72, optimize=True, progressive=True)
            files.append(dst)
        if len(files) == 2:
            ok[app_id] = fid
    lines = [
        '// Generated by scripts/fetch-exercise-images.py. Do not edit by hand.',
        '// Images: free-exercise-db (github.com/yuhonas/free-exercise-db), released under the Unlicense (public domain).',
        '',
        'export type HowToImages = { start: number; end: number; source: string };',
        '',
        'export const EXERCISE_IMAGES: Record<string, HowToImages> = {',
    ]
    for app_id, fid in ok.items():
        lines.append(f"  {app_id}: {{ start: require('../../assets/exercises/{app_id}-0.jpg'), end: require('../../assets/exercises/{app_id}-1.jpg'), source: '{fid}' }},")
    lines.append('};')
    open('src/data/exercise-images.ts', 'w').write('\n'.join(lines) + '\n')
    print(len(ok), 'exercises with images')

main()
