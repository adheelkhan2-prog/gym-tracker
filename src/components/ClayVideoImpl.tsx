import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * A looping, muted clay exercise video (start -> end -> start). `paused` is controlled by the
 * parent, so a tap anywhere on its card can pause it (parents start it paused when Reduce motion
 * is on, showing the start position until tapped).
 */
export function ClayVideo({ source, paused, onPlaying }: { source: number; paused: boolean; onPlaying?: (playing: boolean) => void }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  useEffect(() => onPlaying?.(isPlaying), [isPlaying, onPlaying]);
  // Explicit 100% size inside a fill wrapper: on web the <video> otherwise keeps its own 1024 px size.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} allowsPictureInPicture={false} />
    </View>
  );
}
