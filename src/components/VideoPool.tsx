// The workout's video pool, loaded fail-safe: if expo-video can't load, children render without a
// pool and each video simply uses its own player (or the still image).
import React, { type ComponentProps } from 'react';
import { lazySafe } from '../safe';
import type { VideoPoolProvider as Impl } from './VideoPoolImpl';

type Props = ComponentProps<typeof Impl>;

export const VideoPoolProvider = lazySafe<Props>(
  'VideoPool',
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on first use, guarded
  () => require('./VideoPoolImpl').VideoPoolProvider,
  ({ children }: Props) => <>{children}</>,
);
