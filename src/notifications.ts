// expo-notifications, loaded guarded (see src/safe.tsx): if the native module can't load, the app
// keeps working without reminders instead of crashing. All notifications are LOCAL (scheduled on the
// phone); no push service, no network.
import { Platform } from 'react-native';
import { safeRequire } from './safe';

type N = typeof import('expo-notifications');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded optional native module
const mod = Platform.OS === 'web' ? null : safeRequire<N>('expo-notifications', () => require('expo-notifications'));

/** True when local notifications can be used on this device. */
export const NOTIFY_OK = mod !== null;
/** The module; only touch it after checking NOTIFY_OK. */
export const Notifications = mod as N;
