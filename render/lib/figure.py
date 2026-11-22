"""Build the posable clay figure from the muscle model.

The model (assets/models/muscles.glb source: Z-Anatomy via the Gymmetry muscle map, CC BY-SA 4.0)
is already split into named muscle regions, which double as the glow masks. We add a simple
armature and skin it ourselves (distance-based weights), because Blender's automatic weights
fail on a model made of many separate, overlapping muscle shells.

Coordinates: Z up, the figure faces -Y, its left side is +X. Units: metres (about 1.8 m tall).
"""
import math

import bpy
from mathutils import Matrix, Vector

# Joint positions measured from the model's region bounding boxes (see README).
J = {
    'pelvis': (0.0, 0.03, -0.06),
    'spine': (0.0, 0.04, 0.12),
    'chest': (0.0, 0.04, 0.36),
    'neck': (0.0, 0.03, 0.62),
    'head': (0.0, 0.02, 0.71),
    'head_top': (0.0, 0.0, 0.90),
    'clav': (0.035, 0.0, 0.585),
    'shoulder': (0.19, 0.045, 0.54),
    'elbow': (0.255, 0.045, 0.235),
    'wrist': (0.315, 0.0, 0.005),
    'fingers': (0.33, -0.03, -0.13),
    'hip': (0.088, 0.0, -0.06),
    'knee': (0.105, 0.0, -0.49),
    'ankle': (0.12, 0.04, -0.84),
    'toe': (0.13, -0.11, -0.89),
}

# name: (head, tail, parent, side)
def _bones():
    v = lambda k, s=1: Vector((J[k][0] * s, J[k][1], J[k][2]))
    b = {
        'pelvis': (v('pelvis'), v('spine'), None),
        'spine': (v('spine'), v('chest'), 'pelvis'),
        'chest': (v('chest'), v('neck'), 'spine'),
        'neck': (v('neck'), v('head'), 'chest'),
        'head': (v('head'), v('head_top'), 'neck'),
    }
    for side, s in (('L', 1), ('R', -1)):
        b[f'clav_{side}'] = (v('clav', s), v('shoulder', s), 'chest')
        b[f'upper_{side}'] = (v('shoulder', s), v('elbow', s), f'clav_{side}')
        b[f'fore_{side}'] = (v('elbow', s), v('wrist', s), f'upper_{side}')
        b[f'hand_{side}'] = (v('wrist', s), v('fingers', s), f'fore_{side}')
        b[f'thigh_{side}'] = (v('hip', s), v('knee', s), 'pelvis')
        b[f'shin_{side}'] = (v('knee', s), v('ankle', s), f'thigh_{side}')
        b[f'foot_{side}'] = (v('ankle', s), v('toe', s), f'shin_{side}')
    return b


BONES = _bones()

# Regions that may only follow certain bones (keeps e.g. lats off the arm, biceps off the chest).
RESTRICT = {
    'upper_lats': {'chest', 'spine', 'clav'},
    'lower_lats': {'chest', 'spine', 'pelvis'},
    'pec_major_upper': {'chest', 'clav'},
    'pec_major_lower': {'chest', 'clav'},
    'biceps': {'upper', 'fore'},
    'brachialis': {'upper', 'fore'},
    'triceps_long': {'upper', 'fore'},
    'triceps_lateral': {'upper', 'fore'},
    'triceps_medial': {'upper', 'fore'},
    'anterior_delt': {'clav', 'upper'},
    'lateral_delt': {'clav', 'upper'},
    'posterior_delt': {'clav', 'upper'},
    'rotator_cuff': {'clav', 'chest'},
    'teres_major': {'clav', 'chest'},
    'brachioradialis': {'upper', 'fore', 'hand'},
    'forearm_flexors': {'fore', 'hand', 'upper'},
    'forearm_extensors': {'fore', 'hand', 'upper'},
    'hand_muscles': {'hand', 'fore'},
    'rectus_abdominis': {'pelvis', 'spine', 'chest'},
    'obliques': {'pelvis', 'spine', 'chest'},
    'transverse_abdominis': {'pelvis', 'spine', 'chest'},
    'erector_spinae': {'pelvis', 'spine', 'chest', 'neck'},
    'serratus_anterior': {'chest', 'spine'},
    'upper_traps': {'chest', 'neck', 'clav'},
    'mid_traps': {'chest', 'clav'},
    'lower_traps': {'chest', 'spine'},
    'rhomboids': {'chest', 'clav'},
    'neck_flexors': {'neck', 'head', 'chest'},
    'neck_extensors': {'neck', 'head', 'chest'},
    'body_context': {'head', 'neck'},
    'glute_max': {'pelvis', 'thigh'},
    'glute_med': {'pelvis', 'thigh'},
    'hip_rotators': {'pelvis', 'thigh'},
    'hip_flexors': {'pelvis', 'thigh', 'spine'},
    'adductors': {'pelvis', 'thigh'},
    'rectus_femoris': {'thigh', 'shin', 'pelvis'},
    'vastus_group': {'thigh', 'shin'},
    'medial_hamstrings': {'thigh', 'shin', 'pelvis'},
    'lateral_hamstrings': {'thigh', 'shin', 'pelvis'},
    'gastrocnemius': {'shin', 'thigh', 'foot'},
    'soleus': {'shin', 'foot'},
    'tibialis_anterior': {'shin', 'foot'},
    'fibularis': {'shin', 'foot'},
    'foot_muscles': {'foot', 'shin'},
}


def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def build(glb_path):
    """Import the model, join regions into one mesh (one material slot per region), rig and skin it."""
    bpy.ops.import_scene.gltf(filepath=glb_path)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    # One material per region so masks survive the join.
    for o in meshes:
        region = o.name.split('.')[0]
        mat = bpy.data.materials.get(region) or bpy.data.materials.new(region)
        o.data.materials.clear()
        o.data.materials.append(mat)
        o['region'] = region
    # Bake transforms so vertex positions are in world space.
    for o in meshes:
        o.parent = None
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    regions_by_obj = {o.name: o['region'] for o in meshes}

    # Skin weights per object before joining (region restriction is per object).
    for o in meshes:
        region = o['region']
        allowed = RESTRICT.get(region)
        groups = {}
        for name in BONES:
            groups[name] = o.vertex_groups.new(name=name)
        for vtx in o.data.vertices:
            p = o.matrix_world @ vtx.co
            side = 'L' if p.x > 0.015 else 'R' if p.x < -0.015 else None
            cands = []
            for name, (h, t, _) in BONES.items():
                base = name.split('_')[0]
                if allowed and base not in allowed:
                    continue
                if name.endswith('_L') and side == 'R' or name.endswith('_R') and side == 'L':
                    continue
                cands.append((_seg_dist(p, h, t), name))
            if not cands:
                continue
            cands.sort()
            top = cands[:2]
            ws = [1.0 / (d + 0.01) ** 4 for d, _ in top]
            s = sum(ws)
            for (d, name), w in zip(top, ws):
                if w / s > 0.02:
                    groups[name].add([vtx.index], w / s, 'REPLACE')

    for o in meshes:
        o.select_set(True)
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = 'Figure'
    for poly in body.data.polygons:
        poly.use_smooth = True

    # Armature
    arm_data = bpy.data.armatures.new('Rig')
    rig = bpy.data.objects.new('Rig', arm_data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for name, (h, t, parent) in BONES.items():
        b = arm_data.edit_bones.new(name)
        b.head, b.tail = h, t
        b.roll = 0
        eb[name] = b
    for name, (_, _, parent) in BONES.items():
        if parent:
            eb[name].parent = eb[parent]
            eb[name].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    mod = body.modifiers.new('Rig', 'ARMATURE')
    mod.object = rig
    body.parent = rig
    return body, rig, regions_by_obj


def aim(rig, bone, direction):
    """Point a pose bone along a world-space direction (minimal twist), keeping its head where the parent put it."""
    bpy.context.view_layer.update()
    pb = rig.pose.bones[bone]
    rest = rig.data.bones[bone].matrix_local  # armature space
    rest_dir = (rest.to_3x3() @ Vector((0, 1, 0))).normalized()
    target = (rig.matrix_world.inverted().to_3x3() @ Vector(direction)).normalized()
    rot = rest_dir.rotation_difference(target).to_matrix().to_4x4()
    head = pb.head.copy() if pb.parent is None else (pb.parent.matrix @ (pb.parent.bone.matrix_local.inverted() @ rest.translation))
    m = rot @ Matrix.Translation(-rest.translation) @ rest
    m.translation = head
    pb.matrix = m
    bpy.context.view_layer.update()


def bone_world(rig, bone):
    pb = rig.pose.bones[bone]
    return rig.matrix_world @ pb.head, rig.matrix_world @ pb.tail


def deg_dir(yaw=0.0, pitch=0.0):
    """Direction from angles: pitch 0 = straight down (-Z) ... 90 = forward (-Y) ... 180 = up. yaw rotates about Z towards +X."""
    p = math.radians(pitch)
    y = math.radians(yaw)
    v = Vector((math.sin(p) * math.sin(y), -math.sin(p) * math.cos(y), -math.cos(p)))
    return v
