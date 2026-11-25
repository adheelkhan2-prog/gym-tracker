import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useContext, useEffect, useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { perfMark } from '../perf';
import { VideoPoolContext } from './videoPool';

/** Seek the native player (kept outside the component: the player is an imperative handle). */
function seek(p: VideoPlayer, seconds: number) {
  p.currentTime = seconds;
}

/**
 * A looping, muted exercise video (bundled, or recorded / imported on this phone). `paused` is
 * controlled by the parent, so a tap anywhere on its card can pause it. With `start`/`end` (seconds)
 * only that part loops: that's how a trimmed clip of your own plays, without re-encoding the file.
 */
export function LoopVideo({
  source,
  paused,
  start = 0,
  end,
  onPlaying,
  onDuration,
  poster,
  posterContain = true,
}: {
  source: number | { uri: string };
  paused: boolean;
  start?: number;
  end?: number;
  onPlaying?: (playing: boolean) => void;
  onDuration?: (seconds: number) => void;
  /** Still shown on top until the first video frame is drawn (no blank or black flash). */
  poster?: ImageSourcePropType;
  posterContain?: boolean;
}) {
  const segment = end !== undefined && end > start;
  // In a workout the pool already holds (and has preloaded) this video: use that player. A trimmed
  // clip of your own always gets its own player.
  const pool = useContext(VideoPoolContext);
  const pooled = segment ? null : ((pool?.playerFor(source) as VideoPlayer | null | undefined) ?? null);
  const [shown, setShown] = useState(false);
  const own = useVideoPlayer(pooled ? null : source, (p) => {
    p.loop = !segment;
    p.muted = true;
    p.timeUpdateEventInterval = segment ? 0.05 : 0;
  });
  const player = pooled ?? own;
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  useEffect(() => {
    // Start (or restart after the trim changed) at the beginning of the segment.
    if (start > 0) seek(player, start);
  }, [start, end, player]);
  // Trimmed: jump back to the start of the segment at its end (and at the end of the file).
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (segment && currentTime >= end!) seek(player, start);
  });
  useEventListener(player, 'playToEnd', () => {
    if (segment) {
      seek(player, start);
      player.play();
    }
  });
  useEventListener(player, 'sourceLoad', ({ duration }) => onDuration?.(duration));
  useEffect(() => onPlaying?.(isPlaying), [isPlaying, onPlaying]);
  // Safety net: if a reused (preloaded) player never reports its first frame, the still goes once
  // it has been playing for a moment, so it can never stay stuck over the video.
  useEffect(() => {
    if (!isPlaying || shown) return;
    const t = setTimeout(() => setShown(true), 600);
    return () => clearTimeout(t);
  }, [isPlaying, shown]);
  // Explicit 100% size inside a fill wrapper: on web the <video> otherwise keeps its own 1024 px size.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
        // A TextureView clips to the card's rounded corners and moves with it (a SurfaceView doesn't).
        surfaceType="textureView"
        onFirstFrameRender={() => {
          perfMark('video-frame');
          setShown(true);
        }}
      />
      {poster && !shown ? <Image source={poster} style={StyleSheet.absoluteFill} resizeMode={posterContain ? 'contain' : 'cover'} /> : null}
    </View>
  );
}
