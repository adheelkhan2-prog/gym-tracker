import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../feedback';
import { color, font, gradient, leading, motion, radius, size, space, touch, type } from '../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

const APressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that squishes down on press and springs back. */
export function Press({
  style,
  children,
  scaleTo = motion.pressScale,
  onPressIn,
  onPressOut,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; children: React.ReactNode; scaleTo?: number }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        if (!reduce) s.set(withTiming(scaleTo, { duration: 90 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduce) s.set(withSpring(1, motion.spring));
        onPressOut?.(e);
      }}
      style={[style, a]}
    >
      {children}
    </APressable>
  );
}

export function Screen({
  children,
  padBottom = space.x4,
  scroll = true,
}: {
  children: React.ReactNode;
  padBottom?: number;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + space.lg, paddingHorizontal: space.lg, paddingBottom: padBottom };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: color.bg }, pad]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={pad}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Shown while saved data and fonts load, so nothing flashes as empty. */
export function Loading({ label = 'Loading your log' }: { label?: string }) {
  return (
    <View style={s.loading} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={color.lime} size="large" />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
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

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  return (
    <Press
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[s.chip, active && s.chipActive]}
    >
      {icon && <Ionicons name={icon} size={16} color={active ? color.ink : color.muted} />}
      <Text style={[s.chipText, active && { color: color.ink }]}>{label}</Text>
    </Press>
  );
}

type ButtonKind = 'energy' | 'lime' | 'orange' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  kind = 'lime',
  icon,
  loading,
  disabled,
  big,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  big?: boolean;
}) {
  const ink = kind === 'ghost' ? color.text : kind === 'danger' ? color.danger : color.ink;
  const inner = (
    <>
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        icon && <Ionicons name={icon} size={big ? 22 : 18} color={ink} />
      )}
      <Text style={[s.btnText, big && { fontSize: size.h3 }, { color: ink }]}>{label}</Text>
    </>
  );
  const shape = [s.btn, big && { minHeight: touch.primary + 8 }, disabled && { opacity: 0.45 }];
  return (
    <Press
      onPress={() => {
        if (loading || disabled) return;
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={{ borderRadius: radius.pill }}
    >
      {kind === 'energy' ? (
        <LinearGradient colors={gradient.energy} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={shape}>
          {inner}
        </LinearGradient>
      ) : (
        <View
          style={[
            shape,
            kind === 'lime' && { backgroundColor: color.lime },
            kind === 'orange' && { backgroundColor: color.orange },
            (kind === 'ghost' || kind === 'danger') && { backgroundColor: color.surface2 },
          ]}
        >
          {inner}
        </View>
      )}
    </Press>
  );
}

/** Round icon button, 48dp. */
export function IconButton({
  icon,
  onPress,
  label,
  tone = 'surface',
  iconSize = 22,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: 'surface' | 'scrim';
  iconSize?: number;
}) {
  return (
    <Press
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={[s.iconBtn, { backgroundColor: tone === 'scrim' ? color.scrim : color.surface2 }]}
    >
      <Ionicons name={icon} size={iconSize} color={color.text} />
    </Press>
  );
}

/** Flame + count. Grey when the streak is zero. */
export function Flame({ count, label, tint = color.orange }: { count: number; label: string; tint?: string }) {
  const lit = count > 0;
  return (
    <View style={[s.flame, { backgroundColor: lit ? color.orangeDim : color.surface2 }]} accessibilityLabel={`${count} day ${label} streak`}>
      <Ionicons name={lit ? 'flame' : 'flame-outline'} size={20} color={lit ? tint : color.subtle} />
      <Text style={[type.num, { fontSize: size.h3, color: lit ? tint : color.subtle }]}>{count}</Text>
    </View>
  );
}

/** Small rounded badge used for weekly achievements. */
export function Badge({ icon, title, sub, earned, tint }: { icon: IconName; title: string; sub: string; earned: boolean; tint: string }) {
  return (
    <View style={[s.badge, earned && { borderColor: tint }]} accessibilityLabel={`${title}, ${sub}${earned ? ', earned' : ''}`}>
      <View style={[s.badgeIcon, { backgroundColor: earned ? tint : color.surface2 }]}>
        <Ionicons name={icon} size={22} color={earned ? color.ink : color.subtle} />
      </View>
      <Text style={[s.badgeTitle, !earned && { color: color.muted }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={s.badgeSub} numberOfLines={2}>
        {sub}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.x3,
    marginBottom: space.md,
    gap: space.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    minHeight: touch.min,
    borderRadius: radius.pill,
    backgroundColor: color.surface2,
  },
  chipActive: { backgroundColor: color.lime },
  chipText: { fontFamily: font.bodyBold, fontSize: size.small, color: color.text },
  btn: {
    minHeight: touch.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  btnText: { fontFamily: font.bodyBlack, fontSize: size.body, letterSpacing: 0.2 },
  iconBtn: {
    width: touch.min,
    height: touch.min,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    minHeight: 40,
    borderRadius: radius.pill,
  },
  badge: {
    flex: 1,
    minWidth: 0,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.surface,
    padding: space.md,
    gap: space.xs,
  },
  badgeIcon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  badgeTitle: { fontFamily: font.display, fontSize: size.body, color: color.text },
  badgeSub: { fontFamily: font.body, fontSize: size.label, lineHeight: leading.label, color: color.muted },
});
