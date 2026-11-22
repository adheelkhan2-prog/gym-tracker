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
import figure  # noqa: E402
import scene  # noqa: E402

ORDER = ['pelvis', 'spine', 'chest', 'neck', 'head']
for side in ('L', 'R'):
    ORDER += [f'clav_{side}', f'upper_{side}', f'fore_{side}', f'hand_{side}', f'thigh_{side}', f'shin_{side}', f'foot_{side}']


def mirrored(dirs):
    """Fill in _R bones by mirroring _L ones across X unless given explicitly."""
    out = dict(dirs)
    for k, v in dirs.items():
        if k.endswith('_L'):
            out.setdefault(k[:-2] + '_R', [-v[0], v[1], v[2]])
    return out


def pose(rig, dirs):
    for pb in rig.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    for b in ORDER:
        if b in dirs:
            figure.aim(rig, b, dirs[b])


def grip(rig, side, t=0.55):
    h, tail = figure.bone_world(rig, f'hand_{side}')
    return h + (tail - h) * t


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
    ap.add_argument('--model', default=os.path.join(HERE, 'source', 'muscles-src.glb'))
    args = ap.parse_args(sys.argv[sys.argv.index(__file__) + 1:] if __file__ in sys.argv else sys.argv[1:])

    exercises = {e['id']: e for e in json.load(open(os.path.join(HERE, 'exercises.json')))}
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)

    for ex_id in args.ids:
        spec = json.load(open(os.path.join(HERE, 'poses', f'{ex_id}.json')))
        ex = exercises[ex_id]
        bpy.ops.wm.read_factory_settings(use_empty=True)
        body, rig, _ = figure.build(args.model)
        glow = {m: 'secondary' for m in ex['secondary']} | {m: 'primary' for m in ex['primary']}
        for mat in body.data.materials:
            scene.clay_material(mat, glow.get(mat.name))
        M = scene.materials()
        scene.lights()
        scene.settings(args.size, args.samples)
        glare()

        # Put the hips where the setup wants them (rest pelvis head is at J['pelvis']).
        rest_pelvis = Vector(figure.J['pelvis'])
        hips = Vector(spec.get('hips', list(rest_pelvis)))
        rig.location = hips - rest_pelvis

        cam_cfg = spec['camera']
        for frame in ('start', 'end'):
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
            props = spec.get('props')
            if props == 'dumbbells':
                for side in ('L', 'R'):
                    scene.dumbbell(f'db_{side}', grip(rig, side), spec['frames'][frame].get('db_axis', spec.get('db_axis', [1, 0, 0])), M)
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


if __name__ == '__main__':
    main()
