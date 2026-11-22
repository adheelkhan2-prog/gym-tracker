import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { color, font, motion, radius, size, space } from '../theme';

const COLORS = [color.lime, color.orange, color.gold, color.limeSoft, color.orangeSoft];

function Piece({ i, w, h }: { i: number; w: number; h: number }) {
  // Deterministic pseudo-random spread so every burst looks lively but stable.
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const x0 = w / 2 + (r(1) - 0.5) * 60;
  const dx = (r(2) - 0.5) * w * 1.1;
  const peak = h * (0.18 + r(3) * 0.25);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 1100 + r(4) * 500, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => {
    const p = t.value;
    // Up fast, then fall with gravity.
    const y = h * 0.42 - peak * Math.sin(Math.min(p * 1.6, 1) * Math.PI * 0.5) + Math.max(0, p - 0.55) * h * 0.9;
    return {
      opacity: p < 0.85 ? 1 : (1 - p) / 0.15,
      transform: [{ translateX: x0 + dx * p }, { translateY: y }, { rotate: `${p * 720 * (r(5) - 0.5)}deg` }],
    };
  });
  const sz = 8 + r(6) * 8;
  return (
    <Animated.View
      style={[
        s.piece,
        { width: sz, height: sz * (r(7) > 0.5 ? 0.45 : 1), backgroundColor: COLORS[i % COLORS.length], borderRadius: r(8) > 0.6 ? sz : 2 },
        style,
      ]}
    />
  );
}

/** Confetti burst. Purely decorative: never takes touches. Change `burst` to fire again. */
export function Confetti({ burst, count = 36 }: { burst: number; count?: number }) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  if (!burst || reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((i) => (
        <Piece key={`${burst}-${i}`} i={i + burst * 7} w={width} h={height} />
      ))}
    </View>
  );
}

/** Gold "NEW PR!" banner that pops in at the top and fades out by itself. */
export function PRBanner({ show, text }: { show: number; text: string }) {
  const reduce = useReducedMotion();
  const sc = useSharedValue(0);
  const op = useSharedValue(0);
  useEffect(() => {
    if (!show) return;
    sc.value = reduce ? 1 : withSequence(withSpring(1.08, motion.pop), withSpring(1, motion.spring));
    op.value = withSequence(withTiming(1, { duration: 120 }), withDelay(1600, withTiming(0, { duration: 250 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);
  const style = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  if (!show) return null;
  return (
    <Animated.View pointerEvents="none" style={[s.banner, style]} accessibilityLiveRegion="assertive">
      <Ionicons name="trophy" size={26} color={color.ink} />
      <View>
        <Text style={s.bannerTitle}>NEW PR!</Text>
        <Text style={s.bannerSub}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0 },
  banner: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.gold,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.xxl,
    shadowColor: color.gold,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  bannerTitle: { fontFamily: font.display, fontSize: size.h2, color: color.ink, letterSpacing: -0.3 },
  bannerSub: { fontFamily: font.bodyBold, fontSize: size.small, color: color.ink },
});
