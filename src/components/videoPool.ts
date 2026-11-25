// Shared video players for the workout (no native import here, so screens can read it cheaply).
// The workout keeps at most two players: the current exercise's video and the NEXT one, which is
// preloaded (its buffers fill before you get there). Any other video is released, so memory stays
// low on a long workout. LoopVideo uses a pooled player when one holds its source.
import { createContext } from 'react';

export type PooledPlayer = unknown;
export type VideoPool = { playerFor: (source: number | { uri: string }) => PooledPlayer | null };
export const VideoPoolContext = createContext<VideoPool | null>(null);

/** Same source? Bundled videos are asset numbers; your own are { uri }. */
export const sameSource = (a: unknown, b: unknown) =>
  a === b || (!!a && !!b && typeof a === 'object' && typeof b === 'object' && (a as { uri?: string }).uri === (b as { uri?: string }).uri);

export type Src = number | { uri: string } | null;
export type Held = { a: Src; b: Src };

/**
 * Which player holds what: the current video stays in the player that already has it (so moving
 * to the preloaded next one costs nothing), and the other player gets the next video. Anything
 * else is dropped, which releases it.
 */
export function assign(held: Held, current: Src, next: Src): Held {
  let { a, b } = held;
  if (current && !sameSource(a, current) && !sameSource(b, current)) {
    if (sameSource(a, next)) b = current;
    else a = current;
  }
  const curIsA = !!current && sameSource(a, current);
  if (curIsA) b = sameSource(b, next) ? b : next;
  else a = sameSource(a, next) ? a : next;
  return { a, b };
}

