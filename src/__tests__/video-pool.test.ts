/** The workout's two video players: current + preloaded next, nothing else kept. */
import { assign } from '../components/videoPool';

test('first page: current in one player, next preloading in the other', () => {
  expect(assign({ a: null, b: null }, 1, 2)).toEqual({ a: 1, b: 2 });
});
test('moving to the preloaded next: it stays where it is (no reload) and the old one makes way for the new next', () => {
  expect(assign({ a: 1, b: 2 }, 2, 3)).toEqual({ a: 3, b: 2 });
  expect(assign({ a: 3, b: 2 }, 3, 4)).toEqual({ a: 3, b: 4 });
});
test('going back reuses whichever player still has it; otherwise loads it', () => {
  expect(assign({ a: 3, b: 2 }, 2, 3)).toEqual({ a: 3, b: 2 });
  expect(assign({ a: 3, b: 4 }, 1, 2)).toEqual({ a: 1, b: 2 });
});
test('no video on a page (a still image): nothing is held for it; the last page has no next', () => {
  expect(assign({ a: 1, b: 2 }, null, 3)).toEqual({ a: 3, b: 2 });
  expect(assign({ a: 5, b: 6 }, 6, null)).toEqual({ a: null, b: 6 });
  expect(assign({ a: 1, b: { uri: 'x' } }, { uri: 'x' }, null)).toEqual({ a: null, b: { uri: 'x' } });
});
