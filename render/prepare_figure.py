"""One-time bake of the anatomy model onto the MakeHuman body (rest pose).

  python render/prepare_figure.py            # writes render/cache/muscle_normal.png + regions.json

1. Build the smooth anatomy figure (CC BY-SA muscle model, see asset-licences.md) and pose its
   limbs to match the MakeHuman A-pose, scaled to the same height.
2. Muscle region IDs -> MakeHuman vertex groups with a Data Transfer modifier (nearest surface),
   stored per base-mesh vertex in regions.json (region name and weight).
3. Muscle surface detail -> tangent-space normal map: Cycles "selected to active" bake from the
   anatomy surface onto the MakeHuman UVs.
render.py loads both caches, so exercises never re-bake.
"""
import json
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
import figure  # noqa: E402
import makehuman  # noqa: E402

CACHE = os.path.join(HERE, 'cache')
NORMAL_SIZE = 2048


def mh_dir(rig, a, b, a_end='head', b_end='tail'):
    pa = getattr(rig.data.bones[a], f'{a_end}_local')
    pb = getattr(rig.data.bones[b], f'{b_end}_local')
    return list((pb - pa).normalized())


def main():
    os.makedirs(CACHE, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # The anatomy figure first: its build joins every mesh in the scene.
    anat, anat_rig, names = figure.build(os.path.join(HERE, 'source', 'muscles-src.glb'))
    mh, mh_rig = makehuman.build()
    sub = mh.modifiers.get('Subdivide')
    sub.show_viewport = sub.show_render = False  # bake and transfer on the base mesh
    # Match height and position: scale the anatomy rig about its pelvis to MakeHuman's size.
    def zrange(o):
        dg = bpy.context.evaluated_depsgraph_get()
        ev = o.evaluated_get(dg)
        m = ev.to_mesh()
        zs = [(ev.matrix_world @ v.co).z for v in m.vertices]
        ev.to_mesh_clear()
        return min(zs), max(zs)
    a0, a1 = zrange(anat)
    m0, m1 = zrange(mh)
    k = (m1 - m0) / (a1 - a0)
    anat_rig.scale = (k, k, k)
    anat_rig.location = (0, 0, m0 - a0 * k)
    bpy.context.view_layer.update()

    # Match torso depth too (the anatomy model is deeper front-to-back than MakeHuman), using the
    # trunk between the hips and the shoulders.
    def yrange(o):
        dg = bpy.context.evaluated_depsgraph_get()
        ev = o.evaluated_get(dg)
        m = ev.to_mesh()
        ys = [p.y for p in (ev.matrix_world @ v.co for v in m.vertices) if abs(p.x) < 0.12 and 0.1 < p.z < 0.45]
        ev.to_mesh_clear()
        return min(ys), max(ys)
    ay0, ay1 = yrange(anat)
    my0, my1 = yrange(mh)
    ky = (my1 - my0) / (ay1 - ay0)
    anat_rig.scale = (k, k * ky, k)
    bpy.context.view_layer.update()
    ay0, ay1 = yrange(anat)
    anat_rig.location.y += ((my0 + my1) - (ay0 + ay1)) / 2
    bpy.context.view_layer.update()
    print('align: height scale', round(k, 3), 'depth scale', round(ky, 3))

    # Pose the anatomy limbs along the MakeHuman bones.
    dirs = {}
    for s in ('L', 'R'):
        dirs[f'clav_{s}'] = mh_dir(mh_rig, f'clavicle.{s}', f'shoulder01.{s}')
        dirs[f'upper_{s}'] = mh_dir(mh_rig, f'upperarm01.{s}', f'upperarm02.{s}')
        dirs[f'fore_{s}'] = mh_dir(mh_rig, f'lowerarm01.{s}', f'lowerarm02.{s}')
        dirs[f'hand_{s}'] = mh_dir(mh_rig, f'wrist.{s}', f'metacarpal3.{s}')
        dirs[f'thigh_{s}'] = mh_dir(mh_rig, f'upperleg01.{s}', f'upperleg02.{s}')
        dirs[f'shin_{s}'] = mh_dir(mh_rig, f'lowerleg01.{s}', f'lowerleg02.{s}')
    order = []
    for s in ('L', 'R'):
        order += [f'clav_{s}', f'upper_{s}', f'fore_{s}', f'hand_{s}', f'thigh_{s}', f'shin_{s}']
    for b in order:
        figure.aim(anat_rig, b, dirs[b])
    # Undo the hand tuck: bake needs the anatomy hands in place.
    if anat.data.shape_keys:
        anat.data.shape_keys.key_blocks['fist'].value = 0.0
    bpy.context.view_layer.update()

    # Freeze the posed anatomy into a plain mesh with one vertex group per muscle region.
    dg = bpy.context.evaluated_depsgraph_get()
    src_me = bpy.data.meshes.new_from_object(anat.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    src = bpy.data.objects.new('anatomy_src', src_me)
    bpy.context.scene.collection.objects.link(src)
    src.matrix_world = anat.matrix_world.copy()
    idx = [0] * len(src_me.vertices)
    src_me.attributes['region'].data.foreach_get('value', idx)
    groups = {}
    for i, n in enumerate(names):
        members = [v for v, r in enumerate(idx) if r == i]
        if members:
            g = src.vertex_groups.new(name=f'R_{n}')
            g.add(members, 1.0, 'REPLACE')
            groups[n] = g
    bpy.data.objects.remove(anat, do_unlink=True)
    anat_rig.hide_render = True

    # Region IDs -> MakeHuman with Data Transfer (nearest surface, interpolated).
    for n in groups:
        mh.vertex_groups.new(name=f'R_{n}')
    dt = mh.modifiers.new('regions', 'DATA_TRANSFER')
    dt.object = src
    dt.use_object_transform = True
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = mh
    mh.select_set(True)
    bpy.ops.object.modifier_move_to_index(modifier='regions', index=0)
    bpy.ops.object.modifier_apply(modifier='regions')
    region_of = {}
    for v in mh.data.vertices:
        best, bw = None, 0.0
        for ge in v.groups:
            gname = mh.vertex_groups[ge.group].name
            if gname.startswith('R_') and ge.weight > bw:
                best, bw = gname[2:], ge.weight
        if best:
            region_of[v.index] = best
    json.dump({'names': names, 'region': region_of}, open(os.path.join(CACHE, 'regions.json'), 'w'))
    print('regions for', len(region_of), 'of', len(mh.data.vertices), 'vertices')

    # Muscle surface detail -> tangent-space normal map (selected to active).
    img = bpy.data.images.new('muscle_normal', NORMAL_SIZE, NORMAL_SIZE, alpha=False, float_buffer=False)
    # Neutral "flat" normal everywhere first: texels a ray can't resolve stay flat instead of black.
    img.generated_color = (0.5, 0.5, 1.0, 1.0)
    img.colorspace_settings.name = 'Non-Color'
    mat = bpy.data.materials.new('bake')
    mat.use_nodes = True
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    mat.node_tree.nodes.active = node
    mh.data.materials.clear()
    mh.data.materials.append(mat)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 1
    bpy.ops.object.select_all(action='DESELECT')
    src.select_set(True)
    mh.select_set(True)
    bpy.context.view_layer.objects.active = mh
    bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_selected_to_active=True,
                        cage_extrusion=0.04, max_ray_distance=0.09, margin=16)
    # Clean up: a tangent normal tilted more than ~60 degrees is a bake miss (ray hit the wrong
    # surface), not muscle detail; fade those texels back towards flat so they can't render dark.
    import numpy as np
    px = np.empty(NORMAL_SIZE * NORMAL_SIZE * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    nz = px[:, 2] * 2 - 1
    bad = np.clip((0.6 - nz) / 0.25, 0, 1)[:, None]
    px[:, :3] = px[:, :3] * (1 - bad) + np.array([0.5, 0.5, 1.0]) * bad
    img.pixels.foreach_set(px.ravel())
    print('cleaned', int((bad[:, 0] > 0).sum()), 'texels')
    img.filepath_raw = os.path.join(CACHE, 'muscle_normal.png')
    img.file_format = 'PNG'
    img.save()
    print('baked', img.filepath_raw)


if __name__ == '__main__':
    main()
