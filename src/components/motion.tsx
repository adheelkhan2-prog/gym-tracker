import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { color } from '../theme';

/** Ease-out with a little overshoot: the "spring" feel for numbers. */
const easeOutBack = (t: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** A number that springs up from `from` to `to`. `skip` jumps straight to the end. */
export function CountUp({
  to,
  from = 0,
  duration = 900,
  delay = 0,
  format = (n: number) => Math.round(n).toLocaleString(),
  style,
  skip,
  onDone,
}: {
  to: number;
  from?: number;
  duration?: number;
  delay?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  skip?: boolean;
  onDone?: () => void;
}) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce || skip ? to : from);
  // Later changes animate from the number on screen, not from `from` again.
  const shown = useRef(reduce || skip ? to : from);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (reduce || skip) {
      done.current?.();
      return;
    }
    let raf = 0;
    let start = 0;
    const start0 = shown.current;
    const timer = setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / duration);
        const now0 = start0 + (to - start0) * easeOutBack(t);
        shown.current = now0;
        setV(now0);
        if (t < 1) raf = requestAnimationFrame(tick);
        else done.current?.();
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [to, duration, delay, reduce, skip]);
  return (
    <Text style={style} accessibilityLabel={format(to)}>
      {format(reduce || skip ? to : v)}
    </Text>
  );
}

// ---------- Particles ----------

type Shape = 'star' | 'streak' | 'dot';

function Star({ size, fill }: { size: number; fill: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 1l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill={fill} />
    </Svg>
  );
}

function Particle({ seed, x0, y0, colors, power }: { seed: number; x0: number; y0: number; colors: string[]; power: number }) {
  const r = (n: number) => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  // Launch in an upward cone with random speed; gravity pulls everything back down.
  const angle = -Math.PI / 2 + (r(1) - 0.5) * Math.PI * 1.1;
  const speed = (420 + r(2) * 520) * power;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  const spin = (r(3) - 0.5) * 1400;
  const life = 1.1 + r(4) * 0.7;
  const shape: Shape = r(5) < 0.4 ? 'star' : r(5) < 0.75 ? 'streak' : 'dot';
  const size = shape === 'star' ? 12 + r(6) * 10 : shape === 'streak' ? 14 + r(6) * 10 : 6 + r(6) * 6;
  const fill = colors[Math.floor(r(7) * colors.length)];
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(life, { duration: life * 1000, easing: Easing.linear }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => {
    const s = t.value;
    const drag = 1 - Math.min(0.55, s * 0.35); // air resistance
    const x = x0 + vx * s * drag;
    const y = y0 + vy * s * drag + 0.5 * 1500 * s * s; // gravity
    return {
      opacity: s < life * 0.65 ? 1 : Math.max(0, (life - s) / (life * 0.35)),
      transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }, { rotate: `${spin * s}deg` }, { scale: Math.min(1, s * 8) }],
    };
  });
  return (
    <Animated.View style={[s.particle, style]}>
      {shape === 'star' ? (
        <Star size={size} fill={fill} />
      ) : (
        <View
          style={{
            width: shape === 'streak' ? size : size,
            height: shape === 'streak' ? 4 : size,
            borderRadius: size,
            backgroundColor: fill,
          }}
        />
      )}
    </Animated.View>
  );
}

/**
 * A burst of stars, streaks and dots in the given colours, launched from (x, y)
 * inside the parent. Physics: launch velocity, drag, gravity, spin and fade.
 * Change `burst` to fire again. Never takes touches.
 */
export function Burst({
  burst,
  x,
  y,
  colors,
  count = 34,
  power = 1,
}: {
  burst: number;
  x: number;
  y: number;
  colors: string[];
  count?: number;
  power?: number;
}) {
  const reduce = useReducedMotion();
  const ids = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  if (!burst || reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ids.map((i) => (
        <Particle key={`${burst}-${i}`} seed={i + burst * 31} x0={x} y0={y} colors={colors} power={power} />
      ))}
    </View>
  );
}

/** A quick full-screen white flash for big moments. */
export function Flash({ fire }: { fire: number }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(0);
  useEffect(() => {
    if (!fire || reduce) return;
    o.set(withSequence(withTiming(0.35, { duration: 60 }), withTiming(0, { duration: 260 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color.flash }, st]} />;
}

/** Gentle repeating pulse (scale + opacity). Stops for reduce motion. */
export function Pulse({ children, active = true, scale = 1.08 }: { children: React.ReactNode; active?: boolean; scale?: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active || reduce) {
      p.set(0);
      return;
    }
    p.set(withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (scale - 1) * p.value }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

const s = StyleSheet.create({
  particle: { position: 'absolute', left: 0, top: 0 },
});
