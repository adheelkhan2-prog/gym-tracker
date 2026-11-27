// − [number] + for a set row: tap − / + to step, press and hold to repeat quickly with a light
// haptic tick. The number in the middle (children) can still be tapped to type.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { haptic } from '../feedback';
import { color, radius, themed, touch } from '../theme';
import { Icon } from './icons';
import { Tap } from './Tap';

/** A hold stops by itself after this many steps, even if the release is somehow never seen. */
const MAX_REPEATS = 80;

/**
 * − [number] +. Tap − / + to step; press and hold to repeat quickly with a light haptic tick. The
 * number in the middle can still be tapped to type.
 */
export function Stepper({
  onStep,
  disabled,
  name,
  testID,
  warn,
  children,
}: {
  onStep: (dir: 1 | -1) => void;
  disabled: boolean;
  name: string;
  testID: string;
  warn: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.stepBox, warn && s.inputWarn, disabled && s.stepBoxDone]}>
      {!disabled && <HoldButton dir={-1} onStep={onStep} label={`Less ${name}`} testID={`${testID}-minus`} />}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {!disabled && <HoldButton dir={1} onStep={onStep} label={`More ${name}`} testID={`${testID}-plus`} />}
    </View>
  );
}

function HoldButton({ dir, onStep, label, testID }: { dir: 1 | -1; onStep: (dir: 1 | -1) => void; label: string; testID: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const left = useRef(0);
  // The newest onStep, so a running repeat never steps from a stale value.
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  }, [onStep]);
  const stop = () => {
    held.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const repeat = (delay: number) => {
    timer.current = setTimeout(() => {
      if (!held.current || --left.current <= 0) return stop();
      haptic.tap();
      step.current(dir);
      repeat(Math.max(60, delay * 0.85));
    }, delay);
  };
  return (
    <Tap
      // A tap steps once. Press and hold: after a short pause it repeats, a little faster each
      // time, until you let go (a quick tap can never leave a repeat running).
      onPress={() => {
        haptic.tap();
        step.current(dir);
      }}
      delayLongPress={350}
      onLongPress={() => {
        stop();
        held.current = true;
        left.current = MAX_REPEATS;
        haptic.tap();
        step.current(dir);
        repeat(110);
      }}
      onPressOut={stop}
      android_disableSound
      style={({ pressed }) => [s.stepBtn, pressed && s.stepBtnOn]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Icon name={dir > 0 ? 'plus' : 'minus'} size={18} color={color.text} />
    </Tap>
  );
}

const s = themed(() =>
  StyleSheet.create({
    stepBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: touch.min,
      borderRadius: radius.md,
      backgroundColor: color.surface2,
      borderWidth: 1,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    stepBoxDone: { justifyContent: 'center' },
    stepBtn: { width: 40, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
    stepBtnOn: { backgroundColor: color.glassPressed },
    inputWarn: { borderColor: color.warnEdge, backgroundColor: color.warnDim },
  }),
);
