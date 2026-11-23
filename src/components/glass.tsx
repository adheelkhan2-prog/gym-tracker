// A dark room lit by one spotlight: slow smoke, a faint deep glow, film grain and a vignette,
// and dark glass panels that blur it.
//
// Android blur needs the blurred content inside a BlurTargetView, so each screen
// renders one <Backdrop> (the glow blobs) as the blur target and every <Glass>
// panel blurs that. On Android 12+ this uses RenderNode (fast); older phones and
// the "Reduce effects" setting get a tinted see-through panel instead.
import { BlurTargetView, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Image, Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useStore } from '../store';
import { color, glass, gradient, radius } from '../theme';

type Target = React.RefObject<React.ComponentRef<typeof View> | null>;
const BlurTarget = createContext<Target | null>(null);

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

function Drift({
  children,
  x,
  y,
  dx,
  dy,
  period,
}: {
  children: React.ReactNode;
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
  return <Animated.View style={[StyleSheet.absoluteFill, st]}>{children}</Animated.View>;
}

/** Film grain, tiled; static so it costs nothing per frame. */
const GRAIN = require('../../assets/textures/grain.png');

/** Soft edge darkening, drawn once with SVG. `id` must be unique per screen (web shares SVG ids). */
export function Vignette({ width, height, strength = 0.75, id = 'vignette', cy = '42%' }: { width: number | string; height: number | string; strength?: number; id?: string; cy?: string }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy={cy} rx="75%" ry="62%">
          <Stop offset="0.55" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={strength} />
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
export function Backdrop({ children, intensity = 1 }: { children: React.ReactNode; intensity?: number }) {
  const { width, height } = useWindowDimensions();
  const target = useRef<React.ComponentRef<typeof View>>(null);
  const big = width * 1.4;
  const mid = width * 1.05;
  return (
    <BlurTarget.Provider value={target}>
      <View style={s.root}>
        {/* Clipped: the smoke drifts past the screen edges, which must never widen the page. */}
        <BlurTargetView ref={target} style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color.bg }]} />
          <Drift x={width - mid * 0.45} y={height * 0.62} dx={-width * 0.1} dy={-height * 0.04} period={36000}>
            <Blob size={mid} tint={color.glowDeep} opacity={0.55 * intensity} />
          </Drift>
          <Drift x={-big * 0.45} y={height * 0.18} dx={width * 0.22} dy={height * 0.05} period={30000}>
            <Blob size={big} tint={color.smoke} opacity={0.5 * intensity} />
          </Drift>
          <Drift x={width * 0.25} y={height * 0.55} dx={-width * 0.25} dy={-height * 0.06} period={42000}>
            <Blob size={mid} tint={color.smoke} opacity={0.38 * intensity} />
          </Drift>
          <Spotlight width={width} height={height} />
          <Image source={GRAIN} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: 0.05 }]} />
          <Vignette width={width} height={height} />
        </BlurTargetView>
        {children}
      </View>
    </BlurTarget.Provider>
  );
}

/**
 * A dark glass panel: low blur of the backdrop, a dark tint, a faint 1px border, light from the
 * top (sheen + brighter top edge) and a deep shadow. `glow` swaps the shadow for a small coloured halo.
 */
export function Glass({
  children,
  style,
  r = radius.xl,
  glow,
  strong,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  r?: number;
  /** Halo colour behind the panel (used rarely; a deep shadow otherwise). */
  glow?: string;
  /** Use real blur even when the panel is small (heroes, sheets, the rest ring). */
  strong?: boolean;
}) {
  const target = useContext(BlurTarget);
  const { state } = useStore();
  const blurOn = state.blur && (strong || Platform.OS === 'web');
  return (
    <View
      style={[
        { borderRadius: r },
        // Deep shadow under every panel; a small coloured glow only where asked (rare).
        glow
          ? { shadowColor: glow, shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 0 }
          : { shadowColor: '#000000', shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 0 },
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]} pointerEvents="none">
        {blurOn && target ? (
          <BlurView
            intensity={glass.blur}
            tint="dark"
            blurTarget={target}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: blurOn ? color.glass : color.glassSolid }]} />
        <LinearGradient colors={gradient.sheen} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, s.border, { borderRadius: r }]} />
        {/* Lit softly from the top: a brighter top edge. */}
        <View style={[StyleSheet.absoluteFill, s.topEdge, { borderRadius: r }]} />
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  border: { borderWidth: glass.borderWidth, borderColor: color.glassBorder },
  topEdge: { borderTopWidth: glass.borderWidth, borderColor: 'transparent', borderTopColor: 'rgba(255,255,255,0.11)' },
});
