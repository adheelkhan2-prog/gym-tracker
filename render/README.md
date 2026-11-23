# Clay exercise renders

Headless Blender (bpy 5.3) pipeline that renders each exercise's START and END position as a light-grey
clay anatomy figure on grey equipment, with the worked muscles glowing (primary = strong red,
secondary = softer orange), soft studio light and a lime rim light, on a transparent background.

```bash
pip install bpy==5.3.0 pillow            # Python 3.13
node render/export-exercises.cjs         # muscles per exercise -> render/exercises.json
python render/prepare_figure.py          # once: bake muscle detail + regions onto the body
python render/render.py incline_db_press lat_pulldown lateral_raise --size 1024 --samples 96
python render/check_renders.py render/out/*.png   # dark holes / streaks check
python render/to_webp.py                 # passing render/out/*.png -> assets/exercises-3d/*.webp (on black)
```

- `lib/makehuman.py`: the posed BODY. MakeHuman base mesh (CC0, vendored in `source/makehuman`) with
  muscular shape targets, its standard rig and skin weights, and a subdivision surface. It bends
  cleanly (seated poses, raised arms) because it is one continuous, properly weighted surface.
- `prepare_figure.py` (run once): bakes the anatomy model onto the MakeHuman body in the rest pose:
  muscle surface detail as a normal map, and muscle region ids via Data Transfer (nearest surface).
  Writes `cache/muscle_normal.png` and `cache/regions.json`; renders only read them.
- `lib/figure.py`: the anatomy model (bake source) and the bone-aiming helper used for posing.
- `check_renders.py`: flags dark holes/cracks/streaks on the body; `to_webp.py` refuses any image
  that fails, so broken renders never reach the app.
- `lib/scene.py`: clay/glow materials, procedural bench, dumbbells and lat machine, lights, camera.
- `poses/<id>.json`: setup, hips position, camera, and bone directions for `start` and `end`
  (world space; the figure faces -Y, its left is +X; `_R` bones mirror `_L` unless given).
- Masks: the region names are the app's `MuscleId`s (src/data/muscles.ts), so an exercise's
  primary/secondary lists drive the glow directly.

Render time on 4 CPU cores: about 100 s per 1024 px image at 96 samples.
