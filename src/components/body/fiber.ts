// Web (demo build): React Three Fiber on a DOM canvas.
import { Asset } from 'expo-asset';

export { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';

/** Model source for useLoader: a URL on web. */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- bundled asset
export const MODEL_SRC: unknown = Asset.fromModule(require('../../../assets/models/muscles.glb')).uri;

/** PNG snapshot of the current 3D frame (for the share card). */
export async function snapshotGL(gl: { domElement: HTMLCanvasElement }): Promise<string | null> {
  try {
    return gl.domElement.toDataURL('image/png');
  } catch {
    return null;
  }
}
