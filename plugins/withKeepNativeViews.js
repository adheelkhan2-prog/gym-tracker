// Release builds are minified (R8). Expo creates native views by reflection, looking up a
// (Context, AppContext) or (Context) constructor. Expo's own rules only keep those constructors for
// subclasses of ExpoView; expo-gl's GLView extends TextureView, so R8 removed its constructor and the
// app crashed natively ("Didn't find a correct constructor") the moment the 3D muscle model appeared.
// Keep the constructors of every native view in Expo modules.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RULES = `
# --- withKeepNativeViews (plugins/withKeepNativeViews.js) ---
-keepclassmembers class expo.modules.** extends android.view.View {
  public <init>(android.content.Context);
  public <init>(android.content.Context, expo.modules.kotlin.AppContext);
}
-keep class expo.modules.gl.** { *; }
# --- end withKeepNativeViews ---
`;

module.exports = function withKeepNativeViews(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!cur.includes('withKeepNativeViews')) fs.writeFileSync(file, cur + RULES);
      return cfg;
    },
  ]);
};

module.exports.RULES = RULES;
