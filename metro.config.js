// Default Expo Metro config, plus:
// - .glb files bundled as assets (the 3D muscle model).
// - `three` always resolves to its real ES module. three >= 0.18x ships a deprecated CommonJS stub
//   (build/three.cjs) that calls Node's `process.emitWarning` at load: on Android (Hermes) that is
//   undefined, so `require('three')` from @react-three/fiber threw "undefined is not a function" at
//   module load and took the importing screen down (the build-7 crash).
// - When DEMO=1 (the single-page web demo build), `expo-router` imports are
//   pointed at a small in-memory stand-in.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb');

const THREE_ESM = path.resolve(__dirname, 'node_modules/three/build/three.module.js');
const ROUTER_SHIM = path.resolve(__dirname, 'demo/router-shim.tsx');
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: THREE_ESM };
  if (process.env.DEMO === '1' && moduleName === 'expo-router') return { type: 'sourceFile', filePath: ROUTER_SHIM };
  return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
