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


def pose(rig, dirs):
    """dirs[bone] = [x, y, z] or [x, y, z, twist_degrees] (twist turns the bone about its own axis)."""
    makehuman.pose(rig, dirs, figure.aim)


def grip(rig, side):
    return makehuman.hand_basis(rig, side)[4]


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
        scene.settings(args.size, args.samples)
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
        for frame in args.frames.split(','):
            clear_props()
            before = {o.name for o in bpy.data.objects}
            dirs = mirrored({**spec.get('base', {}), **spec['frames'][frame]})
            pose(rig, dirs)
            floor_z = spec.get('floor', figure_min_z(body))
            setup = spec['setup']
            if setup == 'incline_bench':
                s = spec['bench']
                scene.incline_bench(s['seat_z'], s['seat_y'], s['back_deg'], floor_z, M, s.get('back_y', 0.10))
            elif setup == 'lat_machine':
                s = spec['machine']
                gl, gr = grip(rig, 'L'), grip(rig, 'R')
                c = (gl + gr) / 2
                scene.lat_machine(s['seat_z'], s['seat_y'], floor_z, s['knee'], c, max(0.55, (gl - gr).length / 2 + 0.12), M)
            # Clay fists closed around the handles (the model's own hands are only bones).
            hand_mat = bpy.data.materials.get('hand_clay')
            if hand_mat is None:
                hand_mat = bpy.data.materials.new('hand_clay')
                scene.clay_material(hand_mat)
            before_fists = {o.name for o in bpy.data.objects}
            for side in ('L', 'R'):
                wrist, d, palm, axis, g = makehuman.hand_basis(rig, side)
                scene.fist(f'fist_{side}', wrist, d, palm, axis, g, hand_mat)
            for o in bpy.data.objects:
                if o.name not in before_fists:
                    figure_coll.objects.link(o)
            props = spec.get('props')
            if props == 'dumbbells':
                for side in ('L', 'R'):
                    _, _, _, axis, centre = makehuman.hand_basis(rig, side)
                    scene.dumbbell(f'db_{side}', centre, axis, M)
            scene.floor(floor_z)
            tag_new(before)

            mn, mx = figure_bounds(body)
            target = Vector(cam_cfg.get('target', list((mn + mx) / 2)))
            for o in list(bpy.data.objects):
                if o.type == 'CAMERA':
                    bpy.data.objects.remove(o, do_unlink=True)
            scene.camera(target, cam_cfg['azimuth'], cam_cfg['elevation'], cam_cfg['distance'], cam_cfg.get('lens', 50))
            path = os.path.join(HERE, 'out', f'{ex_id}-{frame}.png')
            bpy.context.scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            print('wrote', path)
            write_body_mask(body, path)


if __name__ == '__main__':
    main()
