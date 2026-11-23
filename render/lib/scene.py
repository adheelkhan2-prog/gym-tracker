"""Materials, equipment, lights, camera and render settings for the clay exercise renders."""
import math

import bpy
from mathutils import Vector

CLAY = (0.50, 0.50, 0.53, 1)
STEEL = (0.42, 0.43, 0.45, 1)
PAD = (0.30, 0.30, 0.32, 1)
LIME = (0.78, 1.0, 0.18)


def _principled(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = color
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m, b


def clay_material(mat, glow=None):
    """Turn a region's material into clay; `glow` = 'primary' | 'secondary' | None."""
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = CLAY
    b.inputs['Roughness'].default_value = 0.58
    b.inputs['Subsurface Weight'].default_value = 0.08
    b.inputs['Subsurface Radius'].default_value = (0.02, 0.012, 0.01)
    # Fine clay grain so surfaces don't look plastic.
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 420
    noise.inputs['Detail'].default_value = 4
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.06
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    if glow:
        primary = glow == 'primary'
        b.inputs['Base Color'].default_value = (0.85, 0.10, 0.05, 1) if primary else (0.92, 0.42, 0.30, 1)
        b.inputs['Emission Color'].default_value = (1.0, 0.07, 0.03, 1) if primary else (1.0, 0.32, 0.12, 1)
        b.inputs['Emission Strength'].default_value = 2.2 if primary else 0.7
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])


def _obj(name, mesh_fn, mat, **kw):
    mesh_fn(**kw)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    bev = o.modifiers.new('bevel', 'BEVEL')
    bev.width = 0.008
    bev.segments = 3
    return o


def box(name, center, size, mat):
    o = _obj(name, bpy.ops.mesh.primitive_cube_add, mat, location=center)
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o


def cyl(name, a, b, r, mat, verts=32):
    a, b = Vector(a), Vector(b)
    d = b - a
    o = _obj(name, bpy.ops.mesh.primitive_cylinder_add, mat, vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return o


def materials():
    steel, _ = _principled('steel', STEEL, 0.32, 0.6)
    pad, _ = _principled('pad', PAD, 0.7)
    frame, _ = _principled('frame', (0.50, 0.51, 0.53, 1), 0.45, 0.2)
    return {'steel': steel, 'pad': pad, 'frame': frame}


def dumbbell(name, center, axis, M, plate_r=0.075):
    """Hex-ish dumbbell: handle along `axis` (unit vector), two plate stacks."""
    c, ax = Vector(center), Vector(axis).normalized()
    cyl(f'{name}_handle', c - ax * 0.11, c + ax * 0.11, 0.016, M['steel'])
    for s in (-1, 1):
        cyl(f'{name}_plate{s}', c + ax * s * 0.085, c + ax * s * 0.15, plate_r, M['frame'])
        cyl(f'{name}_cap{s}', c + ax * s * 0.15, c + ax * s * 0.165, plate_r * 0.6, M['steel'])


def incline_bench(seat_z, seat_y, back_deg, floor_z, M, back_y=0.10):
    """Adjustable bench: seat pad, inclined back pad, steel frame down to the floor."""
    box('seat', (0, seat_y, seat_z - 0.04), (0.30, 0.36, 0.07), M['pad'])
    ang = math.radians(back_deg)  # from vertical
    length = 0.85
    base = Vector((0, seat_y + back_y, seat_z - 0.02))
    up = Vector((0, math.sin(ang), math.cos(ang)))
    pad = box('backpad', base + up * (length / 2) + Vector((0, 0.05 * math.cos(ang), -0.05 * math.sin(ang))), (0.30, 0.07, length), M['pad'])
    pad.rotation_euler = (-ang, 0, 0)
    # Frame
    cyl('rail', (0, seat_y - 0.30, floor_z + 0.04), (0, seat_y + 0.55, floor_z + 0.04), 0.03, M['frame'])
    for y in (seat_y - 0.30, seat_y + 0.55):
        cyl(f'foot{y:.2f}', (-0.22, y, floor_z + 0.03), (0.22, y, floor_z + 0.03), 0.03, M['frame'])
    cyl('post', (0, seat_y, floor_z + 0.04), (0, seat_y, seat_z - 0.08), 0.03, M['frame'])
    cyl('strut', (0, seat_y + 0.50, floor_z + 0.04), base + up * 0.45 + Vector((0, 0.06, 0)), 0.025, M['frame'])


def flat_seat(seat_z, seat_y, floor_z, M):
    box('seat', (0, seat_y, seat_z - 0.04), (0.36, 0.36, 0.07), M['pad'])
    cyl('post', (0, seat_y, floor_z + 0.04), (0, seat_y, seat_z - 0.08), 0.035, M['frame'])
    box('base', (0, seat_y, floor_z + 0.02), (0.5, 0.6, 0.04), M['frame'])


def lat_machine(seat_z, seat_y, floor_z, knee, bar_center, bar_half, M):
    """Seated lat pulldown: seat, knee pad, front column with a top beam, pulley, cable, bar and stack."""
    flat_seat(seat_z, seat_y, floor_z, M)
    kz, ky = knee
    cyl('kneepad', (-0.22, ky, kz), (0.22, ky, kz), 0.05, M['pad'])
    col_y = seat_y - 0.55
    box('column', (0, col_y, floor_z + 1.15), (0.12, 0.12, 2.3), M['frame'])
    cyl('kneearm', (0, col_y, kz), (0, ky, kz), 0.025, M['frame'])
    top = Vector((0, seat_y - 0.05, floor_z + 2.3))
    cyl('beam', (0, col_y, top.z), top, 0.04, M['frame'])
    cyl('pulley', top + Vector((-0.02, 0, -0.06)), top + Vector((0.02, 0, -0.06)), 0.06, M['steel'])
    b = Vector(bar_center)
    cyl('cable', top + Vector((0, 0, -0.1)), b, 0.006, M['steel'], verts=12)
    # Bar with angled ends
    cyl('bar', b - Vector((bar_half * 0.75, 0, 0)), b + Vector((bar_half * 0.75, 0, 0)), 0.016, M['steel'])
    for s in (-1, 1):
        cyl(f'barend{s}', b + Vector((s * bar_half * 0.75, 0, 0)), b + Vector((s * bar_half, 0, -0.08)), 0.016, M['steel'])
    box('stack', (0, col_y - 0.18, floor_z + 0.45), (0.28, 0.18, 0.8), M['frame'])


def floor(z):
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, z))
    f = bpy.context.active_object
    f.name = 'floor'
    f.is_shadow_catcher = True
    return f


def lights():
    def area(name, loc, target, power, size, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, 'AREA')
        d.energy = power
        d.size = size
        d.color = color
        o = bpy.data.objects.new(name, d)
        bpy.context.scene.collection.objects.link(o)
        o.location = loc
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = Vector((0, 0, -1)).rotation_difference((Vector(target) - Vector(loc)).normalized())
        return o

    area('key', (-2.2, -2.6, 3.2), (0, 0, 0.6), 170, 3.0)
    area('fill', (2.8, -1.8, 1.4), (0, 0, 0.6), 45, 3.0)
    area('top', (0, 0, 4.0), (0, 0, 0.6), 50, 4.0)
    # Lime rim from behind, to sit the figure on the app's black glass.
    # Soft lime rim. Light linking (set by render.py) keeps it off the equipment.
    rims = [area('rim_l', (-1.2, 3.2, 1.8), (0, 0, 0.8), 18, 1.6, LIME), area('rim_r', (1.4, 3.0, 1.4), (0, 0, 0.8), 12, 1.6, LIME)]
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.16, 0.16, 0.17, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.25
    bpy.context.scene.world = world
    return rims


def camera(target, azimuth, elevation, distance, lens=50):
    t = Vector(target)
    az, el = math.radians(azimuth), math.radians(elevation)
    loc = t + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * distance
    d = bpy.data.cameras.new('cam')
    d.lens = lens
    o = bpy.data.objects.new('cam', d)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = (t - loc).to_track_quat('-Z', 'Y')
    bpy.context.scene.camera = o
    return o


def settings(size, samples):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = -0.6
    sc.cycles.max_bounces = 6


def _ellipsoid(name, centre, axes, radii, mat):
    """UV sphere scaled along three orthonormal axes."""
    from mathutils import Matrix
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=centre)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    a, b, c = (Vector(v).normalized() for v in axes)
    m = Matrix((a * radii[0], b * radii[1], c * radii[2])).transposed().to_4x4()
    m.translation = Vector(centre)
    o.matrix_world = m
    return o


def _torus(name, centre, axis, major, minor, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=32, minor_segments=12, location=centre)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized())
    return o


def fist(name, wrist, d, palm, axis, grip, mat):
    """Sculpted clay fist closed around a handle at `grip` running along `axis`."""
    wrist, d, palm, axis, grip = (Vector(v) for v in (wrist, d, palm, axis, grip))
    # Palm and back of the hand, from the wrist to the knuckles.
    _ellipsoid(f'{name}_palm', wrist + d * 0.045 + palm * 0.006, (axis, d, palm), (0.042, 0.052, 0.022), mat)
    # Four fingers wrapped round the handle, slightly staggered like a real grip.
    for i, off in enumerate((-0.029, -0.0097, 0.0097, 0.029)):
        _torus(f'{name}_finger{i}', grip + axis * off - d * (0.002 * abs(off) / 0.01), axis, 0.026, 0.0122 - 0.0007 * i, mat)
    # Knuckle ridge so the fist reads as a fist from behind.
    _ellipsoid(f'{name}_knuckles', grip - palm * 0.012 + d * 0.006, (axis, d, palm), (0.045, 0.02, 0.018), mat)
    # Thumb over the front of the handle.
    tip = grip + palm * 0.027 + axis * 0.012
    base = wrist + d * 0.03 + palm * 0.012 + axis * 0.035
    mid = (tip + base) / 2
    _ellipsoid(f'{name}_thumb', mid, ((tip - base).normalized(), palm.cross(tip - base).normalized(), palm), ((tip - base).length / 2 + 0.01, 0.011, 0.011), mat)
