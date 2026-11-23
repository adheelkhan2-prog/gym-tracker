import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, SlideInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { color, motion, radius, space, type } from '../theme';
import { Glass } from './glass';
import { Press } from './ui';

/**
 * Glass bottom sheet. Drag the header down (or tap the scrim) to close; the body scrolls.
 * Render it last inside a full-screen parent so it sits on top.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  testID,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const y = useSharedValue(0);

  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      'worklet';
      y.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 120 || e.velocityY > 900) {
        y.set(withSpring(height, { ...motion.swipe, velocity: e.velocityY }));
        scheduleOnRN(onClose);
      } else y.set(withSpring(0, motion.spring));
    },
  });
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(motion.fast)} style={s.scrim} testID={testID}>
      <Press
        onPress={onClose}
        tick={false}
        scaleTo={1}
        glow={color.bg}
        style={[StyleSheet.absoluteFill, { borderRadius: 0 }]}
        accessibilityLabel={`Close ${title}`}
      >
        <View />
      </Press>
      <Animated.View entering={SlideInDown.springify().damping(18)} style={[s.wrap, sheet]}>
        <Glass strong r={radius.xxl} style={[s.sheet, { maxHeight: height * 0.86, paddingBottom: insets.bottom + space.md }]}>
          <GestureDetector gesture={pan}>
            <View style={s.head} accessibilityRole="header">
              <View style={s.grabber} />
              <Text style={type.h2}>{title}</Text>
              {subtitle ? <Text style={[type.small, { marginTop: space.xxs }]}>{subtitle}</Text> : null}
            </View>
          </GestureDetector>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: space.md }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer}
        </Glass>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim, justifyContent: 'flex-end', zIndex: 50 },
  wrap: { paddingHorizontal: space.sm },
  sheet: { paddingHorizontal: space.lg },
  head: { paddingTop: space.md, paddingBottom: space.md },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: radius.pill, backgroundColor: color.glassBorder, marginBottom: space.md },
});
