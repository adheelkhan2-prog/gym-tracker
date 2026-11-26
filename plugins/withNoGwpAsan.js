// Android 14+ samples a few memory allocations with GWP-ASan, a debugging aid. When a sampled
// allocation is freed on Hermes's separate JS stack, the sampler's own stack walk runs off that stack
// and the app dies natively (SIGSEGV in gwp_asan::...::RecordBacktrace, seen twice on the emulator a
// few seconds after launch). The sampler finds nothing useful for this app, so turn it off.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNoGwpAsan(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:gwpAsanMode'] = 'never';
    return cfg;
  });
};
