// Speed checks for test builds only. With EXPO_PUBLIC_PERF=1 at build time (the emulator perf
// run), the app logs timing marks to logcat and, on a fresh install, starts with a large fake
// history so Progress can be measured realistically. Normal builds never set the flag: the
// constant is inlined as false and none of this runs (the small fake-history builder in
// perfHistory.ts is still in the bundle, about 2 KB, but never called: Metro bundles every
// import, even a require() inside `if (PERF)`, which was checked with an export).
export const PERF = process.env.EXPO_PUBLIC_PERF === '1';

/** "[perf] name 1732540000000" in logcat (epoch ms), test builds only. */
export function perfMark(name: string) {
  if (PERF) console.log(`[perf] ${name} ${Date.now()}`);
}
