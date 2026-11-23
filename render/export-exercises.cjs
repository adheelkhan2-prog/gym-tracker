// Writes render/exercises.json (id, name, primary, secondary) from the app's exercise library,
// so renders always glow the same muscles the app lists. Run: node render/export-exercises.cjs
const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');
require.extensions['.ts'] = (m, filename) => {
  const src = fs.readFileSync(filename, 'utf8');
  const out = babel.transformSync(src, {
    filename,
    babelrc: false,
    configFile: false,
    presets: ['@babel/preset-typescript'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  m._compile(out.code, filename);
};
const { EXERCISE_LIST } = require(path.join(__dirname, '../src/data/exercises.ts'));
const { SWAPS } = require(path.join(__dirname, '../src/data/swaps.ts'));
const out = EXERCISE_LIST.map((e) => ({ id: e.id, name: e.name, primary: e.primary, secondary: e.secondary, equipment: e.equipment, pattern: e.pattern, swaps: SWAPS[e.id] ?? null }));
fs.writeFileSync(path.join(__dirname, 'exercises.json'), JSON.stringify(out, null, 1) + '\n');
// The user's current Upper Body 5-Day split, in workout order: reviewed first on the contact sheet.
const { DAYS } = require(path.join(__dirname, '../src/data/program.ts'));
const upper = [...new Set(DAYS.flatMap((d) => d.exercises.flatMap((e) => e.options)))];
fs.writeFileSync(path.join(__dirname, 'review-order.json'), JSON.stringify({ first: upper }, null, 1) + '\n');
console.log(out.length, 'exercises');
