// Rules for trimming your own exercise video to a short loop (see components/ImportVideo.tsx).

/** The longest loop we keep, the shortest, and the trim step, in seconds. */
export const MAX_LOOP = 6;
export const MIN_LOOP = 1;
export const TRIM_STEP = 0.5;

/** Round to the trim step (0.5 s). */
const snap = (x: number) => Math.round(x / TRIM_STEP) * TRIM_STEP;

/** The default loop for a new clip: its first MAX_LOOP seconds (or all of it when shorter). */
export function defaultTrim(duration: number | undefined) {
  const d = duration && duration > 0 ? duration : MAX_LOOP;
  return { start: 0, end: snap(Math.min(MAX_LOOP, d)) || Math.min(MAX_LOOP, d) };
}

/**
 * Clamp a trim to the clip: start inside it, length between MIN_LOOP and MAX_LOOP seconds. An unknown
 * duration (0, the player hasn't reported it yet) keeps the start as it is.
 */
export function clampTrim(start: number, length: number, duration: number) {
  const len = Math.max(MIN_LOOP, Math.min(MAX_LOOP, length, duration || MAX_LOOP));
  const s = Math.max(0, duration > 0 ? Math.min(start, Math.max(0, duration - len)) : start);
  return { start: snap(s), end: snap(s) + snap(len) };
}
