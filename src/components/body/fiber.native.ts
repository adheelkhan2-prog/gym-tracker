// Android: React Three Fiber on top of expo-gl.
import '../../polyfills';

export { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber/native';

/** Model source for useLoader: the bundled module id (R3F native resolves it with expo-asset). */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- bundled asset
export const MODEL_SRC: unknown = require('../../../assets/models/muscles.glb');

/** PNG snapshot of the current 3D frame (for the share card). */
export async function snapshotGL(gl: { getContext: () => unknown }): Promise<string | null> {
  const { GLView } = await import('expo-gl');
  const snap = await GLView.takeSnapshotAsync(gl.getContext() as never, { format: 'png' });
  return typeof snap.uri === 'string' ? snap.uri : null;
}
