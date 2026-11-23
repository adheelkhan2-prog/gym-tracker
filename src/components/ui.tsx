// Core components. APIs follow react-native-reusables (shadcn for React Native, MIT,
// https://github.com/founded-labs/react-native-reusables): Button variants/sizes, Card
// parts, Badge, Progress, Switch. Styling comes from src/theme.ts (no NativeWind).
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { haptic } from '../feedback';
import { color, font, gradient, motion, radius, size, space, touch, type } from '../theme';
import { Backdrop, Glass } from './glass';
import { Icon, type IconName } from './icons';

export type { IconName };

const APressable = Animated.createAnimatedComponent(Pressable);

/**
 * Every tappable thing: springs down on press, lights a glow ring and gives a haptic tick.
 * Interruptible: a new press simply retargets the spring.
 */
export function Press({
  style,
  children,
  scaleTo = motion.pressScale,
  glow = color.accentPressed,
  tick = true,
  onPressIn,
  onPressOut,
  ...rest
}: PressableProps & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  scaleTo?: number;
  glow?: string;
  tick?: boolean;
}) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const g = useSharedValue(0);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const ring = useAnimatedStyle(() => ({ opacity: g.value }));
  const r = (StyleSheet.flatten(style)?.borderRadius as number | undefined) ?? radius.md;
  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        if (tick) haptic.tap();
        if (!reduce) s.set(withSpring(scaleTo, motion.spring));
        g.set(withSpring(1, motion.spring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduce) s.set(withSpring(1, motion.spring));
        g.set(withSpring(0, motion.gentle));
        onPressOut?.(e);
      }}
      style={[style, a]}
    >
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, borderWidth: 2, borderColor: glow }, ring]} />
    </APressable>
  );
}

/** Screen scaffold: backdrop + scroll view with safe-area padding. `padBottom` is added to the bottom inset. */
export function Screen({ children, padBottom = space.x5 }: { children: React.ReactNode; padBottom?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <Backdrop>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingHorizontal: space.lg, paddingBottom: insets.bottom + padBottom }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Backdrop>
  );
}

/** A grey placeholder block that breathes slowly (still under reduce motion). */
export function Skeleton({ w = '100%', h, r = radius.lg, style }: { w?: number | `${number}%`; h: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(0.55);
  useEffect(() => {
    if (!reduce) o.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: color.surface2 }, st, style]} />;
}

/** Shown while saved data and fonts load: the shape of the Today screen, no spinner, no jump. */
export function Loading({ label = 'Loading your log' }: { label?: string }) {
  return (
    <View style={s.loading} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Skeleton w="45%" h={14} r={radius.sm} />
      <Skeleton w="70%" h={30} r={radius.sm} style={{ marginTop: space.md }} />
      <Skeleton h={220} r={radius.xxl} style={{ marginTop: space.x4 }} />
      <Skeleton h={64} r={radius.xl} style={{ marginTop: space.lg }} />
      <Skeleton h={120} r={radius.xl} style={{ marginTop: space.lg }} />
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <Text style={type.h2} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

// ---------- Card (reusables: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter) ----------

export function Card({
  children,
  style,
  glow,
  strong,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: string;
  strong?: boolean;
}) {
  return (
    <Glass style={[s.card, style]} glow={glow} strong={strong}>
      {children}
    </Glass>
  );
}
export const CardHeader = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ gap: space.xs }, style]}>{children}</View>
);
export const CardTitle = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[type.h2, style]} accessibilityRole="header">
    {children}
  </Text>
);
export const CardDescription = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[type.small, style]}>{children}</Text>
);
export const CardContent = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ marginTop: space.md }, style]}>{children}</View>
);
export const CardFooter = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ marginTop: space.lg, flexDirection: 'row', gap: space.sm, alignItems: 'center' }, style]}>{children}</View>
);

// ---------- Button (reusables variants: default | secondary | outline | ghost | destructive | link; sizes: sm | default | lg | icon) ----------

/** default: dark glass, thin crimson edge, crimson label (the main action). solid: crimson fill, PR moments only. */
type ButtonVariant = 'default' | 'solid' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

export function Button({
  label,
  onPress,
  variant = 'default',
  size: sz = 'default',
  icon,
  iconRight,
  loading,
  disabled,
  accessibilityLabel,
}: {
  label?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const fg =
    disabled && variant !== 'solid'
      ? color.subtle
      : variant === 'solid'
        ? color.onAccent
        : variant === 'default' || variant === 'link'
          ? color.accentText // label text: the AA-safe red; the edge stays true crimson
          : color.text;
  // Warnings/deletes: amber icon + white label on an amber-tinted panel; never the red accent.
  const iconFg = variant === 'destructive' ? color.warn : fg;
  const h = sz === 'sm' ? touch.min : sz === 'lg' ? touch.primary + space.sm : touch.primary;
  const shape: StyleProp<ViewStyle> = [
    s.btn,
    { minHeight: h, paddingHorizontal: sz === 'icon' ? 0 : sz === 'sm' ? space.lg : space.xxl, width: sz === 'icon' ? h : undefined },
    variant === 'default' && s.btnPrimary,
    variant === 'secondary' && { backgroundColor: color.glassSolid, borderWidth: 1, borderColor: color.glassBorder },
    variant === 'outline' && { borderWidth: 1, borderColor: color.glassBorder },
    variant === 'destructive' && { backgroundColor: color.warnDim, borderWidth: 1, borderColor: color.warnEdge },
    disabled && variant === 'default' && { borderColor: color.glassBorder },
    disabled && variant === 'solid' && { opacity: 0.6 },
  ];
  const inner = (
    <>
      {loading ? <ActivityIndicator color={fg} /> : icon && <Icon name={icon} size={sz === 'lg' ? 22 : 20} color={iconFg} />}
      {label ? <Text style={[s.btnText, sz === 'lg' && { fontSize: size.h3 }, sz === 'sm' && { fontSize: size.small }, { color: fg }]}>{label}</Text> : null}
      {iconRight && <Icon name={iconRight} size={20} color={iconFg} />}
    </>
  );
  return (
    <Press
      onPress={() => !loading && !disabled && onPress()}
      glow={variant === 'destructive' ? color.warn : color.accentPressed}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={{ borderRadius: radius.pill }}
    >
      {variant === 'solid' ? (
        <LinearGradient colors={gradient.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={shape}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={shape}>{inner}</View>
      )}
    </Press>
  );
}

/** Round icon button, 48dp (reusables Button size="icon"). */
export function IconButton({
  icon,
  onPress,
  label,
  tint = color.text,
  filled,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  tint?: string;
  filled?: boolean;
}) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={s.iconBtn}>
      <Icon name={icon} size={22} color={tint} filled={filled} />
    </Press>
  );
}

// ---------- Badge (reusables variants + 'pr') ----------

export function Badge({
  label,
  variant = 'default',
  icon,
}: {
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'pr';
  icon?: IconName;
}) {
  const fg = variant === 'pr' ? color.onAccent : variant === 'default' ? color.accentText : variant === 'destructive' ? color.warn : color.text;
  return (
    <View
      style={[
        s.badge,
        variant === 'default' && { backgroundColor: color.accentDim, borderColor: color.accentEdge, borderWidth: 1 },
        variant === 'pr' && { backgroundColor: color.accent },
        variant === 'secondary' && { backgroundColor: color.glassSolid, borderColor: color.glassBorder, borderWidth: 1 },
        variant === 'outline' && { borderColor: color.glassBorder, borderWidth: 1 },
      ]}
    >
      {icon && <Icon name={icon} size={14} color={fg} filled={variant === 'pr'} />}
      <Text style={[s.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ---------- Chip (toggle) ----------

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }} style={[s.chip, active && s.chipOn]}>
      {icon && <Icon name={icon} size={16} color={active ? color.accent : color.muted} filled={active} />}
      <Text style={[s.chipText, active && { color: color.accentText }]}>{label}</Text>
    </Press>
  );
}

// ---------- Progress (reusables Progress: value 0..100) ----------

export function Progress({ value, tint = color.accent, height = 10 }: { value: number; tint?: string; height?: number }) {
  const reduce = useReducedMotion();
  const w = useSharedValue(reduce ? value : 0);
  useEffect(() => {
    w.set(reduce ? value : withSpring(value, motion.gentle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  const st = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(100, w.value))}%` }));
  return (
    <View
      style={[s.track, { height, borderRadius: height }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
    >
      <Animated.View style={[{ height: '100%', borderRadius: height, backgroundColor: tint }, st]} />
    </View>
  );
}

// ---------- Switch (reusables Switch: checked / onCheckedChange) ----------

export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  const x = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    x.set(reduce ? (checked ? 1 : 0) : withSpring(checked ? 1 : 0, motion.spring));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, reduce]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 24 }] }));
  const fill = useAnimatedStyle(() => ({ opacity: x.value }));
  return (
    <Press
      onPress={() => onCheckedChange(!checked)}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={s.switchHit}
      scaleTo={0.92}
    >
      <View style={s.switchTrack}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color.accent, borderRadius: radius.pill }, fill]} />
        <Animated.View style={[s.switchThumb, thumb]} />
      </View>
    </Press>
  );
}

// ---------- Streak flame ----------

export function Flame({ count, label }: { count: number; label: string }) {
  const lit = count > 0;
  return (
    <View style={s.flame} accessibilityLabel={`${count} day ${label} streak`}>
      <Icon name="flame" size={18} color={lit ? color.accent : color.subtle} filled={lit} />
      <Text style={[type.num, { fontSize: size.h3, color: lit ? color.text : color.subtle }]}>{count}</Text>
    </View>
  );
}

// ---------- Ring ----------

const ACircle = Animated.createAnimatedComponent(Circle);

/** Animated progress ring with spring fill. `progress` is 0..1. */
export function Ring({
  progress,
  size: d = 180,
  stroke = 14,
  tint = color.accent,
  track = color.glassBorder,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  tint?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const r = (d - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(reduce ? progress : 0);
  useEffect(() => {
    p.set(reduce ? progress : withSpring(progress, motion.gentle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, reduce]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, p.value))) }));
  return (
    <View style={{ width: d, height: d, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={d} height={d} style={StyleSheet.absoluteFill}>
        <Circle cx={d / 2} cy={d / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={d / 2}
          cy={d / 2}
          r={r}
          stroke={tint}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={props}
          transform={`rotate(-90 ${d / 2} ${d / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.lg, paddingTop: space.x5 + space.xxl },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.x4,
    marginBottom: space.md,
    gap: space.md,
  },
  card: { padding: space.xl },
  btn: { borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  btnText: { fontFamily: font.bodyBlack, fontSize: size.body, letterSpacing: 0.3 },
  btnPrimary: { backgroundColor: '#0C0C0E', borderWidth: 1, borderColor: color.accentEdge },
  iconBtn: {
    width: touch.min,
    height: touch.min,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glassSolid,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + space.xxs,
    borderRadius: radius.pill,
  },
  badgeText: { fontFamily: font.bodyBlack, fontSize: size.label, letterSpacing: 0.4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    minHeight: touch.min,
    minWidth: touch.min,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.glassSolid,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  chipOn: { backgroundColor: color.accentDim, borderColor: color.accentEdge },
  chipText: { fontFamily: font.bodyBold, fontSize: size.small, color: color.text },
  track: { width: '100%', backgroundColor: color.glassBorder, overflow: 'hidden' },
  switchHit: { width: touch.min + space.md, height: touch.min, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  switchTrack: { width: 54, height: 30, borderRadius: radius.pill, backgroundColor: color.surface3, padding: 3 },
  switchThumb: { width: 24, height: 24, borderRadius: radius.pill, backgroundColor: color.text },
  flame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: color.glassSolid,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
});
