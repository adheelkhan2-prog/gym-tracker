import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

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
}: {
  source: number | { uri: string };
  paused: boolean;
  start?: number;
  end?: number;
  onPlaying?: (playing: boolean) => void;
  onDuration?: (seconds: number) => void;
}) {
  const segment = end !== undefined && end > start;
  const player = useVideoPlayer(source, (p) => {
    p.loop = !segment;
    p.muted = true;
    p.timeUpdateEventInterval = segment ? 0.05 : 0;
  });
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
  // Explicit 100% size inside a fill wrapper: on web the <video> otherwise keeps its own 1024 px size.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} allowsPictureInPicture={false} />
    </View>
  );
}
