// The looping exercise video, loaded fail-safe (src/safe.tsx): expo-video is only required on first
// render, and if it can't load or render, its still image shows instead (no native module needed).
import type { ComponentProps } from 'react';
import { Image, StyleSheet } from 'react-native';
import { lazySafe } from '../safe';
import type { LoopVideo as Impl } from './LoopVideoImpl';

type Props = ComponentProps<typeof Impl>;

export const LoopVideo = lazySafe<Props>(
  'LoopVideo',
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on first use, guarded
  () => require('./LoopVideoImpl').LoopVideo,
  ({ poster }: Props) => (poster ? <Image source={poster} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null),
);
