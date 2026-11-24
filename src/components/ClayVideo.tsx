// The looping exercise video, loaded fail-safe (src/safe.tsx): expo-video is only required on first
// render, and if it can't load or render, the panel is left empty so the still image shows instead.
import type { ComponentProps } from 'react';
import { lazySafe } from '../safe';
import type { ClayVideo as Impl } from './ClayVideoImpl';

type Props = ComponentProps<typeof Impl>;

export const ClayVideo = lazySafe<Props>(
  'ClayVideo',
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on first use, guarded
  () => require('./ClayVideoImpl').ClayVideo,
  () => null,
);
