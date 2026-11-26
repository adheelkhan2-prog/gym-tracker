// Short form cues per movement pattern, shown under each exercise in the workout. Written for this
// app from standard coaching cues (ExRx / NSCA technique guides listed in exercise-sources.md).
import type { ExerciseInfo, Pattern } from './exercises';

const TIPS: Record<Pattern, string[]> = {
  h_press: ['Pinch your shoulder blades together and keep them there.', 'Lower under control to mid-chest; elbows about 45° from your body.', 'Feet planted, press up and slightly back.'],
  incline_press: ['Keep your shoulder blades back and down against the bench.', 'Lower to your upper chest, not your neck.', 'Press up over your shoulders, without arching off the bench.'],
  v_press: ['Brace your abs and squeeze your glutes so your lower back stays neutral.', 'Press straight up, finishing with your biceps by your ears.', 'Lower to about chin height under control.'],
  fly: ['Keep a soft, fixed bend in your elbows the whole rep.', 'Open until you feel a stretch across your chest, no further.', 'Bring your hands together by squeezing your chest, not by bending your arms.'],
  dip: ['Lean slightly forward for more chest, stay upright for more triceps.', 'Lower until your upper arms are about parallel to the floor.', 'Keep your shoulders down, away from your ears.'],
  v_pull: ['Start each rep by pulling your shoulder blades down.', 'Pull your elbows down to your sides; the bar to your upper chest.', 'Control the way up until your arms are straight.'],
  h_pull: ['Keep your chest up and your back flat.', 'Drive your elbows back and squeeze your shoulder blades together.', 'Let your shoulders reach forward on the way back for a full stretch.'],
  pullover: ['Keep your arms nearly straight.', 'Move only at the shoulders; feel the stretch at the top.', 'Pull down with your lats until your hands reach your hips.'],
  shrug: ['Lift your shoulders straight up toward your ears; don’t roll them.', 'Pause for a second at the top.', 'Keep your arms long; don’t pull with your biceps.'],
  lat_raise: ['Lead with your elbows, slightly in front of your body.', 'Stop around shoulder height.', 'Light weight, slow lowering: no swinging.'],
  front_raise: ['Raise to shoulder height with a slight elbow bend.', 'Keep your torso still; don’t lean back.', 'Lower slowly.'],
  rear_delt: ['Hinge forward with a flat back (or use the pad).', 'Move your arms out wide, thumbs slightly down.', 'Squeeze at the top; don’t shrug.'],
  tri_ext: ['Keep your upper arms still; only the elbows move.', 'Lock out fully and squeeze your triceps.', 'Control the way back.'],
  tri_overhead: ['Keep your elbows pointing forward, close to your head.', 'Lower behind your head for a deep stretch.', 'Brace your abs so your back doesn’t arch.'],
  curl: ['Keep your elbows pinned at your sides.', 'Squeeze at the top; lower all the way to straight arms.', 'No swinging: if you have to swing, the weight is too heavy.'],
  hammer: ['Palms face each other the whole rep.', 'Elbows stay at your sides.', 'Lower slowly to full extension.'],
  wrist_flex: ['Rest your forearms on your thighs or a bench, wrists over the edge.', 'Use the full range: let the bar roll to your fingers, then curl up.', 'Light weight, high reps.'],
  wrist_ext: ['Forearms supported, palms down.', 'Lift the back of your hand up, pause, lower slowly.', 'Start light: the wrist extensors are small.'],
  carry: ['Stand tall, shoulders back and down.', 'Grip hard and walk with short, steady steps.', 'Don’t let the weight pull you sideways.'],
  squat: ['Brace your core before every rep.', 'Knees track over your toes; sit between your hips.', 'Keep your whole foot on the floor and drive up.'],
  lunge: ['Long enough step that your front shin stays roughly upright.', 'Lower straight down until your back knee nearly touches.', 'Push through your front heel.'],
  hinge: ['Push your hips back with a flat back.', 'Keep the weight close to your legs.', 'Stand up by squeezing your glutes; don’t lean back at the top.'],
  knee_ext: ['Line your knee up with the machine’s pivot.', 'Straighten fully and squeeze your quads.', 'Lower slowly.'],
  knee_flex: ['Line your knee up with the pivot; hips stay down.', 'Curl all the way and squeeze your hamstrings.', 'Control the way back to straight.'],
  hip_ext: ['Tuck your chin and ribs down.', 'Drive through your heels until your hips are fully straight.', 'Squeeze your glutes at the top for a second.'],
  calf: ['Full range: deep stretch at the bottom, high on your toes at the top.', 'Pause at the bottom; no bouncing.', 'Slow and controlled.'],
  core_flex: ['Curl your ribs toward your pelvis; don’t pull on your neck.', 'Breathe out as you crunch.', 'Slow on the way back.'],
  core_hip: ['Tilt your pelvis up; don’t just swing your legs.', 'Keep your lower back pressed down where you can.', 'Control the lowering.'],
  core_brace: ['Squeeze your glutes and brace as if about to be pushed.', 'Keep a straight line from head to heels.', 'Breathe steadily; stop when your form breaks.'],
};

const GENERAL = ['Leave 1–2 reps in the tank on most sets.'];

/** Form cues for an exercise (by its movement pattern), plus one general cue. */
export const tipsFor = (ex: Pick<ExerciseInfo, 'pattern'>) => [...(TIPS[ex.pattern] ?? []), ...GENERAL];
