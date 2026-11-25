// The workout's video players. The pool logic is loaded fail-safe and sits BESIDE the page, not
// around it: if expo-video can't load or the pool fails, only the pool is lost (each video then
// uses its own player, or its still), and the workout page itself is never remounted.
import React, { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { lazySafe } from '../safe';
import { sameSource, VideoPoolContext, type HeldPlayers, type Src, type VideoPool } from './videoPool';
import type { VideoPoolHost as Impl } from './VideoPoolImpl';

type HostProps = ComponentProps<typeof Impl>;

/** Without the pool (it failed to load or render): every video uses its own player. */
function NoPool({ onPool }: HostProps) {
  useEffect(() => onPool('off'), [onPool]);
  return null;
}

const Host = lazySafe<HostProps>(
  'VideoPool',
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on first use, guarded
  () => require('./VideoPoolImpl').VideoPoolHost,
  NoPool,
);

export function VideoPoolProvider({ current, next, children }: { current: Src; next: Src; children: React.ReactNode }) {
  const [held, setHeld] = useState<HeldPlayers | 'off' | null>(null);
  // Which videos are pooled comes from THIS render's pages, so a page that just came on screen never
  // makes a throwaway player of its own while the pool catches up: it shows its still for that moment.
  const pool: VideoPool | null = useMemo(
    () =>
      held === 'off'
        ? null
        : {
            manages: (src) => sameSource(src, current) || sameSource(src, next),
            playerFor: (src) => held?.playerFor(src) ?? null,
          },
    [held, current, next],
  );
  // The host comes AFTER the page: on leaving the workout the page lets go of its players first,
  // then the host releases them.
  return (
    <>
      <VideoPoolContext.Provider value={pool}>{children}</VideoPoolContext.Provider>
      <Host current={current} next={next} onPool={setHeld} />
    </>
  );
}
