/** The workout's video players: only the current video and the next one, nothing else kept. */
import { plan } from '../components/videoPoolCore';
import { EXERCISE_VIDEO } from '../data/exercise-video';
import { howToImages } from '../data/how-to';

test('opening the workout: the current video at once, the next a moment later', () => {
  expect(plan([], 1, 2)).toEqual({ release: [], createNow: 1, createLater: 2 });
});
test('moving to the next page: its player is already there; the old one is released, the new next is made', () => {
  expect(plan([1, 2], 2, 3)).toEqual({ release: [1], createNow: null, createLater: 3 });
});
test('going back: the previous video gets a new player, the page you left stays as the next', () => {
  expect(plan([2, 3], 1, 2)).toEqual({ release: [3], createNow: 1, createLater: null });
});
test('jumping far releases both; a page with only stills holds nothing for itself; the last page has no next', () => {
  expect(plan([1, 2], 5, 6)).toEqual({ release: [1, 2], createNow: 5, createLater: 6 });
  expect(plan([1, 2], null, 3)).toEqual({ release: [1, 2], createNow: null, createLater: 3 });
  expect(plan([5, 6], 6, null)).toEqual({ release: [5], createNow: null, createLater: null });
});
test('file sources compare by path; the same video twice in a row shares one player', () => {
  expect(plan([{ uri: 'x' }], { uri: 'x' }, null)).toEqual({ release: [], createNow: null, createLater: null });
  expect(plan([], 4, 4)).toEqual({ release: [], createNow: 4, createLater: null });
});

test('every bundled video has a still to show while its player loads (no empty panel)', () => {
  const missing = Object.keys(EXERCISE_VIDEO).filter((id) => !howToImages(id)?.start);
  expect(missing).toEqual([]);
});
