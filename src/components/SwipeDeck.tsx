import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { haptic } from '../feedback';
import { color, font, motion, radius, size, space, type } from '../theme';
import { BodyModel, type PaintMap } from './body/BodyModel';
import { Glass } from './glass';
import { Icon } from './icons';

export type DeckItem = {
  key: string;
  index: number;
  total: number;
  name: string;
  target: string;
  last: string;
  status: 'todo' | 'partial' | 'done' | 'skipped';
  progress: string;
  paint: PaintMap;
  muscles: string;
};

const SWIPE = 110;

function CardFace({ item, live }: { item: DeckItem; live: boolean }) {
  const done = item.status === 'done';
  return (
    <Glass style={s.card} strong={live} glow={live ? color.lime : undefined} r={radius.xxl}>
      <View style={s.top}>
        <Text style={s.index}>
          {String(item.index + 1).padStart(2, '0')}
          <Text style={s.of}> / {String(item.total).padStart(2, '0')}</Text>
        </Text>
        {item.status !== 'todo' && (
          <View style={[s.status, done && { backgroundColor: color.lime }, item.status === 'skipped' && { backgroundColor: color.surface3 }]}>
            <Icon name={done ? 'check' : item.status === 'skipped' ? 'bandage' : 'layers'} size={14} color={done ? color.ink : color.text} />
            <Text style={[s.statusText, done && { color: color.ink }]}>{done ? 'Done' : item.status === 'skipped' ? 'Skipped' : item.progress}</Text>
          </View>
        )}
      </View>
      <View style={s.body}>
        {live ? (
          <BodyModel paint={item.paint} height={230} interactive={false} showHint={false} />
        ) : (
          <View style={{ height: 230 }} />
        )}
      </View>
      <Text style={s.name} numberOfLines={2}>
        {item.name}
      </Text>
      <View style={s.metaRow}>
        <Text style={s.target}>{item.target}</Text>
        <Text style={s.last} numberOfLines={1}>
          {item.last}
        </Text>
      </View>
      <Text style={s.muscles} numberOfLines={1}>
        {item.muscles}
      </Text>
    </Glass>
  );
}

/**
 * A deck of big exercise cards. Swipe right to start the top card, swipe left to
 * send it to the back. Springs follow the finger and can be interrupted mid-flight.
 */
export function SwipeDeck({
  items,
  index,
  onIndex,
  onStart,
}: {
  items: DeckItem[];
  index: number;
  onIndex: (i: number) => void;
  onStart: (item: DeckItem) => void;
}) {
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const n = items.length;

  useEffect(() => {
    x.set(0);
    y.set(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // The gesture's worklets call these; refs make sure they always see the current card.
  const latest = useRef({ index, items, onIndex, onStart });
  useEffect(() => {
    latest.current = { index, items, onIndex, onStart };
  });
  const next = () => {
    haptic.tap();
    const l = latest.current;
    l.onIndex((l.index + 1) % l.items.length);
  };
  const start = () => {
    haptic.setDone();
    const l = latest.current;
    l.onStart(l.items[l.index]);
  };

  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-14, 14],
    onUpdate: (e) => {
      'worklet';
      x.set(e.translationX);
      y.set(e.translationY * 0.25);
    },
    onDeactivate: (e) => {
      'worklet';
      const fling = e.translationX + e.velocityX * 0.15;
      if (fling > SWIPE) {
        x.set(withSpring(width * 1.3, { ...motion.swipe, velocity: e.velocityX }));
        scheduleOnRN(start);
      } else if (fling < -SWIPE) {
        x.set(withSpring(-width * 1.3, { ...motion.swipe, velocity: e.velocityX }, (fin) => {
          if (fin) scheduleOnRN(next);
        }));
      } else {
        x.set(withSpring(0, motion.spring));
        y.set(withSpring(0, motion.spring));
      }
    },
  });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, 0, width], [-12, 0, 12])}deg` },
    ],
  }));
  const startHint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, SWIPE], [0, 1], 'clamp') }));
  const nextHint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-SWIPE, 0], [1, 0], 'clamp') }));
  const behind = (depth: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const lift = reduce ? 0 : interpolate(Math.abs(x.value), [0, SWIPE], [0, 1], 'clamp');
      const d = depth - lift;
      return { transform: [{ translateY: d * 16 }, { scale: 1 - d * 0.05 }], opacity: 1 - d * 0.3 };
    });
  const behind1 = behind(1);
  const behind2 = behind(2);

  if (!n) return null;
  const at = (k: number) => items[(index + k) % n];

  return (
    <View style={s.deck}>
      {n > 2 && (
        <Animated.View style={[s.layer, behind2]} pointerEvents="none">
          <CardFace item={at(2)} live={false} />
        </Animated.View>
      )}
      {n > 1 && (
        <Animated.View style={[s.layer, behind1]} pointerEvents="none">
          <CardFace item={at(1)} live={false} />
        </Animated.View>
      )}
      <GestureDetector gesture={pan}>
        <Animated.View style={[s.layer, topStyle]} accessible accessibilityRole="button" accessibilityLabel={`${at(0).name}. Swipe right to start, left for the next exercise.`}>
          <CardFace item={at(0)} live />
          <Animated.View style={[s.stamp, s.stampStart, startHint]} pointerEvents="none">
            <Text style={[s.stampText, { color: color.ink }]}>START</Text>
          </Animated.View>
          <Animated.View style={[s.stamp, s.stampNext, nextHint]} pointerEvents="none">
            <Text style={s.stampText}>NEXT</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export const DECK_HEIGHT = 470;

const s = StyleSheet.create({
  deck: { height: DECK_HEIGHT + space.x3 },
  layer: { position: 'absolute', left: 0, right: 0, top: 0 },
  card: { height: DECK_HEIGHT, padding: space.xl },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  index: { fontFamily: font.display, fontSize: size.h2, color: color.lime, fontVariant: ['tabular-nums'] },
  of: { fontFamily: font.bodyBold, fontSize: size.small, color: color.subtle },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.surface3,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  statusText: { fontFamily: font.bodyBlack, fontSize: size.label, color: color.text },
  body: { marginTop: space.sm, marginHorizontal: -space.md },
  name: { fontFamily: font.display, fontSize: size.title, lineHeight: 32, letterSpacing: -0.6, color: color.text, marginTop: space.sm },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, marginTop: space.xs },
  target: { fontFamily: font.display, fontSize: size.h3, color: color.lime },
  last: { flex: 1, ...type.small },
  muscles: { ...type.small, color: color.subtle, marginTop: space.xs },
  stamp: {
    position: 'absolute',
    top: space.x3,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 3,
  },
  stampStart: { left: space.xl, backgroundColor: color.lime, borderColor: color.lime, transform: [{ rotate: '-12deg' }] },
  stampNext: { right: space.xl, borderColor: color.text, transform: [{ rotate: '12deg' }] },
  stampText: { fontFamily: font.display, fontSize: size.h2, letterSpacing: 2, color: color.text },
});
