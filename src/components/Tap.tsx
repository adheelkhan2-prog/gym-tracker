// A pressable for controls that sit inside the workout's swipe-between-exercises area (− / +, the
// number boxes, the Pin | kg switch, the log check). It is the gesture handler's own Pressable, so
// the press and the page swipe are settled natively: while a press is on a control, the swipe waits
// for it and can't steal the touch. React Native's Pressable lost taps (and could miss the release
// that ends a hold-to-repeat) when the swipe gesture took over.
import React, { createContext, useContext } from 'react';
import { Pressable, type PanGesture, type PressableProps } from 'react-native-gesture-handler';

/** The workout's page-swipe gesture, for controls inside it to block. */
export const PageSwipe = createContext<PanGesture | null>(null);

export function Tap(props: PressableProps) {
  const swipe = useContext(PageSwipe);
  return <Pressable {...props} block={swipe ?? undefined} />;
}
