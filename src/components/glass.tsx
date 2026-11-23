// Glassmorphism: a drifting lime/pink glow backdrop, and frosted panels that blur it.
//
// Android blur needs the blurred content inside a BlurTargetView, so each screen
// renders one <Backdrop> (the glow blobs) as the blur target and every <Glass>
// panel blurs that. On Android 12+ this uses RenderNode (fast); older phones and
// the "Reduce effects" setting get a tinted see-through panel instead.
import { BlurTargetView, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
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

/**
 * Screen background: black with a big lime glow and a smaller pink one drifting slowly.
 * Wrap a screen's content in it; glass panels inside blur these blobs.
 * `accent` shifts the lime blob (e.g. toward the hero).
 */
export function Backdrop({ children, intensity = 1 }: { children: React.ReactNode; intensity?: number }) {
  const { width, height } = useWindowDimensions();
  const target = useRef<React.ComponentRef<typeof View>>(null);
  const big = width * 1.25;
  const small = width * 0.95;
  return (
    <BlurTarget.Provider value={target}>
      <View style={s.root}>
        {/* Clipped: the blobs drift past the screen edges, which must never widen the page. */}
        <BlurTargetView ref={target} style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color.bg }]} />
          <Drift x={-big * 0.35} y={-big * 0.38} dx={width * 0.18} dy={height * 0.06} period={14000}>
            <Blob size={big} tint={color.lime} opacity={0.26 * intensity} />
          </Drift>
          <Drift x={width - small * 0.55} y={height * 0.34} dx={-width * 0.2} dy={height * 0.08} period={17000}>
            <Blob size={small} tint={color.pink} opacity={0.2 * intensity} />
          </Drift>
          <Drift x={-small * 0.3} y={height * 0.78} dx={width * 0.12} dy={-height * 0.05} period={19000}>
            <Blob size={small} tint={color.lime} opacity={0.12 * intensity} />
          </Drift>
        </BlurTargetView>
        {children}
      </View>
    </BlurTarget.Provider>
  );
}

/**
 * A frosted glass panel: blur of the backdrop, a light tint, a 1px ~15% white border
 * and a soft top highlight. `glow` adds a coloured halo behind the panel.
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
  /** Halo colour behind the panel (lime by default for heroes). */
  glow?: string;
  /** Use real blur even when the panel is small (heroes, sheets, the rest ring). */
  strong?: boolean;
}) {
  const target = useContext(BlurTarget);
  const { state } = useStore();
  const blurOn = state.blur && (strong || Platform.OS === 'web');
  return (
    <View style={[{ borderRadius: r }, glow && { shadowColor: glow, shadowOpacity: 0.55, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 0 }, style]}>
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
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  border: { borderWidth: glass.borderWidth, borderColor: color.glassBorder },
});
