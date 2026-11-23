"""Write render/poses/<id>.json for every exercise from a handful of movement templates.

  python3 render/poses/generate.py        # skips the hand-tuned files listed in HAND_TUNED

Conventions (same as render.py): Z up, the figure faces -Y, its left is +X. A pose names bone
directions for a simple skeleton (pelvis, spine, chest, neck, head, clav_L, upper_L, fore_L,
hand_L, thigh_L, shin_L, foot_L); _R bones mirror _L unless given. `hips` places the pelvis
joint (standing ~0.056 means feet on the floor at about -0.82; the floor follows the feet).
Equipment positions can use anchors on the posed body: "@grip", "@grip_L", "@ankles", "@hips"...
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
HAND_TUNED = {'incline_db_press', 'lat_pulldown', 'lateral_raise', 'flat_bench', 'seated_cable_row'}

# ---------- Building blocks ----------
UPRIGHT = {'pelvis': [0, 0.02, 1], 'spine': [0, 0.02, 1], 'chest': [0, 0, 1], 'neck': [0, -0.03, 1], 'head': [0, -0.03, 1]}
LEAN = {'pelvis': [0, -0.12, 1], 'spine': [0, -0.15, 1], 'chest': [0, -0.15, 1], 'neck': [0, -0.15, 1], 'head': [0, -0.1, 1]}
HINGE = {'pelvis': [0, -0.7, 0.72], 'spine': [0, -0.75, 0.66], 'chest': [0, -0.78, 0.62], 'neck': [0, -0.85, 0.5], 'head': [0, -0.9, 0.38]}
HALF_HINGE = {'pelvis': [0, -0.35, 0.94], 'spine': [0, -0.4, 0.92], 'chest': [0, -0.42, 0.9], 'neck': [0, -0.45, 0.89], 'head': [0, -0.4, 0.9]}
SUPINE = {'pelvis': [0, 1, 0.02], 'spine': [0, 1, 0.02], 'chest': [0, 1, 0.02], 'neck': [0, 1, 0.12], 'head': [0, 1, 0.05]}
PRONE = {'pelvis': [0, -1, 0.03], 'spine': [0, -1, 0.03], 'chest': [0, -1, 0.03], 'neck': [0, -1, 0.2], 'head': [0, -1, 0.25]}

STAND = {'thigh_L': [0.05, 0, -1], 'shin_L': [0.04, 0.03, -1], 'foot_L': [0.08, -1, -0.35]}
SOFT_KNEE = {'thigh_L': [0.06, -0.2, -1], 'shin_L': [0.04, 0.15, -1], 'foot_L': [0.08, -1, -0.35]}
SEATED = {'thigh_L': [0.2, -1, -0.05], 'shin_L': [0.05, -0.1, -1], 'foot_L': [0.08, -1, -0.3]}
BENCH_FEET = {'thigh_L': [0.22, -1, -0.35], 'shin_L': [0.05, -0.12, -1], 'foot_L': [0.05, -1, -0.2]}
PRONE_LEGS = {'thigh_L': [0.06, 1, -0.03], 'shin_L': [0.04, 1, -0.03], 'foot_L': [0.02, 0.3, -1]}
KNEEL = {'thigh_L': [0.08, 0, -1], 'shin_L': [0.04, 1, -0.05], 'foot_L': [0.02, 0.6, -0.8]}

ARMS_DOWN = {'upper_L': [0.12, 0, -1], 'fore_L': [0.1, -0.05, -1], 'hand_L': [0.1, -0.05, -1]}
HANG_ARMS = {'upper_L': [0.12, -0.05, -1], 'fore_L': [0.06, -0.05, -1], 'hand_L': [0.06, -0.05, -1]}

CAM_FRONT = {'azimuth': 30, 'elevation': 10, 'distance': 3.4, 'lens': 50}
CAM_SIDE = {'azimuth': 80, 'elevation': 10, 'distance': 3.4, 'lens': 50}
CAM_SEATED = {'azimuth': 35, 'elevation': 14, 'distance': 3.0, 'lens': 50}
CAM_LYING = {'azimuth': 62, 'elevation': 22, 'distance': 3.0, 'lens': 50}
CAM_BACK = {'azimuth': 150, 'elevation': 12, 'distance': 3.4, 'lens': 50}
# Hinge lifts: side view from above, so the plates sit below the torso instead of covering it.
CAM_HINGE = {'azimuth': 90, 'elevation': 30, 'distance': 3.5, 'lens': 50}
# Side view from slightly behind, so a cable tower in front of the lifter never hides them.
CAM_CABLE = {'azimuth': 112, 'elevation': 10, 'distance': 3.4, 'lens': 50}

STAND_HIPS = [0, 0, 0.056]
SEAT_HIPS = [0, 0, 0.55]


def arms(upper, fore, hand=None):
    return {'upper_L': upper, 'fore_L': fore, 'hand_L': hand or fore}


def spec(setup='standing', base=None, start=None, end=None, cam=None, props=None, equipment=None, hips=None, **kw):
    # Copy every template so later tweaks to one exercise never leak into the shared building blocks.
    base, start, end = dict(base or {}), dict(start or {}), dict(end or {})
    d = {'setup': setup, 'base': base, 'frames': {'start': start, 'end': end},
         'camera': cam or CAM_FRONT, 'hips': hips or STAND_HIPS}
    if props:
        d['props'] = props
    if equipment:
        d['equipment'] = equipment
    d.update(kw)
    return d


def standing(start, end, props=None, torso=UPRIGHT, legs=STAND, cam=None, equipment=None):
    return spec(base={**torso, **legs}, start=start, end=end, props=props, cam=cam, equipment=equipment)


def seated(start, end, props=None, torso=UPRIGHT, cam=None, back=True, equipment=None):
    eq = [{'type': 'seat', 'back': back}] + (equipment or [])
    return spec(base={**torso, **SEATED}, start=start, end=end, props=props, cam=cam or CAM_SEATED, equipment=eq, hips=SEAT_HIPS)


def lying(start, end, props=None, uprights=False, cam=None, equipment=None):
    eq = [{'type': 'bench', 'top_z': 0.45, 'y0': -0.4, 'y1': 0.85}] + (equipment or [])
    if uprights:
        eq.append({'type': 'line', 'from': [0.5, 0.67, 0.0], 'to': [0.5, 0.67, 1.0]})
        eq.append({'type': 'line', 'from': [-0.5, 0.67, 0.0], 'to': [-0.5, 0.67, 1.0]})
    return spec(base={**SUPINE, **BENCH_FEET}, start=start, end=end, props=props, cam=cam or CAM_LYING, equipment=eq, hips=[0, -0.12, 0.56])


def incline(start, end, props=None, deg=38, equipment=None):
    torso = {'pelvis': [0, 0.62, 0.78], 'spine': [0, 0.62, 0.78], 'chest': [0, 0.6, 0.8], 'neck': [0, 0.45, 0.89], 'head': [0, 0.35, 0.94]}
    legs = {'thigh_L': [0.28, -1, -0.12], 'shin_L': [0.08, -0.12, -1], 'foot_L': [0.1, -1, -0.3]}
    eq = [{'type': 'incline', 'seat_z': 0.44, 'seat_y': 0.02, 'back_deg': deg}] + (equipment or [])
    return spec(base={**torso, **legs}, start=start, end=end, props=props, cam={'azimuth': 28, 'elevation': 22, 'distance': 2.8, 'lens': 50},
                equipment=eq, hips=[0, 0.0, 0.55])


def cable_from(x, y, z, handle='bar', to='@grip'):
    return {'type': 'cable', 'from': [x, y, z], 'to': to, 'handle': handle}


# ---------- Arm motions (L side) ----------
CURL_S = arms([0.08, 0.02, -1], [0.08, -0.08, -1])
CURL_E = arms([0.08, -0.12, -1], [0.04, -0.45, 0.9])
PRESS_OH_S = {'clav_L': [1, 0.05, -0.05], **arms([0.9, 0.1, -0.3], [0.02, 0.02, 1])}
PRESS_OH_E = {'clav_L': [1, 0, 0.15], **arms([0.25, 0, 1], [0.06, 0, 1])}
CHEST_PRESS_S = arms([0.85, 0.45, -0.15], [0.02, -1, 0.05])
CHEST_PRESS_E = arms([0.32, -1, -0.05], [0.04, -1, 0])
BENCH_S = {'clav_L': [1, 0.05, -0.1], **arms([0.85, -0.05, -0.45], [0.02, 0, 1])}
BENCH_E = {'clav_L': [1, 0, 0.05], **arms([0.22, 0.04, 1], [0.06, 0, 1])}
FLY_S = arms([1, 0.15, 0.05], [1, -0.2, 0.05])
FLY_E = arms([0.35, -1, -0.1], [0.05, -1, -0.05])
LYING_FLY_S = arms([1, 0.05, -0.2], [1, 0, 0.1])
LYING_FLY_E = arms([0.15, 0, 1], [0.05, 0, 1])
ROW_HINGE_S = HANG_ARMS
ROW_HINGE_E = arms([0.15, 0.8, -0.55], [0.05, -0.1, -1])
PUSHDOWN_S = arms([0.06, 0.08, -1], [0.04, -0.85, 0.5])
PUSHDOWN_E = arms([0.06, 0.05, -1], [0.04, -0.05, -1])
OH_EXT_S = arms([0.12, 0.15, 1], [0.02, 0.35, -0.95])
OH_EXT_E = arms([0.12, 0.1, 1], [0.04, 0.02, 1])
LAT_RAISE_S = arms([0.18, -0.12, -1], [0.16, -0.3, -1])
LAT_RAISE_E = {'clav_L': [1, 0.02, 0.22], **arms([1, -0.18, -0.02], [1, -0.32, 0.06])}
FRONT_RAISE_S = arms([0.1, -0.15, -1], [0.08, -0.2, -1])
FRONT_RAISE_E = arms([0.15, -1, 0.05], [0.12, -1, 0.08])
REAR_S = arms([0.1, -0.15, -1], [0.08, -0.2, -1])
REAR_E = arms([1, 0.1, -0.15], [1, -0.05, -0.15])
PULLUP_S = {'clav_L': [1, 0.05, 0.35], **arms([0.42, -0.02, 1], [0.3, -0.02, 1])}
PULLUP_E = {'clav_L': [1, 0.12, 0], **arms([0.6, 0.15, -0.8], [0.0, -0.25, 1])}
STRAIGHT_S = arms([0.12, -0.75, 0.65], [0.1, -0.8, 0.6])
STRAIGHT_E = arms([0.12, 0.1, -1], [0.1, 0.05, -1])
SHRUG_S = {'clav_L': [1, 0, -0.08], **ARMS_DOWN}
SHRUG_E = {'clav_L': [1, 0, 0.35], **ARMS_DOWN}
UPRIGHT_E = {'clav_L': [1, 0, 0.2], **arms([0.95, -0.15, 0.2], [-0.55, -0.35, -0.75])}
FACE_PULL_S = arms([0.12, -1, 0.15], [0.08, -1, 0.15])
FACE_PULL_E = arms([0.95, 0.15, 0.1], [-0.25, -0.3, 0.92])
KICKBACK_S = arms([0.1, 0.9, -0.3], [0.05, 0.1, -1])
KICKBACK_E = arms([0.1, 0.95, 0.1], [0.08, 1, 0.1])

# ---------- Leg motions ----------
SQUAT_DOWN = {'thigh_L': [0.25, -1, -0.12], 'shin_L': [0.08, 0.4, -0.92], 'foot_L': [0.1, -1, -0.35]}
SQUAT_TORSO = {'pelvis': [0, -0.45, 0.9], 'spine': [0, -0.45, 0.9], 'chest': [0, -0.4, 0.92], 'neck': [0, -0.3, 0.95], 'head': [0, -0.2, 1]}
BACK_BAR = {'clav_L': [1, 0.1, 0.05], **arms([0.75, 0.45, -0.2], [-0.1, 0.25, 1])}
FRONT_BAR = arms([0.25, -1, 0.1], [-0.3, 0.9, 0.25])


def squat(props=None, arms_pose=None, equipment=None, cam=None):
    a = arms_pose or {}
    return spec(base={**a}, start={**UPRIGHT, **STAND, 'hips': STAND_HIPS}, end={**SQUAT_TORSO, **SQUAT_DOWN, 'hips': [0, 0.12, -0.34]},
                props=props, equipment=equipment, cam=cam or {'azimuth': 55, 'elevation': 10, 'distance': 3.4, 'lens': 50})


LUNGE_S = {'thigh_L': [0.08, -0.25, -1], 'shin_L': [0.05, 0.05, -1], 'thigh_R': [-0.08, 0.3, -1], 'shin_R': [-0.04, 0.6, -0.8], 'foot_R': [-0.05, -0.6, -0.8]}
LUNGE_E = {'thigh_L': [0.08, -1, -0.1], 'shin_L': [0.05, 0.1, -1], 'thigh_R': [-0.06, 0.1, -1], 'shin_R': [-0.04, 1, -0.15], 'foot_R': [-0.05, -0.5, -0.85]}


def hinge(props='barbell', down_arms=None, equipment=None, deadlift=False):
    bottom = {**HINGE, **(SQUAT_DOWN if deadlift else SOFT_KNEE), **(down_arms or HANG_ARMS)}
    if deadlift:
        bottom.update({'thigh_L': [0.12, -0.75, -0.65], 'shin_L': [0.06, 0.25, -0.97]})
    top = {**UPRIGHT, **STAND, **ARMS_DOWN}
    s, e = (bottom, top) if deadlift else (top, bottom)
    s = dict(s)
    e = dict(e)
    if deadlift:
        s['hips'] = [0, 0.18, -0.2]
        e['hips'] = STAND_HIPS
    else:
        e['hips'] = [0, 0.15, -0.02]
    return spec(start=s, end=e, props=props, equipment=equipment, cam=CAM_HINGE)


def mirror_only_L(d):
    """For one-arm moves: the right arm stays down unless given."""
    return d


P = {}

# ---------- Chest ----------
P['incline_bb_press'] = incline(BENCH_S, BENCH_E, props='barbell', deg=32)
P['incline_smith_press'] = incline(BENCH_S, BENCH_E, props='barbell', deg=32, equipment=[{'type': 'line', 'from': {'at': '@grip_L', 'off': [0.12, 0, -1.2]}, 'to': {'at': '@grip_L', 'off': [0.12, 0, 0.9]}},
                                                                                         {'type': 'line', 'from': {'at': '@grip_R', 'off': [-0.12, 0, -1.2]}, 'to': {'at': '@grip_R', 'off': [-0.12, 0, 0.9]}}])
P['incline_machine_press'] = incline(BENCH_S, BENCH_E, equipment=[{'type': 'line', 'from': {'at': '@grip_L', 'off': [0, 0.4, -0.2]}, 'to': '@grip_L', 'r': 0.03},
                                                                   {'type': 'line', 'from': {'at': '@grip_R', 'off': [0, 0.4, -0.2]}, 'to': '@grip_R', 'r': 0.03}])
P['flat_db_press'] = lying(BENCH_S, BENCH_E, props='dumbbells')
P['db_floor_press'] = spec(base={**SUPINE, 'thigh_L': [0.15, -0.6, 0.8], 'shin_L': [0.05, -0.3, -0.95], 'foot_L': [0.05, -1, -0.2]},
                           start=arms([0.9, 0.05, -0.15], [0.02, 0, 1]), end=BENCH_E, props='dumbbells', cam=CAM_LYING, hips=[0, -0.1, 0.12],
                           equipment=[{'type': 'mat'}])
P['smith_bench'] = lying(BENCH_S, BENCH_E, props='barbell', uprights=True)
P['close_grip_bench'] = lying({'clav_L': [1, 0.05, -0.1], **arms([0.45, -0.25, -0.55], [-0.05, 0, 1])}, {'clav_L': [1, 0, 0.05], **arms([0.1, -0.05, 1], [0.0, 0, 1])}, props='barbell', uprights=True)
P['machine_chest_press'] = seated(CHEST_PRESS_S, CHEST_PRESS_E, equipment=[{'type': 'handles', 'pivot': {'at': '@chest', 'off': [0.42, 0.3, 0.45]}}])
P['cable_fly'] = standing(FLY_S, FLY_E, torso=LEAN, equipment=[cable_from(1.0, 0.1, 0.55, 'single', '@grip_L'), cable_from(-1.0, 0.1, 0.55, 'single', '@grip_R')])
P['cable_crossover'] = standing(arms([1, 0.1, 0.45], [1, -0.15, 0.4]), arms([0.3, -0.7, -0.65], [0.0, -0.5, -0.85]), torso=LEAN,
                                equipment=[cable_from(1.0, 0.1, 1.0, 'single', '@grip_L'), cable_from(-1.0, 0.1, 1.0, 'single', '@grip_R')])
P['incline_cable_fly'] = standing(arms([0.95, 0.1, -0.4], [0.95, -0.2, -0.35]), arms([0.25, -1, 0.35], [0.05, -1, 0.35]), torso=LEAN,
                                  equipment=[cable_from(1.0, 0.1, -0.7, 'single', '@grip_L'), cable_from(-1.0, 0.1, -0.7, 'single', '@grip_R')])
P['pec_deck'] = seated(FLY_S, FLY_E, equipment=[{'type': 'handles', 'pivot': {'at': '@chest', 'off': [0.18, 0.2, 0.55]}}])
P['db_fly'] = lying(LYING_FLY_S, LYING_FLY_E, props='dumbbells')
PUSHUP_TOP = {**PRONE, **PRONE_LEGS, 'clav_L': [1, 0, 0], **arms([0.15, 0.05, -1], [0.12, 0, -1], [0.1, -1, -0.1]), 'hips': [0, 0.08, -0.32]}
PUSHUP_BOTTOM = {**PRONE, **PRONE_LEGS, **arms([0.7, 0.55, -0.45], [0.05, -0.1, -1], [0.1, -1, -0.1]), 'hips': [0, 0.08, -0.5]}
P['push_ups'] = spec(start=PUSHUP_TOP, end=PUSHUP_BOTTOM, cam=CAM_SIDE, fists=[])
P['weighted_push_ups'] = spec(start=PUSHUP_TOP, end=PUSHUP_BOTTOM, cam=CAM_SIDE, fists=[],
                              equipment=[{'type': 'box', 'center': {'at': '@chest', 'off': [0, 0.12, 0.14]}, 'size': [0.4, 0.4, 0.04], 'mat': 'frame'}])
DIP_TOP = {**UPRIGHT, 'thigh_L': [0.05, 0.1, -1], 'shin_L': [0.03, 0.6, -0.8], **arms([0.15, 0.05, -1], [0.1, 0, -1]), 'hips': [0, 0, 0.75]}
DIP_BOTTOM = {**UPRIGHT, 'thigh_L': [0.05, 0.1, -1], 'shin_L': [0.03, 0.6, -0.8], **arms([0.15, 0.75, -0.6], [0.05, -0.15, -1]), 'hips': [0, 0, 0.5]}
P['chest_dips'] = spec(start={**DIP_TOP, **{k: [v[0], v[1] - 0.25, v[2]] for k, v in HALF_HINGE.items()}}, end={**DIP_BOTTOM, **HALF_HINGE},
                       equipment=[{'type': 'dip_bars'}], cam=CAM_SIDE)
P['triceps_dips'] = spec(start=DIP_TOP, end=DIP_BOTTOM, equipment=[{'type': 'dip_bars'}], cam=CAM_SIDE)

# ---------- Shoulders ----------
P['db_shoulder_press'] = seated(PRESS_OH_S, PRESS_OH_E, props='dumbbells')
P['bb_ohp'] = standing({'clav_L': [1, 0.05, -0.05], **arms([0.55, -0.8, -0.2], [0.05, 0.05, 1])}, PRESS_OH_E, props='barbell')
P['machine_shoulder_press'] = seated(PRESS_OH_S, PRESS_OH_E, equipment=[{'type': 'handles', 'pivot': {'at': '@chest', 'off': [0.38, 0.35, -0.05]}}])
P['arnold_press'] = seated({'clav_L': [1, 0, -0.05], **arms([0.25, -0.9, -0.35], [-0.05, -0.2, 1])}, PRESS_OH_E, props='dumbbells')
P['smith_ohp'] = seated({'clav_L': [1, 0.05, -0.05], **arms([0.55, -0.8, -0.2], [0.05, 0.05, 1])}, PRESS_OH_E, props='barbell',
                        equipment=[{'type': 'line', 'from': [0.65, -0.25, 0], 'to': [0.65, -0.25, 2.0]}, {'type': 'line', 'from': [-0.65, -0.25, 0], 'to': [-0.65, -0.25, 2.0]}])
P['seated_lateral_raise'] = seated(LAT_RAISE_S, LAT_RAISE_E, props='dumbbells', back=False)
P['cable_lateral_raise'] = spec(base={**UPRIGHT, **STAND}, start={'upper_L': [-0.15, -0.1, -1], 'fore_L': [-0.25, -0.2, -1], 'hand_L': [-0.25, -0.2, -1]},
                                end={'clav_L': [1, 0.02, 0.2], **arms([1, -0.15, 0], [1, -0.3, 0.06])}, fists=['L'],
                                equipment=[cable_from(-0.45, 0.0, -0.75, 'single', '@grip_L')])
P['cable_upright_row'] = standing(ARMS_DOWN, UPRIGHT_E, cam=CAM_CABLE, equipment=[cable_from(0, -0.4, -0.78, 'bar')])
P['front_raise'] = standing(FRONT_RAISE_S, FRONT_RAISE_E, props='dumbbells')
P['cable_front_raise'] = standing(FRONT_RAISE_S, FRONT_RAISE_E, equipment=[cable_from(0, 0.45, -0.78, 'bar')], cam=CAM_CABLE)
P['plate_front_raise'] = standing(arms([0.05, -0.15, -1], [-0.05, -0.2, -1]), arms([0.1, -1, 0.1], [-0.08, -1, 0.15]), props='plate', cam=CAM_SIDE)
P['rear_raise'] = standing(REAR_S, REAR_E, props='dumbbells', torso=HINGE, legs=SOFT_KNEE, cam=CAM_SIDE)
P['prone_rear_raise'] = spec(base={'pelvis': [0, -0.85, 0.5], 'spine': [0, -0.85, 0.5], 'chest': [0, -0.85, 0.5], 'neck': [0, -0.9, 0.4], 'head': [0, -0.9, 0.4],
                                   'thigh_L': [0.12, -0.35, -1], 'shin_L': [0.05, 0.3, -1], 'foot_L': [0.08, -1, -0.3]},
                             start=REAR_S, end=REAR_E, props='dumbbells', hips=[0, 0.3, 0.2], cam=CAM_SIDE,
                             equipment=[{'type': 'box', 'center': {'at': '@chest', 'off': [0, 0.12, -0.13]}, 'size': [0.32, 0.9, 0.07]}])
P['rear_delt_fly'] = seated(arms([0.12, -1, 0.05], [0.1, -1, 0.05]), arms([1, 0.15, 0.02], [1, 0.05, 0.02]), back=False,
                            equipment=[{'type': 'box', 'center': {'at': '@chest', 'off': [0, -0.2, -0.05]}, 'size': [0.36, 0.08, 0.5]}])
P['face_pull'] = standing(FACE_PULL_S, FACE_PULL_E, equipment=[cable_from(0, -0.9, 0.55, 'rope')], cam=CAM_CABLE)
P['cable_rear_delt_fly'] = standing(arms([-0.3, -1, 0.1], [-0.35, -1, 0.1]), arms([1, 0.1, 0.05], [1, -0.05, 0.05]),
                                    equipment=[cable_from(-0.9, -0.9, 0.45, 'single', '@grip_L'), cable_from(0.9, -0.9, 0.45, 'single', '@grip_R')], cam=CAM_BACK)

# ---------- Back ----------
LAT_MACHINE = [{'type': 'seat', 'back': False}, {'type': 'roller', 'at': {'at': '@knees', 'off': [0, 0.02, 0.1]}},
               {'type': 'cable', 'from': {'at': '@hips', 'off': [0, -0.05, 1.75]}, 'to': '@grip', 'handle': 'bar', 'tower': False},
               {'type': 'line', 'from': {'at': '@hips', 'off': [0, -0.6, -0.6]}, 'to': {'at': '@hips', 'off': [0, -0.6, 1.8]}, 'r': 0.06},
               {'type': 'line', 'from': {'at': '@hips', 'off': [0, -0.6, 1.8]}, 'to': {'at': '@hips', 'off': [0, -0.05, 1.8]}, 'r': 0.04}]
P['wide_pulldown'] = spec(base={**UPRIGHT, **SEATED, 'pelvis': [0, 0.12, 1], 'spine': [0, 0.18, 1]},
                          start={'clav_L': [1, 0.05, 0.35], **arms([0.55, -0.02, 1], [0.4, -0.02, 1])},
                          end={'clav_L': [1, 0.12, 0], **arms([0.7, -0.06, -0.72], [0.1, -0.45, 0.88])}, equipment=LAT_MACHINE, hips=SEAT_HIPS, cam=CAM_BACK)
P['vbar_pulldown'] = spec(base={**UPRIGHT, **SEATED, 'pelvis': [0, 0.12, 1], 'spine': [0, 0.18, 1]},
                          start={'clav_L': [1, 0.05, 0.35], **arms([0.15, -0.1, 1], [0.02, -0.1, 1])},
                          end={'clav_L': [1, 0.12, 0], **arms([0.3, 0.25, -0.92], [-0.12, -0.5, 0.86])}, equipment=LAT_MACHINE[:2] + [
                              {'type': 'cable', 'from': {'at': '@hips', 'off': [0, -0.05, 1.75]}, 'to': '@grip', 'handle': 'none', 'tower': False}] + LAT_MACHINE[3:], hips=SEAT_HIPS, cam=CAM_BACK)
P['single_arm_pulldown'] = spec(base={**UPRIGHT, **KNEEL, 'upper_R': [-0.12, 0, -1], 'fore_R': [-0.1, -0.05, -1]},
                                start={'clav_L': [1, 0.05, 0.35], **arms([0.2, -0.05, 1], [0.1, -0.05, 1])}, end=arms([0.35, 0.3, -0.9], [-0.1, -0.35, 0.92]),
                                fists=['L'], hips=[0, 0, -0.32], cam=CAM_BACK,
                                equipment=[{'type': 'cable', 'from': {'at': '@hips', 'off': [0.15, -0.05, 1.7]}, 'to': '@grip_L', 'handle': 'single', 'tower': False},
                                           {'type': 'line', 'from': {'at': '@hips', 'off': [0.15, -0.6, -0.4]}, 'to': {'at': '@hips', 'off': [0.15, -0.6, 1.75]}, 'r': 0.06},
                                           {'type': 'line', 'from': {'at': '@hips', 'off': [0.15, -0.6, 1.75]}, 'to': {'at': '@hips', 'off': [0.15, -0.05, 1.75]}, 'r': 0.04}])
PULLUP_EQ = [{'type': 'bar', 'at': '@grip', 'half': 0.65}]
P['pull_ups'] = spec(base={**UPRIGHT, 'thigh_L': [0.05, 0.15, -1], 'shin_L': [0.03, 0.55, -0.85], 'foot_L': [0.05, -0.3, -0.95]},
                     start={**PULLUP_S, 'hips': [0, 0, 0.35]}, end={**PULLUP_E, 'hips': [0, 0, 0.72]}, equipment=PULLUP_EQ, cam=CAM_BACK, floor=-0.9)
P['chin_ups'] = spec(base=P['pull_ups']['base'], start={'clav_L': [1, 0.05, 0.35], **arms([0.2, -0.05, 1], [0.12, -0.05, 1]), 'hips': [0, 0, 0.35]},
                     end={'clav_L': [1, 0.12, 0], **arms([0.35, -0.3, -0.88], [-0.1, -0.35, 0.93]), 'hips': [0, 0, 0.72]}, equipment=PULLUP_EQ,
                     cam={'azimuth': 35, 'elevation': 8, 'distance': 3.8, 'lens': 50}, floor=-0.9)
P['assisted_pull_ups'] = dict(P['pull_ups'], equipment=PULLUP_EQ + [{'type': 'line', 'from': {'at': '@grip_L', 'off': [-0.1, 0, 0]}, 'to': {'at': '@knees', 'off': [0, 0.05, -0.05]}, 'r': 0.012},
                                                                   {'type': 'line', 'from': {'at': '@grip_R', 'off': [0.1, 0, 0]}, 'to': {'at': '@knees', 'off': [0, 0.05, -0.05]}, 'r': 0.012}])
P['bb_bent_row'] = standing(ROW_HINGE_S, ROW_HINGE_E, cam=CAM_HINGE, props='barbell', torso=HINGE, legs=SOFT_KNEE)
P['db_bent_row'] = standing(ROW_HINGE_S, ROW_HINGE_E, cam=CAM_HINGE, props='dumbbells', torso=HINGE, legs=SOFT_KNEE)
P['tbar_row'] = standing(arms([0.05, -0.1, -1], [0.0, -0.05, -1]), arms([0.15, 0.7, -0.7], [-0.02, -0.15, -1]), props='ez', torso=HINGE, legs=SOFT_KNEE, cam=CAM_SIDE,
                         equipment=[{'type': 'line', 'from': {'at': '@grip', 'off': [0, -0.08, 0]}, 'to': {'at': '@hips', 'off': [0, 1.2, -0.9]}, 'r': 0.022}])
P['single_arm_db_row'] = spec(base={**HINGE, 'thigh_L': [0.12, -0.25, -1], 'shin_L': [0.05, 0.1, -1], 'thigh_R': [-0.1, 0.25, -1], 'shin_R': [-0.04, 0.3, -1],
                                    'upper_R': [-0.15, -0.6, -0.8], 'fore_R': [-0.05, -0.1, -1], 'hand_R': [-0.05, -0.1, -1]},
                              start=arms([0.1, -0.15, -1], [0.05, -0.15, -1]), end=arms([0.12, 0.85, -0.5], [0.04, -0.1, -1]), props='dumbbell_L', fists=['L', 'R'],
                              cam=CAM_SIDE, equipment=[{'type': 'box', 'center': {'at': '@grip_R', 'off': [0, -0.1, -0.05]}, 'size': [0.35, 0.9, 0.07]},
                                                       {'type': 'post', 'at': {'at': '@grip_R', 'off': [0, -0.1, -0.08]}}])
P['chest_supported_row'] = spec(base={'pelvis': [0, -0.6, 0.8], 'spine': [0, -0.65, 0.76], 'chest': [0, -0.65, 0.76], 'neck': [0, -0.75, 0.66], 'head': [0, -0.75, 0.66],
                                      'thigh_L': [0.12, -0.35, -1], 'shin_L': [0.05, 0.3, -1], 'foot_L': [0.08, -1, -0.3]},
                                start=HANG_ARMS, end=arms([0.15, 0.85, -0.4], [0.05, -0.05, -1]), props='dumbbells', hips=[0, 0.25, 0.18], cam=CAM_SIDE,
                                equipment=[{'type': 'box', 'center': {'at': '@chest', 'off': [0, 0.1, -0.13]}, 'size': [0.32, 0.25, 0.8]}])
P['machine_row'] = seated(arms([0.12, -1, -0.2], [0.05, -1, -0.1]), arms([0.15, 0.85, -0.5], [-0.02, -1, 0.05]), back=False,
                          equipment=[{'type': 'box', 'center': {'at': '@chest', 'off': [0, -0.2, -0.05]}, 'size': [0.36, 0.08, 0.5]},
                                     {'type': 'handles', 'pivot': {'at': '@chest', 'off': [0.3, -0.75, 0.35]}}])
P['single_arm_cable_row'] = spec(setup='cable_row', base={**UPRIGHT, 'thigh_L': [0.1, -1, 0.1], 'shin_L': [0.03, -1, -0.3], 'foot_L': [0.02, -0.25, 1],
                                                         'upper_R': [-0.12, 0, -1], 'fore_R': [-0.1, -0.05, -1]},
                                 start={'clav_L': [1, -0.1, 0], **arms([0.06, -1, -0.28], [-0.02, -1, -0.1])}, end={'clav_L': [1, 0.12, 0], **arms([0.14, 0.75, -0.65], [-0.04, -1, 0.12])},
                                 row={'seat_z': 0.40, 'seat_y': 0.0, 'foot_y': -0.92}, hips=[0, 0, 0.5], floor=0.0, cam=CAM_SIDE)
P['inverted_row'] = spec(base={**SUPINE, 'thigh_L': [0.05, -1, -0.08], 'shin_L': [0.03, -1, -0.08], 'foot_L': [0.02, -0.3, 1]},
                         start={**arms([0.3, 0.05, 1], [0.2, 0.05, 1]), 'hips': [0, 0, 0.45]}, end={**arms([0.7, 0.05, -0.7], [0.0, 0.1, 1]), 'hips': [0, 0, 0.62]},
                         equipment=[{'type': 'bar', 'at': '@grip', 'half': 0.7}], cam=CAM_SIDE, floor=-0.0)
P['straight_arm_pulldown'] = standing(STRAIGHT_S, STRAIGHT_E, torso=LEAN, legs=SOFT_KNEE, equipment=[cable_from(0, -0.75, 1.25, 'bar')], cam=CAM_CABLE)
P['rope_straight_arm'] = standing(STRAIGHT_S, arms([0.25, 0.25, -1], [0.25, 0.2, -1]), torso=LEAN, legs=SOFT_KNEE, equipment=[cable_from(0, -0.75, 1.25, 'rope')], cam=CAM_CABLE)
P['db_pullover'] = lying(arms([0.12, 1, 0.15], [0.05, 1, 0.1]), arms([0.12, 0.2, 1], [0.04, 0.15, 1]), props='dumbbell_single')
P['db_shrug'] = standing(SHRUG_S, SHRUG_E, props='dumbbells')
P['bb_shrug'] = standing(SHRUG_S, SHRUG_E, props='barbell')
P['cable_shrug'] = standing(SHRUG_S, SHRUG_E, cam=CAM_CABLE, equipment=[cable_from(0, -0.4, -0.78, 'bar')])
P['deadlift'] = hinge('barbell', deadlift=True)
P['trap_bar_deadlift'] = hinge('trap_bar', deadlift=True)
BE_LEGS = {'thigh_L': [0.06, 0.7, -0.7], 'shin_L': [0.04, 0.7, -0.7], 'foot_L': [0.03, -0.45, -0.9]}
P['back_extension'] = spec(base={**BE_LEGS, **arms([0.35, -0.6, 0.72], [-0.3, 0.2, 0.93])},
                           start={**{k: [0, -0.55, -0.83] for k in ('pelvis', 'spine', 'chest')}, 'neck': [0, -0.7, -0.7], 'head': [0, -0.75, -0.6]},
                           end={**{k: [0, -0.7, 0.7] for k in ('pelvis', 'spine', 'chest')}, 'neck': [0, -0.75, 0.66], 'head': [0, -0.8, 0.6]},
                           hips=[0, 0, 0.6], fists=[], cam=CAM_SIDE, floor=-0.62,
                           equipment=[{'type': 'box', 'center': {'at': '@hips', 'off': [0, -0.1, -0.1]}, 'size': [0.42, 0.14, 0.14], 'name': 'hippad'},
                                      {'type': 'roller', 'at': {'at': '@ankles', 'off': [0, 0.06, 0.06]}},
                                      {'type': 'line', 'from': {'at': '@hips', 'off': [0, -0.02, -0.2]}, 'to': {'at': '@ankles', 'off': [0, 0.2, -0.15]}, 'r': 0.04},
                                      {'type': 'line', 'from': {'at': '@hips', 'off': [0, -0.02, -0.2]}, 'to': [0, -0.1, -0.62], 'r': 0.04},
                                      {'type': 'line', 'from': {'at': '@ankles', 'off': [0, 0.2, -0.15]}, 'to': [0, 1.0, -0.62], 'r': 0.04}])

# ---------- Arms ----------
P['incline_db_curl'] = incline(arms([0.12, 0.35, -1], [0.1, 0.2, -1]), arms([0.12, 0.3, -1], [0.04, -0.6, 0.8]), props='dumbbells', deg=50)
P['ez_curl'] = standing(CURL_S, CURL_E, props='ez')
P['bb_curl'] = standing(CURL_S, CURL_E, props='barbell')
P['db_curl'] = standing(CURL_S, CURL_E, props='dumbbells')
P['cable_curl'] = standing(CURL_S, CURL_E, cam=CAM_CABLE, equipment=[cable_from(0, -0.45, -0.78, 'bar')])
P['hammer_curl'] = standing(CURL_S, CURL_E, props='dumbbells')
P['cross_body_hammer'] = standing(CURL_S, arms([0.05, -0.15, -1], [-0.45, -0.45, 0.78]), props='dumbbells')
P['rope_hammer_curl'] = standing(CURL_S, CURL_E, cam=CAM_CABLE, equipment=[cable_from(0, -0.45, -0.78, 'rope')])
P['bb_reverse_curl'] = standing(CURL_S, CURL_E, props='barbell')
P['reverse_cable_curl'] = standing(CURL_S, CURL_E, cam=CAM_CABLE, equipment=[cable_from(0, -0.45, -0.78, 'bar')])
P['concentration_curl'] = seated(arms([-0.05, -0.35, -1], [-0.05, -0.2, -1]), arms([-0.05, -0.35, -1], [0.0, -0.55, 0.85]), props='dumbbell_L', back=False,
                                 torso=HALF_HINGE)
P['concentration_curl']['fists'] = ['L']
P['preacher_curl'] = seated(arms([0.12, -0.75, -0.6], [0.08, -0.9, -0.35]), arms([0.12, -0.75, -0.6], [0.02, -0.2, 0.98]), props='ez_small', back=False,
                            equipment=[{'type': 'box', 'center': {'at': '@chest', 'off': [0, -0.25, -0.1]}, 'size': [0.5, 0.08, 0.32]}])
P['machine_curl'] = seated(arms([0.12, -0.75, -0.6], [0.08, -0.9, -0.35]), arms([0.12, -0.75, -0.6], [0.02, -0.2, 0.98]), back=False,
                           equipment=[{'type': 'box', 'center': {'at': '@chest', 'off': [0, -0.25, -0.1]}, 'size': [0.5, 0.08, 0.32]},
                                      {'type': 'line', 'from': '@grip_L', 'to': '@grip_R', 'r': 0.016},
                                      {'type': 'handles', 'pivot': {'at': '@chest', 'off': [0.3, -0.35, -0.15]}}])
P['triceps_pushdown'] = standing(PUSHDOWN_S, PUSHDOWN_E, torso=LEAN, equipment=[cable_from(0, -0.35, 1.3, 'bar')], cam=CAM_CABLE)
P['rope_pushdown'] = standing(PUSHDOWN_S, arms([0.06, 0.05, -1], [0.2, 0.05, -1]), torso=LEAN, equipment=[cable_from(0, -0.35, 1.3, 'rope')], cam=CAM_CABLE)
P['vbar_pushdown'] = standing(PUSHDOWN_S, PUSHDOWN_E, torso=LEAN, equipment=[cable_from(0, -0.35, 1.3, 'none')], cam=CAM_CABLE)
P['overhead_db_ext'] = seated(OH_EXT_S, OH_EXT_E, props='dumbbell_single', cam=CAM_SIDE)
P['cable_overhead_ext'] = spec(base={'pelvis': [0, -0.35, 0.94], 'spine': [0, -0.35, 0.94], 'chest': [0, -0.35, 0.94], 'neck': [0, -0.3, 0.95], 'head': [0, -0.3, 0.95],
                                     'thigh_L': [0.06, -0.3, -1], 'shin_L': [0.04, 0.05, -1], 'thigh_R': [-0.06, 0.3, -1], 'shin_R': [-0.04, 0.3, -1]},
                               start=arms([0.1, -0.45, 0.9], [0.02, 0.6, 0.2]), end=arms([0.1, -0.5, 0.86], [0.04, -0.55, 0.83]),
                               equipment=[cable_from(0, 0.75, -0.55, 'rope')], cam=CAM_SIDE)
P['skull_crusher'] = lying(arms([0.12, -0.25, 1], [0.0, 0.85, -0.4]), arms([0.12, -0.2, 1], [0.04, -0.1, 1]), props='ez')
P['db_kickback'] = standing(KICKBACK_S, KICKBACK_E, props='dumbbells', torso=HINGE, legs=SOFT_KNEE, cam=CAM_SIDE)
WRIST = {'upper_L': [0.12, -0.45, -0.88], 'fore_L': [0.06, -1, -0.08]}
P['wrist_curl'] = seated({**WRIST, 'hand_L': [0.05, -0.6, -0.8]}, {**WRIST, 'hand_L': [0.05, -0.55, 0.82]}, props='bar_only', back=False, torso=HALF_HINGE, cam=CAM_SIDE)
P['reverse_wrist_curl'] = seated({**WRIST, 'hand_L': [0.05, -0.6, -0.8]}, {**WRIST, 'hand_L': [0.05, -0.55, 0.82]}, props='bar_only', back=False, torso=HALF_HINGE, cam=CAM_SIDE)
P['db_wrist_curl'] = seated({**WRIST, 'hand_L': [0.05, -0.6, -0.8]}, {**WRIST, 'hand_L': [0.05, -0.55, 0.82]}, props='dumbbells', back=False, torso=HALF_HINGE, cam=CAM_SIDE)
P['db_reverse_wrist_curl'] = dict(P['db_wrist_curl'])
P['cable_wrist_curl'] = seated({**WRIST, 'hand_L': [0.05, -0.6, -0.8]}, {**WRIST, 'hand_L': [0.05, -0.55, 0.82]}, back=False, torso=HALF_HINGE, cam=CAM_SIDE,
                               equipment=[cable_from(0, -1.0, -0.6, 'bar')])
P['wrist_roller'] = standing(arms([0.2, -1, -0.05], [0.12, -1, 0.0], [0.1, -0.7, -0.7]), arms([0.2, -1, -0.05], [0.12, -1, 0.0], [0.1, -0.7, 0.7]), props='ez',
                             equipment=[{'type': 'line', 'from': '@grip', 'to': {'at': '@grip', 'off': [0, 0, -0.75]}, 'r': 0.005},
                                        {'type': 'box', 'center': {'at': '@grip', 'off': [0, 0, -0.8]}, 'size': [0.16, 0.16, 0.06], 'mat': 'frame'}])
WALK = {'thigh_L': [0.06, -0.3, -1], 'shin_L': [0.04, 0.05, -1], 'thigh_R': [-0.06, 0.25, -1], 'shin_R': [-0.04, 0.4, -1], 'foot_R': [-0.08, -0.7, -0.7]}
P['farmers_walk'] = standing(ARMS_DOWN, ARMS_DOWN, props='dumbbells', legs={**STAND, **WALK})
P['farmers_walk']['frames']['start'] = {**ARMS_DOWN, **STAND}
P['farmers_walk']['frames']['end'] = {**ARMS_DOWN, **WALK}
P['trap_bar_carry'] = dict(P['farmers_walk'], props='trap_bar')
P['db_hold'] = standing(ARMS_DOWN, {'clav_L': [1, 0, 0.05], **ARMS_DOWN}, props='dumbbells')

# ---------- Legs ----------
P['back_squat'] = squat('barbell', BACK_BAR, equipment=[{'type': 'line', 'from': [0.62, 0.15, 0], 'to': [0.62, 0.15, 1.9]}, {'type': 'line', 'from': [-0.62, 0.15, 0], 'to': [-0.62, 0.15, 1.9]}])
P['front_squat'] = squat('barbell', FRONT_BAR)
P['goblet_squat'] = squat('dumbbell_single', arms([0.25, -0.6, -0.75], [-0.5, -0.4, 0.75]))
P['smith_squat'] = squat('barbell', BACK_BAR, equipment=[{'type': 'line', 'from': [0.62, 0.05, 0], 'to': [0.62, 0.05, 2.0]}, {'type': 'line', 'from': [-0.62, 0.05, 0], 'to': [-0.62, 0.05, 2.0]}])
P['hack_squat'] = squat(None, arms([0.6, 0.2, -0.6], [-0.2, -0.3, 0.9]),
                        equipment=[{'type': 'box', 'center': {'at': '@chest', 'off': [0, 0.17, -0.1]}, 'size': [0.4, 0.06, 0.9]}])
P['hack_squat']['fists'] = []
LEG_PRESS_TORSO = {'pelvis': [0, 0.7, 0.7], 'spine': [0, 0.7, 0.7], 'chest': [0, 0.7, 0.7], 'neck': [0, 0.55, 0.83], 'head': [0, 0.5, 0.86]}
P['leg_press'] = spec(base={**LEG_PRESS_TORSO, **arms([0.35, 0.3, -0.9], [0.2, -0.6, -0.75])},
                      start={'thigh_L': [0.2, -0.45, 0.87], 'shin_L': [0.05, -0.95, -0.3], 'foot_L': [0.05, -0.3, 0.95]},
                      end={'thigh_L': [0.15, -0.8, 0.58], 'shin_L': [0.08, -0.8, 0.58], 'foot_L': [0.05, -0.55, 0.83]},
                      hips=[0, 0, 0.45], floor=0.0, cam=CAM_SIDE, fists=[],
                      equipment=[{'type': 'box', 'center': {'at': '@hips', 'off': [0, 0.22, 0.25]}, 'size': [0.45, 0.08, 0.8], 'name': 'lpback'},
                                 {'type': 'box', 'center': {'at': '@hips', 'off': [0, 0.05, -0.12]}, 'size': [0.45, 0.4, 0.08], 'name': 'lpseat'},
                                 {'type': 'plate', 'at': {'at': '@ankles', 'off': [0, -0.12, 0.08]}, 'normal': [0, -0.8, 0.6]},
                                 {'type': 'line', 'from': [0.35, 0.3, 0.05], 'to': [0.35, -1.5, 1.3]}, {'type': 'line', 'from': [-0.35, 0.3, 0.05], 'to': [-0.35, -1.5, 1.3]}])
P['bulgarian_split_squat'] = spec(base={**UPRIGHT, **ARMS_DOWN}, start={**LUNGE_S, 'shin_R': [-0.04, 0.85, -0.5], 'foot_R': [-0.05, 0.6, 0.8]},
                                  end={**LUNGE_E, 'thigh_R': [-0.06, 0.45, -0.9], 'shin_R': [-0.04, 0.95, 0.1], 'foot_R': [-0.05, 0.4, 0.9], 'hips': [0, 0, -0.25]},
                                  props='dumbbells', cam=CAM_SIDE,
                                  equipment=[{'type': 'box', 'center': {'at': '@ankle_R', 'off': [0.05, 0.12, -0.06]}, 'size': [0.4, 0.4, 0.45], 'name': 'splitbench'}])
P['db_lunge'] = spec(base={**UPRIGHT, **ARMS_DOWN}, start={**STAND}, end={**LUNGE_E, 'hips': [0, 0, -0.3]}, props='dumbbells', cam=CAM_SIDE)
P['reverse_lunge'] = dict(P['db_lunge'])
P['step_up'] = spec(base={**UPRIGHT, **ARMS_DOWN},
                    start={'thigh_L': [0.08, -1, -0.05], 'shin_L': [0.05, 0.12, -1], **{k[:-1] + 'R': [-v[0], v[1], v[2]] for k, v in STAND.items()}},
                    end={**STAND, 'thigh_R': [-0.06, -0.5, -0.85], 'shin_R': [-0.04, 0.6, -0.8], 'hips': [0, -0.4, 0.5]}, props='dumbbells', cam={'azimuth': 80, 'elevation': 6, 'distance': 4.2, 'lens': 50, 'target': [0, -0.2, 0.05]}, floor=-0.82,
                    equipment=[{'type': 'box', 'center': [0.1, -0.42, -0.6], 'size': [0.5, 0.45, 0.45], 'name': 'stepbox', 'mat': 'frame'}])
P['leg_extension'] = seated({'shin_L': [0.05, 0.15, -1], **arms([0.2, 0.15, -1], [0.1, -0.2, -1])}, {'shin_L': [0.05, -1, 0.05], **arms([0.2, 0.15, -1], [0.1, -0.2, -1])},
                            cam=CAM_SIDE, equipment=[{'type': 'roller', 'at': {'at': '@ankles', 'off': [0, -0.07, 0.04]}}])
P['sissy_squat'] = spec(base={**ARMS_DOWN}, start={**UPRIGHT, **STAND}, end={**{k: [0, 0.5, 0.86] for k in ('pelvis', 'spine', 'chest')}, 'neck': [0, 0.3, 0.95], 'head': [0, 0.2, 1],
                                                                       'thigh_L': [0.08, -0.85, -0.5], 'shin_L': [0.05, 0.45, -0.9], 'foot_L': [0.05, -0.4, -0.9], 'hips': [0, 0, -0.25]},
                        cam=CAM_SIDE, fists=[])
P['rdl'] = hinge('barbell')
P['db_rdl'] = hinge('dumbbells')
P['good_morning'] = spec(base={**BACK_BAR}, start={**UPRIGHT, **STAND}, end={**HINGE, **SOFT_KNEE, 'hips': [0, 0.15, -0.02]}, props='barbell', cam={'azimuth': 50, 'elevation': 15, 'distance': 3.5, 'lens': 50})
P['cable_pull_through'] = standing(arms([0.05, 0.3, -1], [0.02, 0.4, -1]), arms([0.05, -0.1, -1], [0.02, -0.05, -1]), torso=HINGE, legs=SOFT_KNEE, cam=CAM_SIDE,
                                   equipment=[cable_from(0, 0.9, -0.75, 'rope')])
P['cable_pull_through']['frames']['end'].update({**UPRIGHT, **STAND})
P['lying_leg_curl'] = spec(base={**PRONE, **arms([0.3, -0.6, -0.75], [0.1, -1, 0.0])}, start={'thigh_L': [0.06, 1, -0.05], 'shin_L': [0.03, 1, 0.02], 'foot_L': [0.02, 0.3, -1]},
                           end={'thigh_L': [0.06, 1, -0.05], 'shin_L': [0.03, -0.3, 0.95], 'foot_L': [0.02, -0.95, 0.3]}, hips=[0, 0, 0.62], fists=[], cam=CAM_SIDE,
                           equipment=[{'type': 'bench', 'top_z': 0.5, 'y0': -0.9, 'y1': 0.55}, {'type': 'roller', 'at': {'at': '@ankles', 'off': [0, 0.03, 0.07]}}])
P['seated_leg_curl'] = seated({'shin_L': [0.05, -1, -0.2]}, {'shin_L': [0.05, 0.35, -0.94]}, cam=CAM_SIDE,
                              equipment=[{'type': 'roller', 'at': {'at': '@ankles', 'off': [0, 0.05, 0.02]}}, {'type': 'roller', 'at': {'at': '@knees', 'off': [0, 0.15, 0.1]}}])
P['standing_leg_curl'] = standing(ARMS_DOWN, ARMS_DOWN, torso=LEAN, cam=CAM_SIDE, equipment=[{'type': 'box', 'center': {'at': '@hips', 'off': [0, -0.25, 0.15]}, 'size': [0.4, 0.08, 0.4]}])
P['standing_leg_curl']['frames']['end'].update({'shin_R': [-0.03, 0.9, 0.4], 'foot_R': [-0.02, 0.4, 0.9]})
P['ball_leg_curl'] = spec(base={**SUPINE, **arms([0.25, 0.3, -0.9], [0.2, -0.2, -1])}, start={'thigh_L': [0.05, -1, -0.05], 'shin_L': [0.03, -1, -0.05], 'hips': [0, 0, 0.22]},
                          end={'thigh_L': [0.06, -0.6, 0.8], 'shin_L': [0.03, -0.5, -0.86], 'hips': [0, 0, 0.3]}, fists=[], cam=CAM_SIDE, floor=0.0,
                          equipment=[{'type': 'box', 'center': {'at': '@ankles', 'off': [0, -0.05, -0.17]}, 'size': [0.5, 0.45, 0.32]}])
P['glute_ham_raise'] = spec(base={**KNEEL, **arms([0.3, -0.4, -0.85], [0.1, -0.6, -0.8])}, start={**UPRIGHT}, end={**{k: [0, -0.85, 0.5] for k in ('pelvis', 'spine', 'chest', 'neck', 'head')},
                                                                                                           'thigh_L': [0.08, -0.85, -0.5]},
                            hips=[0, 0, -0.32], fists=[], cam=CAM_SIDE, equipment=[{'type': 'roller', 'at': {'at': '@ankles', 'off': [0, 0.04, 0.08]}}, {'type': 'mat'}])
BRIDGE_UP = {'pelvis': [0, 1, 0.05], 'spine': [0, 1, -0.15], 'chest': [0, 1, -0.3], 'neck': [0, 1, 0.1], 'head': [0, 1, 0.1], 'thigh_L': [0.1, -1, -0.05], 'shin_L': [0.05, -0.1, -1]}
BRIDGE_DOWN = {'pelvis': [0, 0.6, 0.8], 'spine': [0, 0.85, 0.5], 'chest': [0, 1, 0.0], 'neck': [0, 1, 0.1], 'head': [0, 1, 0.1], 'thigh_L': [0.1, -0.6, 0.8], 'shin_L': [0.05, -0.2, -1]}
P['hip_thrust'] = spec(base={**arms([0.9, 0.05, -0.3], [0.05, -1, 0.1])}, start={**BRIDGE_DOWN, 'hips': [0, 0, 0.12]}, end={**BRIDGE_UP, 'hips': [0, 0, 0.42]}, props='barbell',
                       cam=CAM_SIDE, floor=-0.43, equipment=[{'type': 'box', 'center': {'at': '@chest', 'off': [0, 0.2, -0.2]}, 'size': [0.6, 0.35, 0.4]}])
P['glute_bridge'] = spec(base={**arms([0.9, 0.05, -0.3], [0.05, -1, 0.1])}, start={**SUPINE, 'thigh_L': [0.1, -0.6, 0.8], 'shin_L': [0.05, -0.2, -1], 'hips': [0, 0, -0.65]},
                         end={**SUPINE, 'pelvis': [0, 1, -0.3], 'thigh_L': [0.1, -1, 0.1], 'shin_L': [0.05, -0.1, -1], 'hips': [0, 0, -0.45]}, props='barbell', cam=CAM_SIDE, floor=-0.78,
                         equipment=[{'type': 'mat'}])
P['single_leg_bridge'] = dict(P['glute_bridge'], props=None, fists=[], base={**arms([0.15, 0.3, -0.95], [0.1, -0.2, -1])})
P['single_leg_bridge']['frames'] = {k: {**v, 'thigh_R': [-0.08, -1, 0.15], 'shin_R': [-0.04, -1, 0.15]} for k, v in P['glute_bridge']['frames'].items()}
CALF_UP = {'foot_L': [0.06, -0.55, -0.83], 'hips': [0, 0, 0.11]}
P['standing_calf_raise'] = standing(ARMS_DOWN, {**ARMS_DOWN, **CALF_UP}, cam=CAM_SIDE,
                                    equipment=[{'type': 'box', 'center': {'at': '@neck', 'off': [0, 0.0, 0.05]}, 'size': [0.6, 0.2, 0.08], 'name': 'shoulderpads'},
                                               {'type': 'box', 'center': {'at': '@ankles', 'off': [0, -0.08, -0.1]}, 'size': [0.5, 0.2, 0.08], 'name': 'calfblock'}])
P['smith_calf_raise'] = standing(BACK_BAR, {**BACK_BAR, **CALF_UP}, props='barbell', cam=CAM_SIDE,
                                 equipment=[{'type': 'line', 'from': [0.62, 0.05, -0.8], 'to': [0.62, 0.05, 1.2]}, {'type': 'line', 'from': [-0.62, 0.05, -0.8], 'to': [-0.62, 0.05, 1.2]}])
P['db_calf_raise'] = standing(ARMS_DOWN, {**ARMS_DOWN, **CALF_UP}, props='dumbbells', cam=CAM_SIDE)
P['seated_calf_raise'] = seated({'shin_L': [0.05, 0.05, -1], 'foot_L': [0.08, -1, -0.2]}, {'shin_L': [0.05, 0.05, -1], 'foot_L': [0.06, -0.6, -0.8], 'hips': [0, 0, 0.6]},
                                cam=CAM_SIDE, back=False, equipment=[{'type': 'roller', 'at': {'at': '@knees', 'off': [0, -0.1, 0.05]}}])
P['leg_press_calf_raise'] = dict(P['leg_press'])
P['leg_press_calf_raise']['frames'] = {'start': {'thigh_L': [0.15, -0.8, 0.58], 'shin_L': [0.08, -0.8, 0.58], 'foot_L': [0.05, -0.3, 0.95]},
                                       'end': {'thigh_L': [0.15, -0.8, 0.58], 'shin_L': [0.08, -0.8, 0.58], 'foot_L': [0.05, -0.85, 0.5]}}

# ---------- Abs ----------
HANG = {**UPRIGHT, 'clav_L': [1, 0.05, 0.35], **arms([0.3, -0.02, 1], [0.2, -0.02, 1])}
P['hanging_leg_raise'] = spec(base=HANG, start={'thigh_L': [0.05, 0.05, -1], 'shin_L': [0.03, 0.05, -1], 'foot_L': [0.05, -0.6, -0.8], 'hips': [0, 0, 0.35]},
                              end={'thigh_L': [0.05, -1, 0.15], 'shin_L': [0.03, -1, 0.15], 'foot_L': [0.05, -0.3, 0.95], 'hips': [0, 0, 0.35]},
                              equipment=PULLUP_EQ, cam=CAM_SIDE, floor=-0.9)
P['captains_chair'] = spec(base={**UPRIGHT, 'clav_L': [1, 0, 0.2], **arms([0.2, -0.1, -1], [0.1, -1, 0.05])},
                           start={'thigh_L': [0.05, 0.05, -1], 'shin_L': [0.03, 0.05, -1], 'hips': [0, 0, 0.45]},
                           end={'thigh_L': [0.08, -1, 0.35], 'shin_L': [0.03, 0.2, -1], 'hips': [0, 0, 0.45]}, cam=CAM_SIDE, floor=-0.55, fists=[],
                           equipment=[{'type': 'box', 'center': {'at': '@chest', 'off': [0.32, -0.15, -0.18]}, 'size': [0.12, 0.4, 0.08]},
                                      {'type': 'box', 'center': {'at': '@chest', 'off': [-0.32, -0.15, -0.18]}, 'size': [0.12, 0.4, 0.08]},
                                      {'type': 'box', 'center': {'at': '@hips', 'off': [0, 0.15, 0.3]}, 'size': [0.45, 0.08, 0.9]}])
P['reverse_crunch'] = spec(base={**SUPINE, **arms([0.2, 0.3, -0.93], [0.15, -0.4, -0.9])}, start={'thigh_L': [0.08, -0.15, 1], 'shin_L': [0.04, -1, 0.05], 'hips': [0, 0, -0.68]},
                           end={'pelvis': [0, 1, 0.35], 'thigh_L': [0.08, 0.35, 0.94], 'shin_L': [0.04, -0.9, 0.4], 'hips': [0, 0, -0.62]}, fists=[], cam=CAM_SIDE, floor=-0.8,
                           equipment=[{'type': 'mat'}])
P['lying_leg_raise'] = spec(base={**SUPINE, **arms([0.15, 1, 0.1], [0.1, 1, 0.1])}, start={'thigh_L': [0.05, -1, 0.05], 'shin_L': [0.03, -1, 0.05], 'foot_L': [0.03, -0.4, 0.9]},
                            end={'thigh_L': [0.05, -0.1, 1], 'shin_L': [0.03, -0.1, 1], 'foot_L': [0.03, -1, 0.1]}, hips=[0, -0.12, 0.56], cam=CAM_SIDE,
                            equipment=[{'type': 'bench', 'top_z': 0.45, 'y0': -0.4, 'y1': 0.85}])
P['cable_crunch'] = spec(base={**KNEEL, **arms([0.25, -0.5, 0.85], [-0.2, 0.3, 0.92])}, start={**UPRIGHT, 'pelvis': [0, -0.4, 0.92], 'spine': [0, -0.5, 0.86]},
                         end={'pelvis': [0, -0.45, 0.9], 'spine': [0, -0.85, 0.3], 'chest': [0, -1, -0.15], 'neck': [0, -0.9, -0.4], 'head': [0, -0.8, -0.6]},
                         hips=[0, 0, -0.32], cam=CAM_SIDE, equipment=[cable_from(0, -0.55, 1.2, 'rope', '@neck'), {'type': 'mat'}])
P['machine_crunch'] = seated(arms([0.3, -0.5, 0.82], [-0.2, 0.2, 0.95]), arms([0.3, -0.75, 0.45], [-0.2, 0.0, 0.95]), cam=CAM_SIDE)
P['machine_crunch']['frames']['end'].update({'spine': [0, -0.75, 0.66], 'chest': [0, -0.9, 0.4], 'neck': [0, -0.9, 0.3], 'head': [0, -0.85, 0.4]})
P['decline_crunch'] = spec(base={**arms([0.4, 0.2, 0.9], [-0.3, -0.1, -0.95]), 'thigh_L': [0.1, -0.7, 0.7], 'shin_L': [0.05, -0.9, -0.3]},
                           start={'pelvis': [0, 1, 0.35], 'spine': [0, 1, 0.35], 'chest': [0, 1, 0.35], 'neck': [0, 1, 0.4], 'head': [0, 1, 0.4]},
                           end={'pelvis': [0, 0.6, 0.8], 'spine': [0, 0.2, 1], 'chest': [0, -0.2, 1], 'neck': [0, -0.4, 0.9], 'head': [0, -0.4, 0.9]},
                           hips=[0, 0, 0.5], cam=CAM_SIDE, fists=[], equipment=[{'type': 'line', 'from': {'at': '@hips', 'off': [0, 0.9, -0.45]}, 'to': {'at': '@ankles', 'off': [0, -0.1, -0.1]}, 'r': 0.07}])
P['ab_wheel'] = spec(base={**KNEEL, 'shin_L': [0.04, 1, -0.05]}, start={**HINGE, 'pelvis': [0, -0.2, 0.98], **arms([0.12, -0.3, -0.95], [0.08, -0.2, -1]), 'hips': [0, 0, -0.32]},
                     end={**PRONE, 'pelvis': [0, -0.85, 0.5], 'spine': [0, -1, 0.15], **arms([0.12, -1, 0.25], [0.1, -1, 0.0]), 'thigh_L': [0.08, -0.5, -0.85], 'hips': [0, 0, -0.4]},
                     cam=CAM_SIDE, equipment=[{'type': 'roller', 'at': {'at': '@grip', 'off': [0, -0.03, -0.05]}}, {'type': 'mat'}])
PLANK = {**PRONE, **PRONE_LEGS, **arms([0.15, -0.1, -1], [0.05, -1, 0.0], [0.05, -1, 0.0]), 'hips': [0, 0, -0.48]}
P['plank'] = spec(start=PLANK, end=PLANK, cam=CAM_SIDE, fists=[], equipment=[{'type': 'mat'}])


def main():
    names = [e['id'] for e in json.load(open(os.path.join(HERE, '..', 'exercises.json')))]
    missing = []
    for n in names:
        if n in HAND_TUNED:
            continue
        if n not in P:
            missing.append(n)
            continue
        d = dict(P[n])
        d['id'] = n
        with open(os.path.join(HERE, f'{n}.json'), 'w') as f:
            json.dump(d, f, indent=1)
    print('wrote', len(names) - len(HAND_TUNED) - len(missing), 'pose files; no template for:', missing or 'none')


if __name__ == '__main__':
    main()
