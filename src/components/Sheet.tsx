import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { color, radius, space, themed, type } from '../theme';
import { Glass } from './glass';
import { Press } from './ui';

/** A soft, critically damped spring: no bounce at the top, no jump. */
const OPEN = { damping: 26, stiffness: 240, mass: 0.9, overshootClamping: true } as const;
const CLOSE_MS = 200;

/**
 * Bottom sheet. Slides up on a soft spring while the backdrop fades in; drag the header down (or tap
 * the backdrop) to close, and it slides away before it's gone. One shared value drives both the
 * sheet and the backdrop, on the UI thread, so it stays at 60 fps and the backdrop follows your
 * finger while you drag. Render it last inside a full-screen parent so it sits on top.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  testID,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testID?: string;
  /** false when children bring their own (virtualized) list, which must not sit inside a ScrollView. */
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduce = useReducedMotion();
  // 0 = open; `height` = fully below the screen.
  const y = useSharedValue(reduce ? 0 : height);
  const closing = useRef(false);
  // A double tap on the button that opened the sheet must not land on the backdrop and close it.
  const opened = useRef(0);
  useEffect(() => {
    opened.current = Date.now();
    if (!reduce) y.set(withSpring(0, OPEN));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = () => onClose();
  /** Slide away, then tell the parent (which unmounts the sheet). */
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (reduce) return onClose();
    y.set(
      withTiming(height, { duration: CLOSE_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(done);
      }),
    );
  };
  const closeFromBackdrop = () => {
    if (Date.now() - opened.current > 500) close();
  };

  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      'worklet';
      y.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 120 || e.velocityY > 900) scheduleOnRN(close);
      else y.set(withSpring(0, OPEN));
    },
  });
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  // The backdrop is fully dark when the sheet is up and fades as it goes down (also while dragging).
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, height * 0.6], [1, 0], 'clamp') }));

  return (
    <View style={s.root} testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, s.scrim, backdrop]}>
        <Press
          onPress={closeFromBackdrop}
          tick={false}
          scaleTo={1}
          glow="transparent"
          style={[StyleSheet.absoluteFill, { borderRadius: 0 }]}
          accessibilityLabel={`Close ${title}`}
        >
          <View />
        </Press>
      </Animated.View>
      <Animated.View style={[s.wrap, sheet]}>
        <Glass r={radius.xxl} style={[s.sheet, { maxHeight: height * 0.86, paddingBottom: insets.bottom + space.md }]}>
          <GestureDetector gesture={pan}>
            <View style={s.head} accessibilityRole="header">
              <View style={s.grabber} />
              <Text style={type.h2}>{title}</Text>
              {subtitle ? <Text style={[type.small, { marginTop: space.xxs }]}>{subtitle}</Text> : null}
            </View>
          </GestureDetector>
          {scroll ? (
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: space.md }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={{ flexShrink: 1 }}>{children}</View>
          )}
          {footer}
        </Glass>
      </Animated.View>
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 50 },
    scrim: { backgroundColor: color.scrim },
    wrap: { paddingHorizontal: space.sm },
    sheet: { paddingHorizontal: space.lg },
    head: { paddingTop: space.md, paddingBottom: space.md },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: radius.pill, backgroundColor: color.glassBorder, marginBottom: space.md },
  }),
);
