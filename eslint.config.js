// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'android/*'] },
  // React Three Fiber elements (<mesh>, <directionalLight intensity>) are not DOM elements.
  { files: ['src/components/body/**'], rules: { 'react/no-unknown-property': 'off' } },
]);
