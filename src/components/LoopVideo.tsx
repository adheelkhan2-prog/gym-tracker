// The looping exercise video, loaded fail-safe (src/safe.tsx): expo-video is only required on first
// render, and if it can't load or render, the panel is left empty so the still image shows instead.
import type { ComponentProps } from 'react';
import { lazySafe } from '../safe';
import type { LoopVideo as Impl } from './LoopVideoImpl';

type Props = ComponentProps<typeof Impl>;

export const LoopVideo = lazySafe<Props>(
  'LoopVideo',
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on first use, guarded
  () => require('./LoopVideoImpl').LoopVideo,
  () => null,
);
