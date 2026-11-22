// Default Expo Metro config, plus:
// - .glb files bundled as assets (the 3D muscle model).
// - When DEMO=1 (the single-page web demo build), `expo-router` imports are
//   pointed at a small in-memory stand-in.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb');

if (process.env.DEMO === '1') {
  const shim = path.resolve(__dirname, 'demo/router-shim.tsx');
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'expo-router') return { type: 'sourceFile', filePath: shim };
    return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
