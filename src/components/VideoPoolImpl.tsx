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
  holds = (player: VideoPlayer) => this.held.some((h) => h.player === player);
  private emit() {
    this.snap = [...this.held];
    this.listeners.forEach((l) => l());
  }
  private make(src: Src) {
    // A player that can't be made (e.g. no free decoder on the phone) is never fatal: that page shows
    // its still (no second player competing for a decoder), and it's tried again next time.
    let player: VideoPlayer | null = null;
    try {
      player = createVideoPlayer(src as VideoSource);
      const made = player;
      player.loop = true;
      player.muted = true;
      player.bufferOptions = LOCAL_BUFFER;
      // Most load / decoder failures come later, as an error status: that page then shows its still,
      // and the player is released a moment later, once the page has let go of it.
      player.addListener('statusChange', ({ status }) => {
        if (status !== 'error' || !this.held.some((h) => h.player === made)) return;
        this.failed.push(src);
        this.held = this.held.filter((h) => h.player !== made);
        // Freed a moment later, once its page has moved off it (or at the next page change, or on leaving).
        this.retired.push(made);
        this.emit();
        setTimeout(() => this.freeRetired(), 1000);
      });
      this.held.push({ src, player });
    } catch (e) {
      // Made but not set up: it's never handed out, so free it now.
      if (player && !this.held.some((h) => h.player === player))
        try {
          player.release();
        } catch {
          // Already gone.
        }
      this.failed.push(src);
      logCrash('error', e, 'video player could not be made');
    }
  }
  /** Players that hit an error: no longer handed out, released at the next sync. */
  private retired: VideoPlayer[] = [];
  private freeRetired() {
    for (const p of this.retired.splice(0))
      try {
        p.release();
      } catch {
        // Already gone.
      }
  }
  private current: Src = null;
  /** Videos whose player couldn't be made: their still shows (see sync for when they're retried). */
  failed: Src[] = [];

  sync(current: Src, next: Src) {
    if (this.closing) clearTimeout(this.closing);
    this.closing = null;
    this.freeRetired();
    // A video whose player couldn't be made gets another try once it's off screen and comes back.
    const arrived = !sameSource(current, this.current);
    this.current = current;
    this.failed = this.failed.filter((f) => (sameSource(f, current) && !arrived) || sameSource(f, next));
    // A video whose player failed shows its still. It gets one more try when it comes on screen (a
    // preload can fail just because the page before still held the decoder), and again once it has
    // been off screen; a current one that fails stays a still, never retried in a loop.
    const p = plan([...this.held.map((h) => h.src), ...this.failed], current, next);
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
          if ([...this.held.map((h) => h.src), ...this.failed].some((h) => sameSource(h, src))) return;
          this.make(src);
          this.emit();
        }, 400),
      };
    }
    // Only a real change re-renders (the page's sources can be new objects with the same file).
    if (changed) this.emit();
  }

  private closing: ReturnType<typeof setTimeout> | null = null;
  /** Release everything in a second, unless the pool is used again before then. */
  closeSoon() {
    if (this.closing) clearTimeout(this.closing);
    this.closing = setTimeout(() => {
      this.closing = null;
      this.releaseAll();
    }, 1000);
  }

  releaseAll() {
    this.freeRetired();
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
  useEffect(
    () => () => {
      // Released at once (the page, rendered before this host, has already let go of them), so
      // reopening the workout never finds the old players still alive. In development React runs
      // this twice on mount, so there they go a moment later unless the pool is used again.
      if (__DEV__) players.closeSoon();
      else players.releaseAll();
    },
    [players],
  );
  const value: HeldPlayers = useMemo(
    () => ({
      // Checked live too: a player released a moment ago (before this snapshot reached the page) is
      // never handed out.
      playerFor: (src) => {
        const p = held.find((h) => sameSource(h.src, src))?.player;
        return p && players.holds(p) ? p : null;
      },
    }),
    [held, players],
  );
  useEffect(() => {
    onPool(value);
  }, [value, onPool]);
  return null;
}
