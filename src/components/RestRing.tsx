import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { haptic } from '../feedback';
import { color, fmtClock, font, radius, size, space, touch, type } from '../theme';
import { Press } from './ui';

const ACircle = Animated.createAnimatedComponent(Circle);
const R = 26;
const C = 2 * Math.PI * R;

/**
 * Rest timer: an orange ring that drains to zero. Its own component, so the
 * once-a-second tick only re-renders this bar, not the whole exercise screen.
 */
export function RestBar({ endsAt, total, onAdd, onSkip, onDone, skipLabel = 'Skip' }: {
  endsAt: number;
  total: number;
  onAdd: () => void;
  onSkip: () => void;
  onDone: () => void;
  /** 'Skip' by default; 'Next' once the exercise's sets are all done. */
  skipLabel?: string;
}) {
  const reduce = useReducedMotion();
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  const progress = useSharedValue(left / total);

  useEffect(() => {
    const ms = Math.max(0, endsAt - Date.now());
    progress.value = ms / 1000 / total;
    progress.value = reduce ? 0 : withTiming(0, { duration: ms, easing: Easing.linear });
    const t = setInterval(() => {
      const l = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        haptic.timerEnd();
        onDone();
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  const ring = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - progress.value) }));

  return (
    <View style={s.bar} accessibilityLiveRegion="polite" accessibilityLabel={`Rest, ${left} seconds left`}>
      <View style={s.ring}>
        <Svg width={64} height={64} viewBox="0 0 64 64">
          <Circle cx={32} cy={32} r={R} stroke={color.surface3} strokeWidth={6} fill="none" />
          <ACircle
            cx={32}
            cy={32}
            r={R}
            stroke={color.orange}
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${C} ${C}`}
            animatedProps={ring}
            transform="rotate(-90 32 32)"
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, s.center]}>
          <Ionicons name="timer" size={20} color={color.orange} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.label}>Rest</Text>
        <Text style={[type.num, { fontSize: size.title }]}>{fmtClock(left)}</Text>
      </View>
      <Press onPress={onAdd} style={s.btn} accessibilityRole="button" accessibilityLabel="Add 15 seconds">
        <Text style={s.btnText}>+15s</Text>
      </Press>
      <Press onPress={onSkip} style={[s.btn, { backgroundColor: color.orange }]} accessibilityRole="button" accessibilityLabel={skipLabel === 'Skip' ? 'Skip rest' : `${skipLabel} exercise`}>
        <Text style={[s.btnText, { color: color.ink }]}>{skipLabel}</Text>
      </Press>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surface2,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.line,
    paddingVertical: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.md,
  },
  ring: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  btn: {
    minHeight: touch.min,
    minWidth: 64,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.text },
});
