import { useEffect, useRef, useState } from 'react';
import { safeRequire } from '../safe';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { haptic } from '../feedback';
import { startRestNotification, stopRestNotification } from '../restNotify';
import { color, fmtClock, font, leading, radius, size, space, themed, touch, type } from '../theme';
import { Icon } from './icons';
import { Press } from './ui';

const ACircle = Animated.createAnimatedComponent(Circle);

type Props = {
  endsAt: number;
  total: number;
  tint: string;
  /** What's coming next, e.g. "Set 2 · 180 × 9". */
  nextLabel: string;
  /** 'Skip' while sets remain; 'Next' once the exercise is done. */
  skipLabel: string;
  sound: boolean;
  onAdd: () => void;
  onSkip: () => void;
  onDone: () => void;
  /** Start as the slim bar (a rest carried over from the previous exercise). */
  startMini?: boolean;
};

/**
 * Rest timer. Opens full screen with a giant ring in the day's colour; tap the
 * background to shrink it to a slim bar so the next set stays 1–2 taps away.
 * Pulses in the last 5 seconds, buzzes (and optionally beeps) at zero.
 */
type Sound = { seekTo: (s: number) => unknown; play: () => void } | null;
const SOUND = require('../../assets/sounds/rest-done.wav');
// The rest-done chime. The audio module is loaded guarded (never a crash); if it can't load the
// timer is silent. Picked once here, so the hook order never changes between renders.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded optional native module
const audio = safeRequire('expo-audio', () => require('expo-audio') as typeof import('expo-audio'));
const useRestSound: () => Sound = audio ? () => audio.useAudioPlayer(SOUND) as unknown as Sound : () => null;

export function RestTimer({ endsAt, total, tint, nextLabel, skipLabel, sound, onAdd, onSkip, onDone, startMini = false }: Props) {
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [mini, setMini] = useState(startMini);
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  const progress = useSharedValue(left / total);
  const beat = useSharedValue(1);
  const player = useRestSound();
  const lastBeat = useRef(left);

  useEffect(() => {
    const ms = Math.max(0, endsAt - Date.now());
    progress.set(ms / 1000 / total);
    progress.set(reduce ? 0 : withTiming(0, { duration: ms, easing: Easing.linear }));
    const t = setInterval(() => {
      const l = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(l);
      // Countdown pulse for the last 5 seconds, once per second.
      if (l <= 5 && l > 0 && l !== lastBeat.current) {
        lastBeat.current = l;
        haptic.tap();
        if (!reduce) beat.set(withSequence(withTiming(1.12, { duration: 120 }), withTiming(1, { duration: 280 })));
      }
      if (l <= 0) {
        clearInterval(t);
        haptic.timerEnd();
        if (sound) {
          try {
            player?.seekTo(0);
            player?.play();
          } catch {}
        }
        onDone();
      }
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  // Ongoing countdown notification (lock screen) + an alert at the end; removed when the rest goes.
  useEffect(() => {
    startRestNotification(endsAt, nextLabel, sound).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);
  // Skipping ends the rest everywhere; leaving the screen does not (the rest carries over).
  const skip = () => {
    stopRestNotification().catch(() => {});
    onSkip();
  };

  const d = Math.min(width - space.x4 * 2, 320);
  const R = d / 2 - 14;
  const C = 2 * Math.PI * R;
  const RM = 22;
  const CM = 2 * Math.PI * RM;

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - progress.value) }));
  const miniProps = useAnimatedProps(() => ({ strokeDashoffset: CM * (1 - progress.value) }));
  const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  const final = left <= 5;


  if (mini) {
    return (
      <Animated.View entering={reduce ? undefined : FadeIn.duration(160)} style={[s.bar, { bottom: insets.bottom + space.md }]}>
        <Press onPress={() => setMini(false)} style={s.barMain} accessibilityRole="button" accessibilityLabel={`Rest, ${left} seconds left. Open timer`} glow={tint}>
          <Svg width={56} height={56} viewBox="0 0 56 56">
            <Circle cx={28} cy={28} r={RM} stroke={color.surface3} strokeWidth={3} fill="none" />
            <ACircle
              cx={28}
              cy={28}
              r={RM}
              stroke={tint}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CM} ${CM}`}
              animatedProps={miniProps}
              transform="rotate(-90 28 28)"
            />
          </Svg>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Rest</Text>
            <Text style={[type.num, { fontSize: size.title, color: final ? tint : color.text }]}>{fmtClock(left)}</Text>
          </View>
        </Press>
        <Press onPress={onAdd} style={s.barBtn} accessibilityRole="button" accessibilityLabel="Add 15 seconds" glow={tint}>
          <Text style={s.barBtnText}>+15s</Text>
        </Press>
        <Press onPress={skip} testID="rest-skip" style={[s.barBtn, s.bigBtnMain]} accessibilityRole="button" accessibilityLabel={skipLabel === 'Skip' ? 'Skip rest' : `${skipLabel} exercise`}>
          <Text style={[s.barBtnText, { color: tint }]}>{skipLabel}</Text>
        </Press>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(180)} exiting={reduce ? undefined : FadeOut.duration(140)} style={s.full}>
      <Press
        onPress={() => setMini(true)}
        tick={false}
        scaleTo={1}
        glow={color.bg}
        style={[StyleSheet.absoluteFill, { borderRadius: 0 }]}
        accessibilityRole="button"
        accessibilityLabel="Shrink timer and log the next set"
      >
        <View />
      </Press>
      <View pointerEvents="box-none" style={[s.fullInner, { paddingTop: insets.top + space.x4, paddingBottom: insets.bottom + space.xxl }]}>
        <Text style={type.label}>Rest</Text>
        <Animated.View style={[{ width: d, height: d, alignItems: 'center', justifyContent: 'center' }, beatStyle]} pointerEvents="none">
          <Svg width={d} height={d} style={StyleSheet.absoluteFill}>
            <Circle cx={d / 2} cy={d / 2} r={R} stroke={color.surface2} strokeWidth={4} fill="none" />
            <ACircle
              cx={d / 2}
              cy={d / 2}
              r={R}
              stroke={tint}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${C} ${C}`}
              animatedProps={ringProps}
              transform={`rotate(-90 ${d / 2} ${d / 2})`}
            />
          </Svg>
          <Text style={[s.count, final && { color: tint }]} accessibilityLiveRegion="polite">
            {fmtClock(left)}
          </Text>
          <Text style={s.next} numberOfLines={1}>
            {nextLabel}
          </Text>
        </Animated.View>
        <View style={s.actions} pointerEvents="box-none">
          <Press onPress={onAdd} style={s.bigBtn} glow={tint} accessibilityRole="button" accessibilityLabel="Add 15 seconds">
            <Icon name="plus" size={20} color={color.text} />
            <Text style={s.bigBtnText}>15s</Text>
          </Press>
          <Press onPress={skip} testID="rest-skip" style={[s.bigBtn, s.bigBtnMain]} accessibilityRole="button" accessibilityLabel={skipLabel === 'Skip' ? 'Skip rest' : `${skipLabel} exercise`}>
            <Text style={[s.bigBtnText, { color: tint }]}>{skipLabel}</Text>
            <Icon name="arrowRight" size={20} color={tint} />
          </Press>
        </View>
        <Text style={s.hint}>Tap anywhere to log your next set</Text>
      </View>
    </Animated.View>
  );
}

const s = themed(() => StyleSheet.create({
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.bg },
  fullInner: { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
  count: { fontFamily: font.display, fontSize: size.mega, lineHeight: leading.mega, color: color.text, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  next: { fontFamily: font.bodyBold, fontSize: size.body, color: color.muted, marginTop: space.xs, maxWidth: '80%' },
  actions: { flexDirection: 'row', gap: space.md },
  bigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touch.primary + space.sm,
    paddingHorizontal: space.x3,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  bigBtnMain: { borderColor: color.accentEdge, backgroundColor: 'rgba(14,14,17,0.9)' },
  bigBtnText: { fontFamily: font.bodyBlack, fontSize: size.h3, color: color.text },
  hint: { fontFamily: font.bodySemi, fontSize: size.small, color: color.subtle },
  bar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.glassBorder,
    padding: space.sm,
  },
  barMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg },
  barBtn: {
    minHeight: touch.min,
    minWidth: 64,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barBtnText: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.text },
}));
