"""Render start/end clay images for exercises.

Usage (bpy as a Python module, Blender 5.3):
  python render/render.py incline_db_press lat_pulldown lateral_raise [--size 1024] [--samples 96]

Reads render/poses/<id>.json for the pose and setup, render/exercises.json for which muscles glow
(primary = strong red, secondary = softer orange), and writes render/out/<id>-start.png / -end.png
(transparent). render/to_webp.py turns them into the app's WebP files.
"""
import argparse
import json
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
import clay  # noqa: E402
import figure  # noqa: E402
import makehuman  # noqa: E402
import scene  # noqa: E402

ORDER = ['pelvis', 'spine', 'chest', 'neck', 'head']
for side in ('L', 'R'):
    ORDER += [f'clav_{side}', f'upper_{side}', f'fore_{side}', f'hand_{side}', f'thigh_{side}', f'shin_{side}', f'foot_{side}']


def mirrored(dirs):
    """Fill in _R bones by mirroring _L ones across X unless given explicitly."""
    out = dict(dirs)
    for k, v in dirs.items():
        if k.endswith('_L'):
            out.setdefault(k[:-2] + '_R', [-v[0], v[1], v[2], *(-x for x in v[3:])])
    return out


def video_frames(spec, n):
    """n frames looping start -> end -> start with an ease-in-out (slow at both ends, like a rep)."""
    import math
    s, e = spec['frames']['start'], spec['frames']['end']
    only = os.environ.get("VIDEO_ONLY")  # debug: render just these frame numbers
    keep = {int(x) for x in only.split(",")} if only else set(range(n))
    # The start/end specs ride along for the props (db_axis); the pose itself is blended per bone.
    return [(f"v{i:03d}", {**s, '_t': (1 - math.cos(2 * math.pi * i / n)) / 2}) for i in range(n) if i in keep]


def posed_state(rig, spec, frame, hips, rest_pelvis):
    """Pose one key frame exactly as the stills do; return (rig location, every bone's matrix_basis)."""
    fr = dict(spec['frames'][frame])
    fh = fr.pop('hips', None)
    loc = (Vector(fh) if fh else hips) - rest_pelvis
    rig.location = loc
    pose(rig, mirrored({**spec.get('base', {}), **fr}))
    return loc.copy(), {pb.name: pb.matrix_basis.copy() for pb in rig.pose.bones}


def pose(rig, dirs):
    """dirs[bone] = [x, y, z] or [x, y, z, twist_degrees] (twist turns the bone about its own axis)."""
    makehuman.pose(rig, dirs, figure.aim)


def grip(rig, side):
    return makehuman.hand_basis(rig, side)[4]


def anchor(rig, body, v, floor_z=0.0):
    """Resolve a position: [x, y, z], "@name", or {"at": "@name", "off": [dx, dy, dz]}.
    Names: grip, grip_L, grip_R, ankle_L, ankle_R, ankles, knees, hips, chest, neck, head."""
    if isinstance(v, dict):
        return anchor(rig, body, v['at'], floor_z) + Vector(v.get('off', (0, 0, 0)))
    if not isinstance(v, str):
        return Vector(v)
    mw = rig.matrix_world
    pb = rig.pose.bones
    name = v[1:]
    if name == 'grip':
        return (grip(rig, 'L') + grip(rig, 'R')) / 2
    if name in ('grip_L', 'grip_R'):
        return grip(rig, name[-1])
    if name in ('ankle_L', 'ankle_R'):
        return mw @ pb[f'foot.{name[-1]}'].head
    if name == 'ankles':
        return (mw @ pb['foot.L'].head + mw @ pb['foot.R'].head) / 2
    if name == 'knees':
        return (mw @ pb['lowerleg01.L'].head + mw @ pb['lowerleg01.R'].head) / 2
    if name == 'hips':
        return mw @ pb['spine05'].head
    if name == 'chest':
        return mw @ pb['spine01'].head
    if name == 'neck':
        return mw @ pb['neck01'].head
    if name == 'head':
        return mw @ pb['head'].tail
    if name == 'floor':
        return Vector((0, 0, floor_z))
    raise ValueError(v)


def build_equipment(items, rig, body, floor_z, M, cam_az=30.0):
    """Generic equipment pieces placed relative to the posed body (see poses/generate.py)."""
    A = lambda v: anchor(rig, body, v, floor_z)  # noqa: E731
    for it in items:
        t = it['type']
        if t == 'bench':
            scene.flat_bench(it['top_z'], it['y0'], it['y1'], floor_z, M)
        elif t == 'incline':
            scene.incline_bench(it['seat_z'], it['seat_y'], it['back_deg'], floor_z, M, it.get('back_y', 0.10))
        elif t == 'seat':
            h = A(it.get('at', '@hips'))
            top = h.z + it.get('dz', -0.11)
            scene.box('seatpad', (h.x, h.y + it.get('dy', 0.0), top - 0.04), (0.38, 0.38, 0.08), M['pad'])
            scene.cyl('seatpost', (h.x, h.y, floor_z), (h.x, h.y, top - 0.08), 0.035, M['frame'])
            scene.box('seatbase', (h.x, h.y, floor_z + 0.02), (0.5, 0.6, 0.04), M['frame'])
            if it.get('back'):
                scene.box('seatback', (h.x, h.y + 0.2, top + 0.3), (0.38, 0.07, 0.55), M['pad'])
        elif t == 'cable':
            a, b = A(it['from']), A(it['to'])
            if it.get('tower', True):
                tz = max(a.z + 0.15, 2.0)
                tx = a.x
                # A tower in line with the lifter would hide them: slide it sideways, away from the camera,
                # and reach the pulley with a short arm.
                if abs(a.x) < 0.25:
                    import math
                    tx = a.x - 0.4 * (1 if math.sin(math.radians(cam_az)) >= 0 else -1)
                    scene.cyl('pulleyarm', (tx, a.y, a.z), a, 0.03, M['frame'])
                scene.box('tower', (tx, a.y + (0.12 if a.y >= b.y else -0.12), (floor_z + tz) / 2), (0.24, 0.18, tz - floor_z), M['frame'])
            scene.cyl('pulley', a + Vector((-0.02, 0, 0)), a + Vector((0.02, 0, 0)), 0.045, M['steel'])
            scene.cyl('cable', a, b, 0.006, M['steel'], verts=12)
            hd = it.get('handle', 'bar')
            if hd == 'bar':
                gl, gr = A('@grip_L'), A('@grip_R')
                scene.cyl('cablebar', gl + (gl - gr).normalized() * 0.08, gr + (gr - gl).normalized() * 0.08, 0.014, M['steel'])
            elif hd == 'rope':
                for side in ('L', 'R'):
                    scene.cyl(f'rope{side}', b, A(f'@grip_{side}'), 0.012, M['pad'], verts=12)
        elif t == 'bar':
            c = A(it.get('at', '@grip'))
            half = it.get('half', 0.6)
            scene.cyl('fixedbar', c - Vector((half, 0, 0)), c + Vector((half, 0, 0)), 0.016, M['steel'])
            if it.get('posts', True):
                for sgn in (-1, 1):
                    scene.cyl(f'barpost{sgn}', (c.x + sgn * half, c.y, floor_z), (c.x + sgn * half, c.y, c.z + 0.03), 0.03, M['frame'])
        elif t == 'dip_bars':
            for side in ('L', 'R'):
                g = A(f'@grip_{side}')
                scene.cyl(f'dip{side}', g - Vector((0, 0.3, 0)), g + Vector((0, 0.25, 0)), 0.022, M['steel'])
                for dy in (-0.25, 0.2):
                    scene.cyl(f'dippost{side}{dy}', (g.x, g.y + dy, floor_z), (g.x, g.y + dy, g.z), 0.025, M['frame'])
        elif t == 'box':
            c = A(it['center'])
            scene.box(it.get('name', 'box'), c, it['size'], M[it.get('mat', 'pad')])
        elif t == 'roller':
            c = A(it['at'])
            scene.cyl('roller', c - Vector((0.18, 0, 0)), c + Vector((0.18, 0, 0)), 0.045, M['pad'])
        elif t == 'post':
            c = A(it['at'])
            scene.cyl('post', (c.x, c.y, floor_z), (c.x, c.y, c.z), it.get('r', 0.035), M['frame'])
        elif t == 'plate':
            c = A(it['at'])
            n = Vector(it['normal']).normalized()
            o = scene.box('sledplate', c, (0.55, 0.035, 0.5), M['frame'])
            o.rotation_mode = 'QUATERNION'
            o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(n)
        elif t == 'line':
            scene.cyl(it.get('name', 'rail'), A(it['from']), A(it['to']), it.get('r', 0.03), M['frame'])
        elif t == 'handles':
            # Machine grips: a short bar through each closed hand, plus a lever arm to its pivot.
            for side in ('L', 'R'):
                _, _, _, axis, g = makehuman.hand_basis(rig, side)
                scene.cyl(f'grip{side}', g - axis * 0.075, g + axis * 0.075, 0.017, M['steel'])
                if 'pivot' in it:
                    pv = dict(it['pivot'])
                    if side == 'R' and isinstance(pv.get('off'), list):
                        pv['off'] = [-pv['off'][0], pv['off'][1], pv['off'][2]]
                    pvt = A(pv)
                    scene.cyl(f'lever{side}', pvt, g, 0.028, M['frame'])
                    scene.cyl(f'pivotpost{side}', (pvt.x, pvt.y, floor_z), pvt, 0.04, M['frame'])
        elif t == 'mat':
            h = A('@hips')
            scene.box('mat', (h.x, h.y, floor_z + 0.008), (0.7, 1.9, 0.016), M['pad'])


def build_props(props, rig, M, db_axis=None):
    if not props:
        return
    gl, gr = grip(rig, 'L'), grip(rig, 'R')
    if props in ('barbell', 'ez', 'ez_small', 'bar_only'):
        half = max(0.45 if props == 'barbell' else 0.32, (gl - gr).length / 2 + 0.12)
        plates = {'barbell': (0.225, 0.2), 'ez': (0.17, 0.14), 'ez_small': (0.1, 0.08), 'bar_only': ()}[props]
        scene.barbell('bb', (gl + gr) / 2, half, M, plates=plates)
    elif props == 'ez_zig':
        scene.ez_bar('ez', [(makehuman.hand_basis(rig, sd)[4], makehuman.hand_basis(rig, sd)[3]) for sd in ('L', 'R')], M)
    elif props == 'dumbbells':
        for side in ('L', 'R'):
            _, _, _, axis, centre = makehuman.hand_basis(rig, side)
            scene.dumbbell(f'db_{side}', centre, db_axis or axis, M)
    elif props in ('dumbbell_L', 'dumbbell_R'):
        _, _, _, axis, centre = makehuman.hand_basis(rig, props[-1])
        scene.dumbbell('db', centre, axis, M)
    elif props == 'dumbbell_single':
        c = (gl + gr) / 2
        scene.dumbbell('db', c, (0, 0, 1), M, plate_r=0.08)
    elif props == 'plate':
        c = (gl + gr) / 2
        scene.cyl('heldplate', c - Vector((0, 0.02, 0)), c + Vector((0, 0.02, 0)), 0.2, M['frame'], verts=48)
    elif props == 'trap_bar':
        c = (gl + gr) / 2
        w = (gl - gr).length / 2 + 0.05
        for sgn in (-1, 1):
            scene.cyl(f'tbside{sgn}', c + Vector((sgn * w, -0.3, 0)), c + Vector((sgn * w, 0.3, 0)), 0.016, M['steel'])
            scene.cyl(f'tbend{sgn}', c + Vector((-w, sgn * 0.3, 0)), c + Vector((w, sgn * 0.3, 0)), 0.016, M['steel'])
            scene.cyl(f'tbsleeve{sgn}', c + Vector((sgn * w, 0, 0)), c + Vector((sgn * (w + 0.35), 0, 0)), 0.016, M['steel'])
            a = c + Vector((sgn * (w + 0.12), 0, 0))
            scene.cyl(f'tbplate{sgn}', a, a + Vector((sgn * 0.05, 0, 0)), 0.225, M['frame'], verts=48)


def clear_props():
    for o in list(bpy.data.objects):
        if o.get('prop'):
            bpy.data.objects.remove(o, do_unlink=True)


def tag_new(before):
    for o in bpy.data.objects:
        if o.name not in before:
            o['prop'] = True


def figure_min_z(body):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    z = min((ev.matrix_world @ v.co).z for v in me.vertices)
    ev.to_mesh_clear()
    return z


def figure_bounds(body):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    pts = [ev.matrix_world @ v.co for i, v in enumerate(me.vertices) if i % 7 == 0]
    ev.to_mesh_clear()
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def write_body_mask(body, path):
    """Cheap extra render: alpha = where the BODY is visible (equipment held out, so anything in
    front of the body cuts it away). check_renders.py only inspects these pixels."""
    sc = bpy.context.scene
    saved = (sc.cycles.samples, sc.cycles.use_denoising, sc.render.filepath)
    others = [o for o in bpy.data.objects if o.type == 'MESH' and o is not body and not o.name.startswith('fist_')
              and not o.get('fist')]
    for o in others:
        o.is_holdout = True
    sc.cycles.samples = 1
    sc.cycles.use_denoising = False
    sc.render.filepath = path[:-4] + '.mask.png'
    bpy.ops.render.render(write_still=True)
    for o in others:
        o.is_holdout = False
    sc.cycles.samples, sc.cycles.use_denoising, sc.render.filepath = saved


def glare():
    """Soft bloom around the glowing muscles (Blender 5 compositor)."""
    sc = bpy.context.scene
    try:
        tree = bpy.data.node_groups.new('comp', 'CompositorNodeTree')
        sc.compositing_node_group = tree
        rl = tree.nodes.new('CompositorNodeRLayers')
        g = tree.nodes.new('CompositorNodeGlare')
        out = tree.nodes.new('NodeGroupOutput')
        tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        for name, val in (('Type', 'Fog Glow'), ('Quality', 'High')):
            if name in g.inputs:
                g.inputs[name].default_value = val
        for name, val in (('Threshold', 1.0), ('Strength', 0.55), ('Size', 0.6)):
            if name in g.inputs:
                g.inputs[name].default_value = val
        tree.links.new(rl.outputs['Image'], g.inputs['Image'])
        tree.links.new(g.outputs['Image'], out.inputs[0])
        return True
    except Exception as e:  # compositor API differs between versions; renders still work without bloom
        print('glare skipped:', e)
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ids', nargs='+')
    ap.add_argument('--size', type=int, default=1024)
    ap.add_argument('--samples', type=int, default=96)
    ap.add_argument('--cam', help='debug override: "x,y,z,azimuth,elevation,distance"')
    ap.add_argument('--frames', default='start,end')
    ap.add_argument('--model', default=os.path.join(HERE, 'source', 'muscles-src.glb'))
    ap.add_argument('--video', type=int, default=0, help='render N looping frames (start -> end -> start) instead of stills')
    ap.add_argument('--engine', choices=('cycles', 'eevee'), default='cycles')
    args = ap.parse_args(sys.argv[sys.argv.index(__file__) + 1:] if __file__ in sys.argv else sys.argv[1:])

    exercises = {e['id']: e for e in json.load(open(os.path.join(HERE, 'exercises.json')))}
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)

    for ex_id in args.ids:
        spec = json.load(open(os.path.join(HERE, 'poses', f'{ex_id}.json')))
        ex = exercises[ex_id]
        bpy.ops.wm.read_factory_settings(use_empty=True)
        body, rig = makehuman.build()
        glow = {m: 'secondary' for m in ex['secondary']} | {m: 'primary' for m in ex['primary']}
        if 'region' in body.data.attributes:
            clay.set_glow_mask(body, glow)
        body.data.materials.append(clay.material(normal_image=makehuman.normal_map()))
        M = scene.materials()
        rims = scene.lights()
        figure_coll = bpy.data.collections.new('figure_only')
        figure_coll.objects.link(body)
        for r in rims:
            r.light_linking.receiver_collection = figure_coll
        scene.settings(args.size, args.samples, args.engine)
        glare()

        # Put the hips where the setup wants them (rest pelvis head is at J['pelvis']).
        rest_pelvis = makehuman.rest_hips(rig)
        hips = Vector(spec.get('hips', list(rest_pelvis)))
        rig.location = hips - rest_pelvis

        cam_cfg = spec['camera']
        if args.cam:
            x, y, z, az, el, dist = map(float, args.cam.split(','))
            cam_cfg = {'target': [x, y, z], 'azimuth': az, 'elevation': el, 'distance': dist, 'lens': 50}
        # The lime rim sits behind the figure; on back views it would face the camera and tint the
        # back green, so it is switched off there.
        if abs(((cam_cfg['azimuth'] + 180) % 360) - 180) > 100:
            from mathutils import Matrix
            for r in rims:
                r.data.energy = 0
            # Turn the key/fill/top lights round so the back (the side we see) is modelled by light.
            flip = Matrix.Rotation(3.14159265, 4, 'Z')
            bpy.context.view_layer.update()
            for o in bpy.data.objects:
                if o.type == 'LIGHT' and o not in rims:
                    o.matrix_world = flip @ o.matrix_world
        shared_target = None
        shared_floor = None
        if args.video:
            jobs = video_frames(spec, args.video)
            # Both key frames posed exactly like the stills; every video frame is a smooth blend of
            # the two (bone rotations slerped), so frame 0 IS the start image and the middle IS the end.
            key_a = posed_state(rig, spec, 'start', hips, rest_pelvis)
            key_b = posed_state(rig, spec, 'end', hips, rest_pelvis)
            shoulder_on = any(k.startswith('shoulder_') for f in ('start', 'end') for k in {**spec.get('base', {}), **spec['frames'][f]})
            os.makedirs(os.path.join(HERE, 'out', 'video', ex_id), exist_ok=True)
        else:
            jobs = [(f, spec['frames'][f]) for f in args.frames.split(',')]
        for frame, frame_spec in jobs:
            clear_props()
            before = {o.name for o in bpy.data.objects}
            fr = dict(frame_spec)
            fh = fr.pop('hips', None)
            t = fr.pop('_t', None)
            if t is not None:
                rig.location = key_a[0].lerp(key_b[0], t)
                makehuman.pose_between(rig, key_a[1], key_b[1], t, shoulder_on)
            else:
                rig.location = (Vector(fh) if fh else hips) - rest_pelvis
                pose(rig, mirrored({**spec.get('base', {}), **fr}))
            floor_z = spec.get('floor', shared_floor if shared_floor is not None else figure_min_z(body))
            if args.video and shared_floor is None:
                # The start frame's floor for the whole loop, so the floor never jumps between frames.
                shared_floor = spec.get('floor', figure_min_z(body))
            setup = spec['setup']
            if setup == 'incline_bench':
                s = spec['bench']
                scene.incline_bench(s['seat_z'], s['seat_y'], s['back_deg'], floor_z, M, s.get('back_y', 0.10))
            elif setup == 'lat_machine':
                s = spec['machine']
                gl, gr = grip(rig, 'L'), grip(rig, 'R')
                c = (gl + gr) / 2
                scene.lat_machine(s['seat_z'], s['seat_y'], floor_z, s['knee'], c, max(0.55, (gl - gr).length / 2 + 0.12), M)
            elif setup == 'flat_bench':
                s = spec['bench']
                scene.flat_bench(s['top_z'], s['y0'], s['y1'], floor_z, M)
                if spec.get('uprights'):
                    scene.bench_uprights(s['y1'] - 0.18, s['top_z'] + 0.55, floor_z, 0.55, M)
            elif setup == 'cable_row':
                s = spec['row']
                gl, gr = grip(rig, 'L'), grip(rig, 'R')
                scene.cable_row(s['seat_z'], s['seat_y'], s['foot_y'], floor_z, (gl + gr) / 2, M)
            if spec.get('equipment'):
                build_equipment(spec['equipment'], rig, body, floor_z, M, cam_cfg['azimuth'])
            # Clay fists closed around the handles (the model's own hands are only bones).
            hand_mat = bpy.data.materials.get('hand_clay')
            if hand_mat is None:
                hand_mat = bpy.data.materials.new('hand_clay')
                scene.clay_material(hand_mat)
            before_fists = {o.name for o in bpy.data.objects}
            for side in spec.get('fists', ['L', 'R']):
                wrist, d, palm, axis, g = makehuman.hand_basis(rig, side)
                scene.fist(f'fist_{side}', wrist, d, palm, axis, g, hand_mat)
            for o in bpy.data.objects:
                if o.name not in before_fists:
                    figure_coll.objects.link(o)
            build_props(spec.get('props'), rig, M, frame_spec.get('db_axis') or spec['frames']['start'].get('db_axis') or spec.get('db_axis'))
            scene.floor(floor_z)
            tag_new(before)

            # Frame both positions the same way: aim at the first frame's figure centre.
            mn, mx = figure_bounds(body)
            if shared_target is None:
                shared_target = Vector(cam_cfg.get('target', list((mn + mx) / 2)))
            target = shared_target
            for o in list(bpy.data.objects):
                if o.type == 'CAMERA':
                    bpy.data.objects.remove(o, do_unlink=True)
            scene.camera(target, cam_cfg['azimuth'], cam_cfg['elevation'], cam_cfg['distance'], cam_cfg.get('lens', 50))
            path = os.path.join(HERE, 'out', 'video', ex_id, f'{frame}.png') if args.video else os.path.join(HERE, 'out', f'{ex_id}-{frame}.png')
            bpy.context.scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            print('wrote', path)
            if not args.video:
                write_body_mask(body, path)


if __name__ == '__main__':
    main()
