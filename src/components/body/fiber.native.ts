// Android: React Three Fiber on top of expo-gl.
import '../../polyfills';

export { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber/native';

/** Model source for useLoader: the bundled module id (R3F native resolves it with expo-asset). */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- bundled asset
export const MODEL_SRC: unknown = require('../../../assets/models/muscles.glb');
