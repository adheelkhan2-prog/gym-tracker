// The workout's video players. The pool logic is loaded fail-safe and sits BESIDE the page, not
// around it: if expo-video can't load or the pool fails, only the pool is lost (each video then
// uses its own player, or its still), and the workout page itself is never remounted.
import React, { useEffect, useState, type ComponentProps } from 'react';
import { lazySafe } from '../safe';
import { VideoPoolContext, type Src, type VideoPool } from './videoPool';
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

/** Until the pool reports in (one frame), its videos show their stills rather than making players. */
const PENDING: VideoPool = { manages: () => true, playerFor: () => null };

export function VideoPoolProvider({ current, next, children }: { current: Src; next: Src; children: React.ReactNode }) {
  const [pool, setPool] = useState<VideoPool | 'off' | null>(null);
  return (
    <>
      <Host current={current} next={next} onPool={setPool} />
      <VideoPoolContext.Provider value={pool === 'off' ? null : (pool ?? PENDING)}>{children}</VideoPoolContext.Provider>
    </>
  );
}
