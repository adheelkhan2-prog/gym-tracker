import { createVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { logCrash } from '../crash';
import { LOCAL_BUFFER, plan, sameSource, type HeldPlayers, type Src } from './videoPool';

type Held = { src: Src; player: VideoPlayer };

/** The live players (current + next), kept outside React: they are native objects released by hand. */
class Players {
  private held: Held[] = [];
  private snap: readonly Held[] = [];
  private listeners = new Set<() => void>();
  private later: { src: Src; timer: ReturnType<typeof setTimeout> } | null = null;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  snapshot = () => this.snap;
  private emit() {
    this.snap = [...this.held];
    this.listeners.forEach((l) => l());
  }
  private make(src: Src) {
    // A player that can't be made (e.g. no free decoder on the phone) is simply not pooled: that
    // page's video then gets its own player, or its still shows. Never fatal.
    try {
      const player = createVideoPlayer(src as VideoSource);
      player.loop = true;
      player.muted = true;
      player.bufferOptions = LOCAL_BUFFER;
      this.held.push({ src, player });
    } catch (e) {
      this.failed.push(src);
      logCrash('error', e, 'video player could not be made');
    }
  }
  /** Videos whose player couldn't be made: they use their own player instead. */
  failed: Src[] = [];

  sync(current: Src, next: Src) {
    const p = plan(
      this.held.map((h) => h.src),
      current,
      next,
    );
    if (this.later && !sameSource(this.later.src, p.createLater)) {
      clearTimeout(this.later.timer);
      this.later = null;
    }
    const before = this.held.length;
    for (const h of this.held.filter((x) => p.release.some((r) => sameSource(r, x.src)))) {
      this.held = this.held.filter((x) => x !== h);
      try {
        h.player.release();
      } catch {
        // Already gone: nothing to free.
      }
    }
    if (p.createNow) this.make(p.createNow);
    const changed = !!p.createNow || this.held.length !== before;
    if (p.createLater && !this.later) {
      const src = p.createLater;
      this.later = {
        src,
        timer: setTimeout(() => {
          this.later = null;
          if (!this.held.some((h) => sameSource(h.src, src))) this.make(src);
          this.emit();
        }, 400),
      };
    }
    // Only a real change re-renders (the page's sources can be new objects with the same file).
    if (changed) this.emit();
  }

  releaseAll() {
    if (this.later) clearTimeout(this.later.timer);
    this.later = null;
    for (const h of this.held)
      try {
        h.player.release();
      } catch {
        // Already gone.
      }
    this.held = [];
    this.emit();
  }
}

/**
 * Holds the workout's players (the exercise on screen and the next one, made in advance) and hands
 * what it holds to `onPool`. It renders nothing, so if it ever fails only the pool is lost, never the page.
 */
export function VideoPoolHost({ current, next, onPool }: { current: Src; next: Src; onPool: (pool: HeldPlayers | 'off') => void }) {
  const [players] = useState(() => new Players());
  const held = useSyncExternalStore(players.subscribe, players.snapshot);
  useEffect(() => players.sync(current, next), [players, current, next]);
  useEffect(() => () => players.releaseAll(), [players]);
  const value: HeldPlayers = useMemo(
    () => ({
      failed: (src) => players.failed.some((f) => sameSource(f, src)),
      playerFor: (src) => held.find((h) => sameSource(h.src, src))?.player ?? null,
    }),
    [held, players],
  );
  useEffect(() => {
    onPool(value);
  }, [value, onPool]);
  return null;
}
