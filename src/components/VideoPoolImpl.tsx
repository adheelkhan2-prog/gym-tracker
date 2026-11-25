import { useVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';
import React, { useEffect, useMemo, useState } from 'react';
import { VideoPoolContext, assign, sameSource, type VideoPool } from './videoPool';

type Src = number | { uri: string } | null;
type Held = { a: Src; b: Src };

/** Two players for the workout: the exercise on screen and the next one (preloaded). */
export function VideoPoolProvider({ current, next, children }: { current: Src; next: Src; children: React.ReactNode }) {
  const setup = (p: VideoPlayer) => {
    p.loop = true;
    p.muted = true;
  };
  const a = useVideoPlayer(null, setup);
  const b = useVideoPlayer(null, setup);
  const [held, setHeld] = useState<Held>({ a: null, b: null });
  const want = assign(held, current, next);
  // Adjusting state while rendering (React's pattern for state derived from props).
  if (!sameSource(want.a, held.a) || !sameSource(want.b, held.b)) setHeld(want);

  useEffect(() => {
    a.replace(held.a as VideoSource);
  }, [a, held.a]);
  useEffect(() => {
    b.replace(held.b as VideoSource);
  }, [b, held.b]);
  useEffect(() => {
    // The preloaded player waits paused; its buffers still fill.
    (sameSource(held.a, current) ? b : a).pause();
  }, [a, b, held, current]);

  const value: VideoPool = useMemo(() => ({ playerFor: (src) => (sameSource(held.a, src) ? a : sameSource(held.b, src) ? b : null) }), [held, a, b]);
  return <VideoPoolContext.Provider value={value}>{children}</VideoPoolContext.Provider>;
}
