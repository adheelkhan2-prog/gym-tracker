/**
 * The build-7 crash: three.js's CommonJS entry called Node's process.emitWarning at module load,
 * which doesn't exist in React Native, so every screen importing the 3D model failed to load.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- jest runs in node */
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

const root = process.cwd();

test('Metro resolves `three` to the ES module, never the CommonJS stub', () => {
  const config = require(join(root, 'metro.config.js'));
  const r = config.resolver.resolveRequest({ resolveRequest: () => ({ type: 'empty' }) }, 'three', 'android');
  expect(r).toEqual({ type: 'sourceFile', filePath: join(root, 'node_modules/three/build/three.module.js') });
});

test('the polyfill makes process.emitWarning harmless when it is missing', () => {
  const p = globalThis.process as unknown as Record<string, unknown>;
  const saved = p.emitWarning;
  delete p.emitWarning;
  jest.isolateModules(() => require('../polyfills'));
  expect(typeof p.emitWarning).toBe('function');
  expect(() => (p.emitWarning as (m: string) => void)('x')).not.toThrow();
  p.emitWarning = saved;
});

test('screens never import the 3D stack, video or audio directly (they go through the fail-safe loaders)', () => {
  const { execSync } = require('child_process');
  const hits: string = execSync(
    "grep -rlE \"^import [^t].* from '(three|@react-three/fiber[^']*|expo-gl|expo-video|expo-audio|expo-notifications)'\" src --include=*.ts --include=*.tsx || true",
    { cwd: root },
  ).toString();
  const allowed = ['src/components/body/BodyModelImpl.tsx', 'src/components/body/fiber.ts', 'src/components/body/fiber.native.ts', 'src/notifications.ts'];
  const bad = hits.split('\n').filter((f) => f && !allowed.includes(f) && !f.includes('__tests__') && !f.includes('Impl.'));
  expect(bad).toEqual([]);
  // Every screen file has its own error boundary.
  const routes: string = execSync("find src/app -name '*.tsx'", { cwd: root }).toString();
  for (const f of routes.split('\n').filter(Boolean)) expect(readFileSync(join(root, f), 'utf8')).toContain('as ErrorBoundary');
});

test('release builds have no INTERNET permission; debug builds keep it for the dev server', () => {
   
  const plugin = require('../../plugins/withOfflineRelease');
  expect(plugin.MANIFEST).toMatch(/android\.permission\.INTERNET" tools:node="remove"/);
   
  const app = require('../../app.json');
  expect(app.expo.plugins).toContain('./plugins/withOfflineRelease');
  expect(app.expo.android.blockedPermissions ?? []).not.toContain('android.permission.INTERNET');
});

test('minified release builds keep the constructors Expo uses to create native views (expo-gl GLView)', () => {
  const plugin = require('../../plugins/withKeepNativeViews');
  expect(plugin.RULES).toMatch(/expo\.modules\.\*\* extends android\.view\.View/);
  expect(plugin.RULES).toMatch(/<init>\(android\.content\.Context, expo\.modules\.kotlin\.AppContext\)/);
  const app = require('../../app.json');
  expect(app.expo.plugins).toContain('./plugins/withKeepNativeViews');
});

test('own videos come only from the gallery: no camera, no recording, no camera/microphone permission', () => {
  const fs = require('fs');
  const src = fs.readFileSync('src/components/ImportVideo.tsx', 'utf8');
  expect(src).not.toMatch(/launchCameraAsync|requestCameraPermissionsAsync/);
  expect(src).toMatch(/launchImageLibraryAsync/);
  const app = require('../../app.json');
  const picker = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-image-picker');
  expect(picker[1]).toMatchObject({ cameraPermission: false, microphonePermission: false });
  expect(app.expo.android.blockedPermissions).toEqual(expect.arrayContaining(['android.permission.CAMERA', 'android.permission.RECORD_AUDIO']));
});
