import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { logCrash } from '../crash';
import { perfMark } from '../perf';
import { LOCAL_BUFFER, VideoHoldContext, VideoPoolContext, type VideoPool } from './videoPoolCore';

/** Players that have drawn a frame into some view (a new view on one may not report a first frame). */
const drawn = new WeakSet<object>();

/** A key per player, so a new player gets a fresh view (its still, playing state and safety net). */
const playerKeys = new WeakMap<object, number>();
let nextKey = 1;
function keyOf(p: VideoPlayer) {
  let k = playerKeys.get(p);
  if (!k) playerKeys.set(p, (k = nextKey++));
  return k;
}

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
};

/**
 * A looping, muted exercise video (bundled, or recorded / imported on this phone). `paused` is
 * controlled by the parent, so a tap anywhere on its card can pause it. With `start`/`end` (seconds)
 * only that part loops: that's how a trimmed clip of your own plays, without re-encoding the file.
 * In a workout the pool's player is used (made in advance for the next exercise); anywhere else, or
 * for a clip of your own, the video gets its own player, released when it leaves the screen.
 */
export function LoopVideo(props: Props) {
  const { source, start = 0, end } = props;
  const segment = end !== undefined && end > start;
  const pool = useContext(VideoPoolContext);
  const hold = useContext(VideoHoldContext);
  if (pool && !segment && pool.manages(source)) return <PooledVideo {...props} paused={props.paused || hold} pool={pool} />;
  // Held (another screen or sheet plays its own video): no player at all meanwhile, just the still.
  if (hold) return <Poster poster={props.poster} />;
  return <OwnVideo {...props} />;
}

function PooledVideo({ pool, ...props }: Props & { pool: VideoPool }) {
  const { source } = props;
  const player = pool.playerFor(source) as VideoPlayer | null;
  // Still the pool's? (A play error on a player the pool has just let go of is expected; others are logged.)
  const live = useCallback(() => pool.playerFor(source) === player, [pool, source, player]);
  // The player is being made (opening the workout, or going back): the still shows meanwhile.
  if (!player) return <Poster poster={props.poster} />;
  return <PlayerVideo key={keyOf(player)} {...props} player={player} pooled live={live} />;
}

function OwnVideo(props: Props) {
  const { source, start = 0, end } = props;
  const segment = end !== undefined && end > start;
  const player = useVideoPlayer(source, (p) => {
    p.loop = !segment;
    p.muted = true;
    p.timeUpdateEventInterval = segment ? 0.05 : 0;
    p.bufferOptions = LOCAL_BUFFER;
  });
  return <PlayerVideo key={keyOf(player)} {...props} player={player} />;
}

/** The still, fitted like the video (contain). */
function Poster({ poster }: { poster?: ImageSourcePropType }) {
  return poster ? <Image source={poster} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null;
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
  live,
}: Props & { player: VideoPlayer; pooled?: boolean; live?: () => boolean }) {
  const segment = end !== undefined && end > start;
  // The still stays until this view's first frame (or the safety net below), even for a player that's
  // already playing elsewhere: a still for a moment, never a black panel. A new player always gets a
  // new view (see keyOf), so this starts afresh for each player.
  const [shown, setShown] = useState(false);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  // (Read through a ref: the check changes with every pool update, play/pause only with `paused`.)
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);
  useEffect(() => {
    try {
      if (paused) player.pause();
      else player.play();
    } catch (e) {
      // A pooled player the pool has just let go of has nothing to play; anything else is logged.
      if (!liveRef.current || liveRef.current()) logCrash('error', e, 'video play/pause');
    }
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
  // A pooled player may have loaded before this view existed: report its length now.
  const onDurationRef = useRef(onDuration);
  useEffect(() => {
    onDurationRef.current = onDuration;
  }, [onDuration]);
  useEffect(() => {
    if (pooled && player.duration > 0) onDurationRef.current?.(player.duration);
  }, [pooled, player]);
  useEffect(() => onPlaying?.(isPlaying), [isPlaying, onPlaying]);
  // The still goes at this view's first frame. Safety net: a player made before its view (a pooled
  // one, or even useVideoPlayer's) may never report a first frame to it (seen on the emulator), so
  // once it plays and its clock really moves, the still goes. A player that never moves keeps its
  // still: a still for longer on a slow phone, never a black panel.
  const settled = isPlaying;
  useEffect(() => {
    if (!settled || shown) return;
    // Only once the video is really moving (its clock has advanced).
    const since = Date.now();
    let from: number; // (a kept player may resume part-way through)
    try {
      from = player.currentTime;
    } catch {
      return; // Released: the page is leaving, the still stays.
    }
    const t = setInterval(() => {
      let moving = false;
      try {
        moving = Math.abs(player.currentTime - from) > 0.25;
      } catch {
        // Released: the page is leaving.
      }
      // (Not moving after a while: it goes only if this player has drawn frames before; else the still stays.)
      if (moving || (Date.now() - since > 2500 && drawn.has(player))) setShown(true);
    }, 150);
    return () => clearInterval(t);
  }, [settled, shown, player]);
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
          drawn.add(player);
          perfMark('video-frame');
          setShown(true);
        }}
      />
      {!shown && <Poster poster={poster} />}
    </View>
  );
}
