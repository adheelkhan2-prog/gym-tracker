import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useContext, useEffect, useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { perfMark } from '../perf';
import { VideoPoolContext, type VideoPool } from './videoPool';

/** Seek the native player (kept outside the component: the player is an imperative handle). */
function seek(p: VideoPlayer, seconds: number) {
  p.currentTime = seconds;
}

type Props = {
  source: number | { uri: string };
  paused: boolean;
  start?: number;
  end?: number;
  onPlaying?: (playing: boolean) => void;
  onDuration?: (seconds: number) => void;
  /** Still shown on top until the first video frame is drawn (no blank or black flash). */
  poster?: ImageSourcePropType;
  posterContain?: boolean;
};

/**
 * A looping, muted exercise video (bundled, or recorded / imported on this phone). `paused` is
 * controlled by the parent, so a tap anywhere on its card can pause it. With `start`/`end` (seconds)
 * only that part loops: that's how a trimmed clip of your own plays, without re-encoding the file.
 * In a workout the pool's player is used (made in advance for the next exercise); anywhere else, or
 * for a trimmed clip of your own, the video gets its own player, released when it leaves the screen.
 */
export function LoopVideo(props: Props) {
  const { source, start = 0, end } = props;
  const segment = end !== undefined && end > start;
  const pool = useContext(VideoPoolContext);
  if (pool && !segment && pool.manages(source)) return <PooledVideo {...props} pool={pool} />;
  return <OwnVideo {...props} />;
}

function PooledVideo({ pool, ...props }: Props & { pool: VideoPool }) {
  const player = pool.playerFor(props.source) as VideoPlayer | null;
  // The player is being made (opening the workout, or going back): the still shows meanwhile.
  if (!player) return <Poster poster={props.poster} contain={props.posterContain} />;
  return <PlayerVideo {...props} player={player} pooled />;
}

function OwnVideo(props: Props) {
  const { source, start = 0, end } = props;
  const segment = end !== undefined && end > start;
  const player = useVideoPlayer(source, (p) => {
    p.loop = !segment;
    p.muted = true;
    p.timeUpdateEventInterval = segment ? 0.05 : 0;
  });
  return <PlayerVideo {...props} player={player} />;
}

function Poster({ poster, contain = true }: { poster?: ImageSourcePropType; contain?: boolean }) {
  return poster ? <Image source={poster} style={StyleSheet.absoluteFill} resizeMode={contain ? 'contain' : 'cover'} /> : null;
}

function PlayerVideo({
  player,
  pooled,
  paused,
  start = 0,
  end,
  onPlaying,
  onDuration,
  poster,
  posterContain = true,
}: Props & { player: VideoPlayer; pooled?: boolean }) {
  const segment = end !== undefined && end > start;
  const [shown, setShown] = useState(false);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  // A pooled player outlives this page when it becomes the "next" one (going back): leave it paused.
  useEffect(
    () => () => {
      if (!pooled) return;
      try {
        player.pause();
      } catch {
        // Already released.
      }
    },
    [player, pooled],
  );
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
  // Safety net: if a player never reports its first frame (e.g. one already shown before), the still
  // goes once it has been playing for a moment, so it can never stay stuck over the video.
  useEffect(() => {
    if (!isPlaying || shown) return;
    const t = setTimeout(() => setShown(true), 600);
    return () => clearTimeout(t);
  }, [isPlaying, shown]);
  useEffect(() => {
    if (shown) perfMark('video-shown');
  }, [shown]);
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
      {!shown && <Poster poster={poster} contain={posterContain} />}
    </View>
  );
}
