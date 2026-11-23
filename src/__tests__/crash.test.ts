/** Crash log: errors saved with the last steps, unexpected closes detected on the next launch. */
import { clearCrashLog, crashLogText, crumb, installCrashReporting, logCrash, memoryStore, readCrashLog, setCrashStore, setForeground } from '../crash';

beforeEach(() => setCrashStore(memoryStore()));

test('an error is saved with its message, stack and the last steps', () => {
  crumb('screen /focus');
  crumb('finish workout (focus)');
  logCrash('fatal', new TypeError('x is undefined'));
  const [e] = readCrashLog();
  expect(e.kind).toBe('fatal');
  expect(e.message).toBe('TypeError: x is undefined');
  expect(e.stack).toContain('TypeError');
  expect(e.trail.map((t) => t.slice(9))).toEqual(['screen /focus', 'finish workout (focus)']);
});

test('a close while the app was open (native crash) is logged on the next launch, with its steps', () => {
  const store = memoryStore();
  setCrashStore(store);
  crumb('screen /complete'); // previous run: in the foreground, then gone without closing
  setCrashStore(store); // "relaunch": same storage, fresh memory
  installCrashReporting();
  const [e] = readCrashLog();
  expect(e.kind).toBe('unclean-exit');
  expect(e.trail.at(-1)).toContain('screen /complete');
});

test('Android closing the app in the background is not a crash', () => {
  const store = memoryStore();
  setCrashStore(store);
  crumb('screen /');
  setForeground(false);
  setCrashStore(store);
  installCrashReporting();
  expect(readCrashLog()).toEqual([]);
});

test('the log keeps the newest 30, can be cleared, and reads as text', () => {
  for (let i = 0; i < 35; i++) logCrash('error', new Error(`e${i}`));
  expect(readCrashLog()).toHaveLength(30);
  expect(readCrashLog()[0].message).toBe('Error: e34');
  expect(crashLogText()).toContain('Error: e34');
  clearCrashLog();
  expect(readCrashLog()).toEqual([]);
  expect(crashLogText()).toBe('No crashes recorded.');
});

test('crash reporting never throws, even if storage fails', () => {
  setCrashStore({
    read: () => {
      throw new Error('disk');
    },
    write: () => {
      throw new Error('disk');
    },
    remove: () => {
      throw new Error('disk');
    },
  });
  expect(() => crumb('x')).not.toThrow();
  expect(() => logCrash('error', 'boom')).not.toThrow();
  expect(readCrashLog()).toEqual([]);
});
