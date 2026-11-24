/** Own exercise videos: the loop you trim (start/length rules) and old saves without trims. */
import { clampTrim, defaultTrim, MAX_LOOP } from '../ownVideo';
import { DEFAULT_STATE, migrate } from '../store';

test('a new clip loops its first 6 s (or all of a shorter clip)', () => {
  expect(defaultTrim(20)).toEqual({ start: 0, end: MAX_LOOP });
  expect(defaultTrim(3.2)).toEqual({ start: 0, end: 3 });
  expect(defaultTrim(undefined)).toEqual({ start: 0, end: MAX_LOOP });
});

test('trim stays inside the clip, 1–6 s long, in 0.5 s steps', () => {
  expect(clampTrim(2, 4, 20)).toEqual({ start: 2, end: 6 });
  expect(clampTrim(18, 6, 20)).toEqual({ start: 14, end: 20 }); // start pulled back so the loop fits
  expect(clampTrim(0, 10, 20)).toEqual({ start: 0, end: 6 }); // max 6 s
  expect(clampTrim(0, 0.2, 20)).toEqual({ start: 0, end: 1 }); // min 1 s
  expect(clampTrim(-3, 3, 20)).toEqual({ start: 0, end: 3 });
  expect(clampTrim(1.26, 2, 10)).toEqual({ start: 1.5, end: 3.5 });
});

test('own videos are kept per exercise; an older save (plain file path) gets a default loop', () => {
  const s = migrate({ ...DEFAULT_STATE, userVideos: { flat_bench: 'file:///data/videos/a.mp4', lat_pulldown: { uri: 'file:///b.mp4', start: 1, end: 4 } } }, false);
  expect(s.userVideos).toEqual({ flat_bench: { uri: 'file:///data/videos/a.mp4', start: 0, end: 6 }, lat_pulldown: { uri: 'file:///b.mp4', start: 1, end: 4 } });
});

test('re-opening Trim before the clip length is known keeps the saved start', () => {
  expect(clampTrim(3, 3, 0)).toEqual({ start: 3, end: 6 });
});
