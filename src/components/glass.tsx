// A dark room lit by one spotlight: slow smoke, a faint deep glow, film grain and a vignette,
// and solid charcoal cards on top (no frosted glass: solid cards read better in a bright gym and
// cost nothing on the GPU).
import React, { useEffect } from 'react';
import { Image, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color, currentScheme, glass, radius, themed } from '../theme';

/** Soft radial glow blob drawn with SVG (no blur cost). */
export function Blob({ size, tint, opacity }: { size: number; tint: string; opacity: number }) {
  const id = `g${tint.replace(/[^a-z0-9]/gi, '')}${size}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={tint} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={tint} stopOpacity={opacity * 0.35} />
          <Stop offset="1" stopColor={tint} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Moves one glow blob slowly. The moving view is exactly the blob's size (never a screen-sized view
 * holding a bigger blob): Android clips a view's children at its own edges, and a clipped blob
 * sliding sideways showed as a hard vertical edge across the page.
 */
function Drift({
  children,
  size,
  x,
  y,
  dx,
  dy,
  period,
}: {
  children: React.ReactNode;
  size: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  period: number;
}) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.set(withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x + dx * t.value }, { translateY: y + dy * t.value }] }));
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, st]}>{children}</Animated.View>;
}

/** Film grain, tiled; static so it costs nothing per frame. */
const GRAIN = require('../../assets/textures/grain.png');

/**
 * Soft edge darkening, drawn once with SVG. `id` must be unique per screen (web shares SVG ids).
 * With `tint` = the screen's background, `rx`/`ry` = 50% and strength 1, an image's edges melt
 * fully into the screen, so no image border can ever show.
 */
export function Vignette({
  width,
  height,
  strength = 0.75,
  id = 'vignette',
  cy = '42%',
  tint = '#000000',
  rx = '75%',
  ry = '62%',
  inner = 0.55,
}: {
  width: number | string;
  height: number | string;
  strength?: number;
  id?: string;
  cy?: string;
  tint?: string;
  rx?: string;
  ry?: string;
  inner?: number;
}) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy={cy} rx={rx} ry={ry}>
          <Stop offset={String(inner)} stopColor={tint} stopOpacity={0} />
          <Stop offset="1" stopColor={tint} stopOpacity={strength} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** A low-key spotlight from above: the room's only light. */
function Spotlight({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="spot" cx="50%" cy="-8%" rx="85%" ry="58%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.075} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.022} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#spot)" />
    </Svg>
  );
}

/**
 * Screen background: near-black, one spotlight from above, slow dark smoke drifting through it,
 * a very faint blood-red glow far back, film grain and a vignette. Smoke rests under reduce motion.
 * Wrap a screen's content in it; glass panels inside blur it.
 */
export function Backdrop({ children, intensity = 1, stage = false }: { children: React.ReactNode; intensity?: number; stage?: boolean }) {
  const { width, height } = useWindowDimensions();
  const big = width * 1.4;
  const mid = width * 1.05;
  if (stage) {
    // For screens that show a clay render or video: the ground is exactly the render's own flat
    // background (no spotlight, grain or vignette, which would light the screen differently from
    // the image), so no edge can show between them.
    return <View style={[s.root, { backgroundColor: color.stage }]}>{children}</View>;
  }
  return (
    <View style={s.root}>
      {/* Clipped: the smoke drifts past the screen edges, which must never widen the page. */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: color.bg }]} pointerEvents="none">
        <Drift size={mid} x={width - mid * 0.45} y={height * 0.62} dx={-width * 0.1} dy={-height * 0.04} period={36000}>
          <Blob size={mid} tint={color.glowDeep} opacity={0.55 * intensity} />
        </Drift>
        <Drift size={big} x={-big * 0.45} y={height * 0.18} dx={width * 0.22} dy={height * 0.05} period={30000}>
          <Blob size={big} tint={color.smoke} opacity={0.5 * intensity} />
        </Drift>
        <Drift size={mid} x={width * 0.25} y={height * 0.55} dx={-width * 0.25} dy={-height * 0.06} period={42000}>
          <Blob size={mid} tint={color.smoke} opacity={0.38 * intensity} />
        </Drift>
        <Spotlight width={width} height={height} />
        {/* Paper (light) gets a whisper of grain and no vignette; the dark room keeps both. */}
        <Image source={GRAIN} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: currentScheme() === 'light' ? 0.025 : 0.05 }]} />
        {currentScheme() === 'dark' && <Vignette width={width} height={height} />}
      </View>
      {children}
    </View>
  );
}

/**
 * A card: a solid charcoal (dark) or white (light) panel with a visible 1px edge, a slightly
 * brighter top edge and a soft shadow. `glow` swaps the shadow for a small coloured halo.
 * (Named Glass for history; there's no blur any more.)
 */
export function Glass({
  children,
  style,
  r = radius.xl,
  glow,
  testID,
}: {
  children?: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  r?: number;
  /** Halo colour behind the panel (used rarely; a soft shadow otherwise). */
  glow?: string;
  /** Kept for older call sites; cards are always solid now. */
  strong?: boolean;
}) {
  return (
    <View
      testID={testID}
      style={[
        { borderRadius: r, backgroundColor: color.glassSolid },
        glow
          ? { shadowColor: glow, shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 0 }
          : { shadowColor: color.shadow, shadowOpacity: currentScheme() === 'light' ? 0.1 : 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 0 },
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, s.border, { borderRadius: r }]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, s.topEdge, { borderRadius: r }]} pointerEvents="none" />
      {children}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  border: { borderWidth: glass.borderWidth, borderColor: color.glassBorder },
  topEdge: { borderTopWidth: glass.borderWidth, borderColor: 'transparent', borderTopColor: color.glassHighlight },
}));
