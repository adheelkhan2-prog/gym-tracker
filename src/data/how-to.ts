import { EXERCISE_3D } from './exercise-3d';
import { EXERCISE_IMAGES } from './exercise-images';

/** The How to images for an exercise: the approved clay render, else the free-exercise-db photo. */
export function howToImages(id: string) {
  const clay = EXERCISE_3D[id];
  return clay ? { ...clay, clay: true } : EXERCISE_IMAGES[id] ? { ...EXERCISE_IMAGES[id], clay: false } : undefined;
}
