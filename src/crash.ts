// Crash reporting that stays on the phone.
//
// - JS errors (render errors caught by the error boundary, and fatal errors from the global
//   handler) are written to a crash log with the stack and a trail of the last screens/actions.
// - Native crashes and Android killing the app can't run any JS, so every launch leaves an
//   "alive" marker with the trail; if the next launch finds a marker that was never closed while
//   the app was in the foreground, that is logged as "closed unexpectedly".
// Writes are synchronous (expo-file-system File.writeSync) so a fatal error is saved before the
// process dies. The log can be viewed, shared and cleared in Settings → Crash log.
import { Platform } from 'react-native';

export type CrashKind = 'render' | 'fatal' | 'error' | 'unclean-exit';
export type CrashEntry = { at: string; kind: CrashKind; message: string; stack?: string; trail: string[]; app?: string };

/** Where the log lives. Native: files in the app's document folder. Web: localStorage. Tests: memory. */
export type CrashStore = { read: (name: string) => string | null; write: (name: string, text: string) => void; remove: (name: string) => void };

const LOG = 'crash-log.json';
const ALIVE = 'crash-alive.json';
const MAX_ENTRIES = 30;
const MAX_TRAIL = 25;

function nativeStore(): CrashStore {
  // Lazy so tests and web never load the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const file = (name: string) => new File(Paths.document, name);
  return {
    read: (name) => {
      const f = file(name);
      return f.exists ? f.textSync() : null;
    },
    write: (name, text) => {
      const f = file(name);
      if (!f.exists) f.create();
      f.writeSync(text);
    },
    remove: (name) => {
      const f = file(name);
      if (f.exists) f.delete();
    },
  };
}

function webStore(): CrashStore {
  const key = (n: string) => `gym-tracker/${n}`;
  return {
    read: (n) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key(n))),
    write: (n, t) => typeof localStorage !== 'undefined' && localStorage.setItem(key(n), t),
    remove: (n) => typeof localStorage !== 'undefined' && localStorage.removeItem(key(n)),
  };
}

export function memoryStore(): CrashStore {
  const m = new Map<string, string>();
  return { read: (n) => m.get(n) ?? null, write: (n, t) => void m.set(n, t), remove: (n) => void m.delete(n) };
}

let store: CrashStore | null = null;
const getStore = () => (store ??= Platform.OS === 'web' ? webStore() : nativeStore());
/** Swap the storage backend (tests). */
export const setCrashStore = (s: CrashStore) => {
  store = s;
  trail.length = 0;
  foreground = true;
};

const trail: string[] = [];
/** Whether the app is in the foreground now (AppState), written with every breadcrumb. */
let foreground = true;
const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const time = () => new Date().toISOString().slice(11, 19);

/** Remember a step (screen opened, button pressed) for the next crash report. Cheap; never throws. */
export function crumb(step: string) {
  trail.push(`${time()} ${step}`);
  if (trail.length > MAX_TRAIL) trail.splice(0, trail.length - MAX_TRAIL);
  safe(() => getStore().write(ALIVE, JSON.stringify({ foreground, trail })), undefined);
}

export function readCrashLog(): CrashEntry[] {
  return safe(() => JSON.parse(getStore().read(LOG) ?? '[]') as CrashEntry[], []);
}

/** Save a crash entry now (synchronously). Never throws: crash reporting must not crash. */
export function logCrash(kind: CrashKind, error: unknown, extra?: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  const entry: CrashEntry = {
    at: new Date().toISOString(),
    kind,
    message: `${e.name}: ${e.message}${extra ? ` (${extra})` : ''}`,
    stack: e.stack?.split('\n').slice(0, 12).join('\n'),
    trail: [...trail],
  };
  safe(() => getStore().write(LOG, JSON.stringify([entry, ...readCrashLog()].slice(0, MAX_ENTRIES))), undefined);
  return entry;
}

export const clearCrashLog = () => safe(() => getStore().remove(LOG), undefined);

/** Plain-text log for sharing. */
export function crashLogText(entries = readCrashLog(), app = '') {
  if (!entries.length) return 'No crashes recorded.';
  return [
    `Gym Tracker crash log${app ? ` (${app})` : ''}`,
    ...entries.map((c) => [`\n[${c.at}] ${c.kind}: ${c.message}`, c.stack ? c.stack : '', c.trail.length ? `Last steps:\n  ${c.trail.join('\n  ')}` : ''].filter(Boolean).join('\n')),
  ].join('\n');
}

/**
 * Call once at startup. Logs an unexpected close from the previous run (if the app was in the
 * foreground when it ended), then installs the global fatal-error handler.
 */
export function installCrashReporting() {
  const prev = safe(() => JSON.parse(getStore().read(ALIVE) ?? 'null') as { foreground: boolean; trail: string[] } | null, null);
  // On web a reload or closed tab looks the same as a crash, so only native checks this.
  if (prev?.foreground && Platform.OS !== 'web') {
    const last = readCrashLog()[0];
    const loggedAlready = last && last.kind === 'fatal' && prev.trail.length && last.trail.at(-1) === prev.trail.at(-1);
    if (!loggedAlready) {
      const entry: CrashEntry = {
        at: new Date().toISOString(),
        kind: 'unclean-exit',
        message: 'The app closed unexpectedly while open (a native crash, or Android stopped it).',
        trail: prev.trail,
      };
      safe(() => getStore().write(LOG, JSON.stringify([entry, ...readCrashLog()].slice(0, MAX_ENTRIES))), undefined);
    }
  }
  crumb('app start');
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const eu = g.ErrorUtils;
  if (eu) {
    const before = eu.getGlobalHandler();
    eu.setGlobalHandler((error, fatal) => {
      logCrash(fatal ? 'fatal' : 'error', error);
      before?.(error, fatal);
    });
  }
}

/** The app went to the background (or came back): a close while backgrounded isn't a crash. */
export function setForeground(fg: boolean) {
  foreground = fg;
  safe(() => getStore().write(ALIVE, JSON.stringify({ foreground, trail })), undefined);
}
