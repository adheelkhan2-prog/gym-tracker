// A list row you can drag up or down by its handle to reorder (the arrow buttons next to it do the
// same for screen readers and switch access). The row follows your finger; on release it moves by
// however many rows you dragged it.
import React, { useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { haptic } from '../feedback';
import { color, motion } from '../theme';
import { Icon } from './icons';

export function DragRow({
  index,
  count,
  onMove,
  label,
  children,
}: {
  index: number;
  count: number;
  /** Move this row from `index` to `to`. */
  onMove: (from: number, to: number) => void;
  label: string;
  children: React.ReactNode;
}) {
  const [h, setH] = useState(64);
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  const drop = (dy: number) => {
    const to = Math.max(0, Math.min(count - 1, index + Math.round(dy / Math.max(1, h))));
    if (to !== index) {
      haptic.setDone();
      onMove(index, to);
    }
  };
  const pan = usePanGesture({
    activeOffsetY: [-6, 6],
    onBegin: () => {
      'worklet';
      lifted.set(withSpring(1, motion.spring));
    },
    onUpdate: (e) => {
      'worklet';
      y.set(e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      scheduleOnRN(drop, e.translationY);
      y.set(0);
      lifted.set(withSpring(0, motion.spring));
    },
    onFinalize: () => {
      'worklet';
      lifted.set(withSpring(0, motion.spring));
    },
  });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: 1 + lifted.value * 0.02 }],
    zIndex: lifted.value > 0.01 ? 10 : 0,
    shadowOpacity: lifted.value * 0.35,
  }));
  return (
    <Animated.View style={[{ shadowColor: color.shadow, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, style]} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <GestureDetector gesture={pan}>
          <View style={{ width: 32, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Drag to reorder ${label}`} accessibilityHint="Use the arrow buttons to move it with a screen reader">
            <Icon name="drag" size={18} color={color.subtle} />
          </View>
        </GestureDetector>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </Animated.View>
  );
}
