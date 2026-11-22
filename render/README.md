# Clay exercise renders

Headless Blender (bpy 5.3) pipeline that renders each exercise's START and END position as a light-grey
clay anatomy figure on grey equipment, with the worked muscles glowing (primary = strong red,
secondary = softer orange), soft studio light and a lime rim light, on a transparent background.

```bash
pip install bpy==5.3.0 pillow            # Python 3.13
node render/export-exercises.cjs         # muscles per exercise -> render/exercises.json
python render/render.py incline_db_press lat_pulldown lateral_raise --size 1024 --samples 96
python3 render/to_webp.py                # render/out/*.png -> assets/exercises-3d/*.webp
```

- `lib/figure.py`: imports the muscle model, joins it with one material per muscle region (the glow
  masks), builds an armature and skins it (distance-based weights with per-region bone limits).
- `lib/scene.py`: clay/glow materials, procedural bench, dumbbells and lat machine, lights, camera.
- `poses/<id>.json`: setup, hips position, camera, and bone directions for `start` and `end`
  (world space; the figure faces -Y, its left is +X; `_R` bones mirror `_L` unless given).
- Masks: the region names are the app's `MuscleId`s (src/data/muscles.ts), so an exercise's
  primary/secondary lists drive the glow directly.

Render time on 4 CPU cores: about 100 s per 1024 px image at 96 samples.
