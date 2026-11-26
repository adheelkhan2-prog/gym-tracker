"""Build a rigged, muscular MakeHuman body (CC0, from MPFB2's data) without the MPFB add-on.

render/source/makehuman holds the files vendored from github.com/makehumancommunity/mpfb2
(src/mpfb/data, CC0): base.obj, the standard ("default") rig + its skin weights, the base-mesh
vertex groups (joint cubes) and the shape targets below.

Coordinates: MakeHuman's OBJ is Y-up in decimetres, facing +Z. Blender here is Z-up in metres,
facing -Y (same as the rest of the pipeline): (x, y, z)_obj -> (x, -z, y) * 0.1.
"""
import gzip
import json
import os

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'source', 'makehuman')

# Target name -> weight. Young, male, maximum muscle, low body fat, plus extra muscle on the
# arms, shoulders, legs, chest and back for a bodybuilder build.
TARGETS = {
    'caucasian-male-young': 1.0,
    'universal-male-young-maxmuscle-minweight': 1.0,
    'l-upperarm-muscle-incr': 1.4, 'r-upperarm-muscle-incr': 1.4,
    'l-upperarm-shoulder-muscle-incr': 1.4, 'r-upperarm-shoulder-muscle-incr': 1.4,
    'l-lowerarm-muscle-incr': 1.0, 'r-lowerarm-muscle-incr': 1.0,
    'l-upperleg-muscle-incr': 1.1, 'r-upperleg-muscle-incr': 1.1,
    'l-lowerleg-muscle-incr': 0.8, 'r-lowerleg-muscle-incr': 0.8,
    'torso-muscle-dorsi-incr': 1.2, 'torso-muscle-pectoral-incr': 1.1, 'torso-vshape-incr': 1.0,
}


def _conv(v):
    return Vector((v[0] * 0.1, -v[2] * 0.1, v[1] * 0.1))


def _load_obj(path):
    verts, uvs, faces, groups = [], [], [], []
    group = None
    with open(path) as f:
        for line in f:
            if line.startswith('v '):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('vt '):
                uvs.append([float(x) for x in line.split()[1:3]])
            elif line.startswith('g '):
                group = line.split(None, 1)[1].strip()
            elif line.startswith('f '):
                vi, ti = [], []
                for tok in line.split()[1:]:
                    a = tok.split('/')
                    vi.append(int(a[0]) - 1)
                    ti.append(int(a[1]) - 1 if len(a) > 1 and a[1] else -1)
                faces.append((vi, ti))
                groups.append(group)
    return verts, uvs, faces, groups


def _apply_targets(verts):
    for name, w in TARGETS.items():
        with gzip.open(os.path.join(SRC, 'targets', name + '.target.gz'), 'rt') as f:
            for line in f:
                p = line.split()
                if len(p) != 4 or p[0].startswith('#'):
                    continue
                i = int(p[0])
                verts[i][0] += float(p[1]) * w
                verts[i][1] += float(p[2]) * w
                verts[i][2] += float(p[3]) * w


def _vgroup_indices(vg, name):
    out = []
    for a, b in vg[name]:
        out.extend(range(a, b + 1))
    return out


CACHE = os.path.join(HERE, '..', 'cache')


def _belly_corrective(body):
    """'belly_flat' shape key: when the hips bend (sitting, reclining) skinning pushes the lower
    abdomen forward into a bulge. This key pulls it back into a flat, lean stomach; pose() drives
    it from the hip angle."""
    body.shape_key_add(name='Basis')
    key = body.shape_key_add(name='belly_flat', from_mix=False)
    for v in body.data.vertices:
        p = v.co
        if p.y > -0.02 or abs(p.x) > 0.17 or not (-0.06 < p.z < 0.26):
            continue
        wz = max(0.0, 1 - ((p.z - 0.07) / 0.17) ** 2)
        wx = max(0.0, 1 - (abs(p.x) / 0.17) ** 2)
        w = (wz * wx) ** 0.8
        key.data[v.index].co = p + Vector((0, 0.04 * w, 0.006 * w))
    key.value = 0.0


def _shoulder_smooth(body):
    """Raised shoulders (shrugs) pull the skin between the neck and the shoulder joint into a
    sharp peak: the clavicle and shoulder bones lift while neck-weighted trap vertices stay put.
    A Corrective Smooth modifier, limited to the trap/shoulder area, relaxes that pose-induced
    distortion back towards the rest shape (muscle detail kept). pose() sets its strength from
    how far the shoulders are raised, only for poses that set shoulder_L/R (the shrug)."""
    vg = body.vertex_groups
    src = [vg[n] for n in ('clavicle.L', 'clavicle.R', 'shoulder01.L', 'shoulder01.R', 'neck01', 'spine01') if n in vg]
    idx = {g.index for g in src}
    region = vg.new(name='shoulder_smooth')
    for v in body.data.vertices:
        w = sum(ge.weight for ge in v.groups if ge.group in idx)
        if w > 0.02:
            region.add([v.index], min(1.0, w * 1.5), 'REPLACE')
    cs = body.modifiers.new('ShoulderSmooth', 'CORRECTIVE_SMOOTH')
    cs.vertex_group = 'shoulder_smooth'
    cs.rest_source = 'ORCO'
    cs.smooth_type = 'LENGTH_WEIGHTED'
    cs.iterations = 12
    cs.scale = 1.0
    cs.factor = 0.0
    cs.use_only_smooth = False


def _shoulder_elevation(rig):
    """0 shoulders level .. 1 fully shrugged, from the clavicle angle above horizontal."""
    import math
    out = 0.0
    for s in ('L', 'R'):
        pb = rig.pose.bones[f'clavicle.{s}']
        d = (pb.tail - pb.head).normalized()
        rest = (rig.data.bones[f'clavicle.{s}'].tail_local - rig.data.bones[f'clavicle.{s}'].head_local).normalized()
        out = max(out, math.degrees(math.asin(max(-1, min(1, d.z)))) - math.degrees(math.asin(max(-1, min(1, rest.z)))))
    return max(0.0, min(1.0, (out - 6) / 10))


def _hip_flexion(rig):
    """0 standing .. 1 deep sit, from the angle between torso and thighs."""
    pb = rig.pose.bones
    torso = (pb['spine05'].tail - pb['spine05'].head).normalized()
    thigh = (pb['upperleg02.L'].tail - pb['upperleg01.L'].head).normalized()
    import math
    ang = math.degrees(torso.angle(thigh))  # ~180 standing, ~90 seated
    return max(0.0, min(1.0, (180 - ang - 25) / 70))


def _load_bake(body):
    """Attach the cached muscle-region ids (render/prepare_figure.py) as a `region` attribute."""
    path = os.path.join(CACHE, 'regions.json')
    if not os.path.exists(path):
        return
    data = json.load(open(path))
    names = data['names']
    idx = [-1] * len(body.data.vertices)
    for v, n in data['region'].items():
        if int(v) < len(idx) and n in names:
            idx[int(v)] = names.index(n)
    attr = body.data.attributes.new('region', 'INT', 'POINT')
    attr.data.foreach_set('value', idx)
    body['region_names'] = names
    # How much baked muscle detail each area gets: none on the head and hands (MakeHuman's own
    # face and fingers read better), softer on the lower legs, full on torso, arms and thighs.
    detail = {'body_context': 0.0, 'hand_muscles': 0.0, 'neck_flexors': 0.5, 'neck_extensors': 0.5,
              'gastrocnemius': 0.4, 'soleus': 0.3, 'tibialis_anterior': 0.3, 'fibularis': 0.3, 'foot_muscles': 0.0}
    col = body.data.color_attributes.new('detail', 'FLOAT_COLOR', 'POINT')
    vals = []
    for i in idx:
        d = detail.get(names[i], 1.0) if i >= 0 else 1.0
        vals += [d, d, d, 1.0]
    col.data.foreach_set('color', vals)


def normal_map():
    """The baked muscle-detail normal map, or None before prepare_figure.py has run."""
    path = os.path.join(CACHE, 'muscle_normal.png')
    if not os.path.exists(path):
        return None
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = 'Non-Color'
    return img


def build():
    """Return (body, rig): the posable body mesh and its armature, in the rest (A) pose."""
    verts, uvs, faces, groups = _load_obj(os.path.join(SRC, 'base.obj'))
    _apply_targets(verts)
    vg = json.load(open(os.path.join(SRC, 'basemesh_vertex_groups.json')))
    world = [_conv(v) for v in verts]

    body_ids = set(_vgroup_indices(vg, 'body'))
    n_body = max(body_ids) + 1
    body_faces = [(vi, ti) for (vi, ti), g in zip(faces, groups) if g == 'body']
    me = bpy.data.meshes.new('Figure')
    me.from_pydata([tuple(world[i]) for i in range(n_body)], [], [vi for vi, _ in body_faces])
    me.update()
    uv = me.uv_layers.new(name='UVMap')
    li = 0
    for poly, (_, ti) in zip(me.polygons, body_faces):
        for k in range(poly.loop_total):
            t = ti[k]
            uv.data[poly.loop_start + k].uv = uvs[t] if t >= 0 else (0, 0)
            li += 1
    for p in me.polygons:
        p.use_smooth = True
    body = bpy.data.objects.new('Figure', me)
    bpy.context.scene.collection.objects.link(body)

    # Rig: joint positions from the (targeted) mesh, so the bones fit the muscular body.
    rig_def = json.load(open(os.path.join(SRC, 'rig.default.json')))

    def point(spec):
        s = spec['strategy']
        if s == 'CUBE':
            ids = _vgroup_indices(vg, spec['cube_name'])
        elif s == 'VERTEX':
            ids = [spec['vertex_index']]
        elif s == 'MEAN':
            ids = spec['vertex_indices']
        else:
            return Vector(spec['default_position'])
        acc = Vector()
        for i in ids:
            acc += world[i]
        return acc / len(ids)

    arm_data = bpy.data.armatures.new('Rig')
    rig = bpy.data.objects.new('Rig', arm_data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for name, b in rig_def.items():
        e = arm_data.edit_bones.new(name)
        e.head = point(b['head'])
        e.tail = point(b['tail'])
        if (e.tail - e.head).length < 1e-4:
            e.tail = e.head + Vector((0, 0, 0.01))
        e.roll = b.get('roll', 0.0)
        eb[name] = e
    for name, b in rig_def.items():
        if b.get('parent'):
            eb[name].parent = eb[b['parent']]
            eb[name].use_connect = bool(b.get('use_connect', False))
    bpy.ops.object.mode_set(mode='OBJECT')

    weights = json.load(open(os.path.join(SRC, 'weights.default.json')))['weights']
    for bone, pairs in weights.items():
        g = body.vertex_groups.new(name=bone)
        for i, w in pairs:
            if i < n_body:
                g.add([i], w, 'REPLACE')
    mod = body.modifiers.new('Rig', 'ARMATURE')
    mod.object = rig
    body.parent = rig
    _load_bake(body)
    _belly_corrective(body)
    _shoulder_smooth(body)
    sub = body.modifiers.new('Subdivide', 'SUBSURF')
    sub.levels = 1
    sub.render_levels = 2
    return body, rig


# ---------- Posing ----------
# Pose files name a simple skeleton (pelvis, spine, chest, ..., upper_L, fore_L, ...). Each name
# drives a chain of MakeHuman bones that all point the same way.
CHAINS = {
    'pelvis': ['spine05'],
    'spine': ['spine04', 'spine03'],
    'chest': ['spine02', 'spine01'],
    'neck': ['neck01', 'neck02', 'neck03'],
    'head': ['head'],
}
for _s in ('L', 'R'):
    CHAINS.update({
        f'clav_{_s}': [f'clavicle.{_s}', f'shoulder01.{_s}'],
        # Optional: re-aim just the shoulder cap after clav_X (a shrug lifts the collarbone while
        # the deltoid cap stays nearly level; tilting both makes a tent-like peak).
        f'shoulder_{_s}': [f'shoulder01.{_s}'],
        f'upper_{_s}': [f'upperarm01.{_s}', f'upperarm02.{_s}'],
        f'fore_{_s}': [f'lowerarm01.{_s}', f'lowerarm02.{_s}'],
        f'hand_{_s}': [f'wrist.{_s}'],
        f'thigh_{_s}': [f'upperleg01.{_s}', f'upperleg02.{_s}'],
        f'shin_{_s}': [f'lowerleg01.{_s}', f'lowerleg02.{_s}'],
        f'foot_{_s}': [f'foot.{_s}'],
    })

ORDER = ['pelvis', 'spine', 'chest', 'neck', 'head']
for _s in ('L', 'R'):
    ORDER += [f'clav_{_s}', f'shoulder_{_s}', f'upper_{_s}', f'fore_{_s}', f'hand_{_s}', f'thigh_{_s}', f'shin_{_s}', f'foot_{_s}']

FINGERS = [f'finger{i}-1' for i in range(2, 6)]


def pose(rig, dirs, aim):
    """dirs[name] = [x, y, z] (+ optional twist degrees). `aim` points one bone (figure.aim)."""
    for pb in rig.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    for name in ORDER:
        if name in dirs:
            v = dirs[name]
            for bone in CHAINS[name]:
                aim(rig, bone, v[:3], v[3] if len(v) > 3 else 0.0)
    finish_pose(rig, any(k.startswith('shoulder_') for k in dirs))


def finish_pose(rig, shoulder_on):
    """After the bones are set: belly flattening, the opt-in shoulder smoothing, folded fingers."""
    bpy.context.view_layer.update()
    # Flatten the lower belly as the hips bend.
    body = next((c for c in rig.children if c.type == 'MESH'), None)
    if body is not None and body.data.shape_keys and 'belly_flat' in body.data.shape_keys.key_blocks:
        body.data.shape_keys.key_blocks['belly_flat'].value = _hip_flexion(rig)
    if body is not None and 'ShoulderSmooth' in body.modifiers:
        # Opt-in (poses that set shoulder_L/R), so already-approved renders stay reproducible.
        body.modifiers['ShoulderSmooth'].factor = _shoulder_elevation(rig) if shoulder_on else 0.0
        if os.environ.get('SHOULDER_DEBUG'):
            print('shoulder smooth', round(body.modifiers['ShoulderSmooth'].factor, 3))
    # Fold the fingers away: the sculpted clay fist (scene.fist) wraps the handle instead.
    for s in ('L', 'R'):
        for f in FINGERS + ['finger1-1']:
            pb = rig.pose.bones.get(f'{f}.{s}')
            if pb:
                pb.scale = (0.35, 0.35, 0.35)
    bpy.context.view_layer.update()


def pose_between(rig, basis_a, basis_b, t, shoulder_on):
    """Every bone part-way between two posed states (bone rotations slerped, locations lerped)."""
    for pb in rig.pose.bones:
        la, ra, sa = basis_a[pb.name].decompose()
        lb, rb, sb = basis_b[pb.name].decompose()
        from mathutils import Matrix
        pb.matrix_basis = Matrix.LocRotScale(la.lerp(lb, t), ra.slerp(rb, t), sa.lerp(sb, t))
    finish_pose(rig, shoulder_on)


def rest_hips(rig):
    """Rest position of the pelvis joint the pose files' `hips` refers to."""
    return rig.data.bones['spine05'].head_local.copy()


def hand_basis(rig, side):
    """Posed wrist, finger direction, palm normal, handle axis and grip centre for one hand."""
    mw = rig.matrix_world
    pb = rig.pose.bones
    wrist = mw @ pb[f'wrist.{side}'].head
    knuckle = mw @ pb[f'metacarpal3.{side}'].tail if f'metacarpal3.{side}' in pb else mw @ pb[f'wrist.{side}'].tail
    d = (knuckle - wrist).normalized()
    index = mw @ pb[f'finger2-1.{side}'].head
    pinky = mw @ pb[f'finger5-1.{side}'].head
    across = (index - pinky).normalized()
    s = 1 if side == 'L' else -1
    palm = d.cross(across).normalized() * s
    axis = d.cross(palm).normalized() * s
    grip = wrist + (knuckle - wrist) * 0.95 + palm * 0.03
    return wrist, d, palm, axis, grip
