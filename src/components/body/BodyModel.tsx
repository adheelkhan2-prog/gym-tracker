// The 3D muscle model, loaded fail-safe: three.js / React Three Fiber / expo-gl are only required
// on first render (never when a screen's module loads), and any load or render error shows a quiet
// placeholder instead of taking the screen down. See src/safe.tsx.
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { lazySafe } from '../../safe';
import { color, font, radius, size } from '../../theme';
import type { BodyModel as Impl } from './BodyModelImpl';

export type { Paint, PaintMap, PulseMap, Snapshot } from './BodyModelImpl';

type Props = ComponentProps<typeof Impl>;

function Unavailable({ height = 300 }: Props) {
  return (
    <View style={[s.box, { height }]} accessibilityRole="image" accessibilityLabel="3D model unavailable">
      <Text style={s.text}>3D model unavailable on this device</Text>
    </View>
  );
}

export const BodyModel = lazySafe<Props>(
  'BodyModel',
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on first use, guarded
  () => require('./BodyModelImpl').BodyModel,
  Unavailable,
);

const s = StyleSheet.create({
  box: { width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: radius.xl, backgroundColor: color.surface },
  text: { fontFamily: font.bodySemi, fontSize: size.small, color: color.subtle },
});
