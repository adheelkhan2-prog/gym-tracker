import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics are a no-op on web.
const on = Platform.OS !== 'web';

export const haptic = {
  tap: () => on && Haptics.selectionAsync().catch(() => {}),
  setDone: () => on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  timerEnd: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  /** Something is missing (e.g. Log set with no reps): a small warning buzz. */
  warn: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  pr: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  thump: () => on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
};
