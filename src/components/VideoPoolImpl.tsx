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
    // A player that can't be made (e.g. no free decoder on the phone) is simply not pooled: that
    // page's video then gets its own player, or its still shows. Never fatal.
    let player: VideoPlayer | null = null;
    try {
      player = createVideoPlayer(src as VideoSource);
      const made = player;
      player.loop = true;
      player.muted = true;
      player.bufferOptions = LOCAL_BUFFER;
      // Most load / decoder failures come later, as an error status: that video then leaves the pool
      // too (its page shows its still, or its own player), and its player is released off screen.
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
  /** Videos whose player couldn't be made: they use their own player instead. */
  failed: Src[] = [];

  sync(current: Src, next: Src) {
    if (this.closing) clearTimeout(this.closing);
    this.closing = null;
    this.freeRetired();
    // A video whose player couldn't be made gets another try once it's off screen and comes back.
    this.failed = this.failed.filter((f) => sameSource(f, current) || sameSource(f, next));
    // A video whose player failed is not retried while it's current or next (it uses its own player).
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
      // The players go a moment later, once nothing shows them: if this host ever fails, its fallback
      // switches the page to its own players first. (A remount meanwhile, e.g. React's dev
      // double-run, keeps them.)
      players.closeSoon();
    },
    [players],
  );
  const value: HeldPlayers = useMemo(
    () => ({
      failed: (src) => players.failed.some((f) => sameSource(f, src)),
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
