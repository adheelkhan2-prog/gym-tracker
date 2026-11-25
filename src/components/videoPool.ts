// Video players for the workout (no native import here, so screens can read it cheaply).
//
// Only the current exercise's video and the NEXT one are ever loaded: the next one's player is made
// in advance (it fills its buffers while you're on this page), the page adopts it when you get there,
// and a player is released as soon as its video is neither current nor next, so a long workout
// never piles up decoders or memory. Each player is made for one video and never re-pointed at
// another, so a page's video view is only ever tied to its own player (on Android a view that's gone
// stays referenced by its player until that player is released).
import { createContext } from 'react';

export type Src = number | { uri: string } | null;

/**
 * Every video is a file on the phone, so reading 3 s ahead is plenty (Android's default reads 20 s,
 * which holds a whole full-quality clip in memory per player). The picture quality is untouched.
 */
export const LOCAL_BUFFER = { preferredForwardBufferDuration: 3, minBufferForPlayback: 1 } as const;
export type PooledPlayer = unknown;
export type VideoPool = {
  /** Is this video one the pool looks after (the current or next exercise's)? Others use their own player. */
  manages: (source: number | { uri: string }) => boolean;
  /** Its player, or null while it's being made (the still shows meanwhile). */
  playerFor: (source: number | { uri: string }) => PooledPlayer | null;
};
export const VideoPoolContext = createContext<VideoPool | null>(null);

/** Same source? Bundled videos are asset numbers; your own are { uri }. */
export const sameSource = (a: unknown, b: unknown) =>
  a === b || (!!a && !!b && typeof a === 'object' && typeof b === 'object' && (a as { uri?: string }).uri === (b as { uri?: string }).uri);

/**
 * What to do when the page changes, given the videos that have a player now: keep the players of
 * the current and next videos, release every other one, make the current one's player at once if
 * it has none, and the next one's a moment later (so it doesn't slow the current one's start).
 */
export function plan(held: Src[], current: Src, next: Src) {
  const has = (x: Src) => held.some((h) => sameSource(h, x));
  const wanted = (h: Src) => sameSource(h, current) || sameSource(h, next);
  return {
    release: held.filter((h) => !wanted(h)),
    createNow: current && !has(current) ? current : null,
    createLater: next && !has(next) && !sameSource(next, current) ? next : null,
  };
}
