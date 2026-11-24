// Fail-safe loading for native-heavy modules (3D, video, audio, notifications).
//
// A module that throws while it loads (as three.js did in build 7) must never take a whole screen
// down. Screens therefore never import these modules at the top level: they go through
// `safeRequire` (plain modules) or `lazySafe` (components). The require runs on first use inside
// try/catch; if it throws, the crash is logged and a fallback is used instead.
import React, { Component, useState } from 'react';
import { logCrash } from './crash';

const cache = new Map<string, unknown>();

/** Load a module on first use; null (and logged) if loading it throws. */
export function safeRequire<T>(name: string, load: () => T): T | null {
  if (cache.has(name)) return cache.get(name) as T | null;
  let mod: T | null = null;
  try {
    mod = load();
  } catch (e) {
    logCrash('error', e, `module ${name} failed to load`);
  }
  cache.set(name, mod);
  return mod;
}

/** Catches render errors of one panel (3D model, video), shows its fallback, logs the error. */
export class PanelBoundary extends Component<{ name: string; fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    logCrash('render', error, this.props.name);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * A component whose implementation is loaded on first render (not when the screen's module loads),
 * inside both a load guard and a render error boundary. Either failure shows `Fallback`.
 */
export function lazySafe<P extends object>(name: string, load: () => React.ComponentType<P>, Fallback: React.ComponentType<P>) {
  function Safe(props: P) {
    const [Impl] = useState(() => safeRequire(name, load));
    if (!Impl) return <Fallback {...props} />;
    return (
      <PanelBoundary name={name} fallback={<Fallback {...props} />}>
        <Impl {...props} />
      </PanelBoundary>
    );
  }
  Safe.displayName = `Safe(${name})`;
  return Safe;
}
