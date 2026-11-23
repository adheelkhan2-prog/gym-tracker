"""Turn the posed muscle pieces into ONE smooth clay mesh with a soft muscle glow.

1. Bake the posed figure (armature + shape keys) and the clay fists into one mesh.
2. Voxel-remesh it: every gap and crack between muscle shells closes into a single surface,
   while the muscle shapes stay as surface relief.
3. Smooth it (removes lumps, smooths knees and abs) without losing that relief.
4. Transfer the glow mask (red = primary, green = secondary muscles) from the original pieces
   onto the merged mesh, then blur it across the surface so the glow fades at the muscle's
   edges and is brightest in its centre.
"""
import bpy
import numpy as np

VOXEL = 0.005      # metres; small enough to keep muscle relief, big enough to close the cracks
SMOOTH_ITER = 14
INFLATE = 0.004    # metres; pieces are puffed out before the remesh so gaps up to ~8 mm weld shut


NORMAL_STRENGTH = 1.7   # baked muscle detail
CAVITY = 0.45           # how much ambient occlusion darkens the grooves between muscles

# Regions that map to thin bands on the MakeHuman body get widened by this many edge rings.
GROW = {'pec_major_upper': 3, 'lateral_delt': 1, 'posterior_delt': 1, 'brachialis': 1}


def set_glow_mask(body, glow):
    """Per-vertex 'glow' colour (R = primary, G = secondary) from the region ids, softened so it
    fades at each muscle's edges and is brightest in its centre."""
    me = body.data
    names = list(body['region_names'])
    idx = np.zeros(len(me.vertices), dtype=np.int32)
    me.attributes['region'].data.foreach_get('value', idx)
    m = np.zeros((len(me.vertices), 2), dtype=np.float32)
    for i, n in enumerate(names):
        role = glow.get(n)
        if role:
            ch = 0 if role == 'primary' else 1
            mask = (idx == i).astype(np.float32)[:, None]
            grow = GROW.get(n, 0)
            if grow:
                mask = _local_max(me, mask, grow)  # widen thin regions a little
            m[:, ch] = np.maximum(m[:, ch], mask[:, 0])
    # Blur amounts were tuned on a ~100k-vertex mesh; scale them to this mesh's density.
    f = max(0.25, (len(me.vertices) / 100000) ** 0.5) * 1.7
    soft = _blur(me, m, max(4, int(30 * f)))
    wide = _blur(me, soft, max(20, int(260 * f)))
    # Normalise per muscle (not globally) so small muscles glow as much as big ones.
    soft = soft / np.maximum(_local_max(me, soft, max(8, int(60 * f))), 1e-4)
    peak = wide / np.maximum(_local_max(me, wide, max(12, int(90 * f))), 1e-4)
    out = np.clip(soft * (0.2 + 0.8 * peak ** 2.0) * 1.15, 0, 1)
    out[m.sum(axis=1) == 0] *= 0.6  # let the glow spill only a little past the muscle
    vals = np.zeros((len(me.vertices), 4), dtype=np.float32)
    vals[:, :2] = out
    vals[:, 3] = 1
    attr = me.color_attributes.get('glow') or me.color_attributes.new('glow', 'FLOAT_COLOR', 'POINT')
    attr.data.foreach_set('color', vals.ravel())
    me.materials.clear()


def _blur(me, vals, iters):
    """Average each vertex with its neighbours `iters` times (Laplacian diffusion on the surface)."""
    e = np.zeros(len(me.edges) * 2, dtype=np.int32)
    me.edges.foreach_get('vertices', e)
    a, b = e[0::2], e[1::2]
    n = len(me.vertices)
    deg = np.bincount(a, minlength=n) + np.bincount(b, minlength=n)
    deg = np.maximum(deg, 1)[:, None]
    v = vals.copy()
    for _ in range(iters):
        acc = np.zeros_like(v)
        np.add.at(acc, a, v[b])
        np.add.at(acc, b, v[a])
        v = 0.4 * v + 0.6 * acc / deg
    return v


def _local_max(me, vals, iters):
    """Spread each vertex's maximum to its neighbours `iters` times (graph dilation)."""
    e = np.zeros(len(me.edges) * 2, dtype=np.int32)
    me.edges.foreach_get('vertices', e)
    a, b = e[0::2], e[1::2]
    v = vals.copy()
    for _ in range(iters):
        nxt = v.copy()
        np.maximum.at(nxt, a, v[b])
        np.maximum.at(nxt, b, v[a])
        v = nxt
    return v


def material(name='clay_glow', normal_image=None):
    """Clay with the glow read from the 'glow' attribute: red primary, orange secondary."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Roughness'].default_value = 0.6
    b.inputs['Subsurface Weight'].default_value = 0.06
    b.inputs['Subsurface Radius'].default_value = (0.02, 0.012, 0.01)
    attr = nt.nodes.new('ShaderNodeAttribute')
    attr.attribute_name = 'glow'
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(attr.outputs['Color'], sep.inputs['Color'])

    def math(op, a, bval=None):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation = op
        n.use_clamp = True
        for i, v in enumerate((a, bval)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    p = sep.outputs['Red']
    s = sep.outputs['Green']
    # Base colour: clay -> soft orange (secondary) -> red (primary)
    mix1 = nt.nodes.new('ShaderNodeMix')
    mix1.data_type = 'RGBA'
    mix1.inputs['A'].default_value = (0.50, 0.50, 0.52, 1)
    mix1.inputs['B'].default_value = (0.86, 0.42, 0.28, 1)
    nt.links.new(math('MULTIPLY', math('POWER', s, 1.1), 0.85), mix1.inputs['Factor'])
    mix2 = nt.nodes.new('ShaderNodeMix')
    mix2.data_type = 'RGBA'
    mix2.inputs['B'].default_value = (0.80, 0.09, 0.05, 1)
    nt.links.new(mix1.outputs['Result'], mix2.inputs['A'])
    nt.links.new(math('MULTIPLY', math('POWER', p, 1.3), 0.8), mix2.inputs['Factor'])
    # Cavity: local ambient occlusion darkens the grooves between muscles so they read at card size.
    ao = nt.nodes.new('ShaderNodeAmbientOcclusion')
    ao.only_local = True
    ao.inputs['Distance'].default_value = 0.035
    ao.samples = 8
    cav = nt.nodes.new('ShaderNodeMix')
    cav.data_type = 'RGBA'
    cav.blend_type = 'MULTIPLY'
    cav.inputs['Factor'].default_value = CAVITY
    nt.links.new(mix2.outputs['Result'], cav.inputs['A'])
    nt.links.new(ao.outputs['AO'], cav.inputs['B'])
    nt.links.new(cav.outputs['Result'], b.inputs['Base Color'])
    # Emission: stronger in the centre (power curve), so shading still shows the muscle's form.
    emc = nt.nodes.new('ShaderNodeMix')
    emc.data_type = 'RGBA'
    emc.inputs['A'].default_value = (1.0, 0.36, 0.14, 1)
    emc.inputs['B'].default_value = (1.0, 0.07, 0.03, 1)
    nt.links.new(math('POWER', p, 0.5), emc.inputs['Factor'])
    nt.links.new(emc.outputs['Result'], b.inputs['Emission Color'])
    strength = math('ADD', math('MULTIPLY', math('POWER', p, 2.2), 0.75), math('MULTIPLY', math('POWER', s, 2.2), 0.3))
    # Math clamps at 1; scale back up after.
    st = nt.nodes.new('ShaderNodeMath')
    st.operation = 'MULTIPLY'
    nt.links.new(strength, st.inputs[0])
    st.inputs[1].default_value = 1.6
    nt.links.new(st.outputs[0], b.inputs['Emission Strength'])
    # Fine clay grain
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 420
    noise.inputs['Detail'].default_value = 4
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.05
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    if normal_image is not None:
        # Muscle definition baked from the anatomy model (prepare_figure.py).
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = normal_image
        tex.interpolation = 'Cubic'
        uvn = nt.nodes.new('ShaderNodeUVMap')
        uvn.uv_map = 'UVMap'
        nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.space = 'TANGENT'
        nm.uv_map = 'UVMap'
        det = nt.nodes.new('ShaderNodeAttribute')
        det.attribute_name = 'detail'
        ns = nt.nodes.new('ShaderNodeMath')
        ns.operation = 'MULTIPLY'
        ns.inputs[1].default_value = NORMAL_STRENGTH
        nt.links.new(det.outputs['Fac'], ns.inputs[0])
        nt.links.new(ns.outputs[0], nm.inputs['Strength'])
        nt.links.new(tex.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bump.inputs['Normal'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    return m
