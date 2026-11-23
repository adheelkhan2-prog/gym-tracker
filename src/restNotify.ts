import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { color, fmtClock } from './theme';

/*
 * Rest timer notifications (Android).
 *
 * expo-notifications (SDK 58) has no native chronometer, so the countdown is an ongoing ("sticky")
 * notification on a silent low-importance channel, updated in place every second under the same
 * id while the app runs, visible on the lock screen. The end of rest is a separate notification
 * scheduled for the exact end time on a high-importance channel with sound, so it fires even if
 * Android pauses the app. Both go away when the rest is skipped or ends.
 */

const LIVE_CHANNEL = 'rest-live';
const END_CHANNEL = 'rest-end';
const LIVE_ID = 'rest-live';
const END_ID = 'rest-end';
const supported = Platform.OS !== 'web';

let channels: Promise<unknown> | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

function ensureChannels() {
  if (!supported || Platform.OS !== 'android') return Promise.resolve();
  channels ??= Promise.all([
    Notifications.setNotificationChannelAsync(LIVE_CHANNEL, {
      name: 'Rest timer (countdown)',
      // eslint-disable-next-line import/namespace -- exported at runtime; the lint parser misses it
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      vibrationPattern: null,
      enableVibrate: false,
      // eslint-disable-next-line import/namespace -- exported at runtime
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync(END_CHANNEL, {
      name: 'Rest timer (time is up)',
      // eslint-disable-next-line import/namespace -- exported at runtime
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 120, 300],
      lightColor: color.accent,
      // eslint-disable-next-line import/namespace -- exported at runtime
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
  ]).catch(() => {});
  return channels;
}

/** The countdown text shown in the ongoing notification. */
export const restBody = (endsAt: number, next: string, now = Date.now()) =>
  `${fmtClock(Math.max(0, Math.ceil((endsAt - now) / 1000)))} left · Next: ${next}`;

async function showLive(endsAt: number, next: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: LIVE_ID,
    content: {
      title: 'Resting',
      body: restBody(endsAt, next),
      sticky: true,
      autoDismiss: false,
      color: color.accent,
      sound: false,
      data: { rest: true },
    },
    trigger: Platform.OS === 'android' ? { channelId: LIVE_CHANNEL } : null,
  });
}

/** Start (or restart) the rest notifications for a rest ending at `endsAt`. */
export async function startRestNotification(endsAt: number, next: string, sound: boolean) {
  if (!supported) return;
  await stopRestNotification();
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    identifier: END_ID,
    content: { title: 'Rest is over', body: `Next: ${next}`, sound: sound ? 'default' : false, color: color.accent, data: { rest: true } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt), channelId: END_CHANNEL },
  }).catch(() => {});
  await showLive(endsAt, next).catch(() => {});
  ticker = setInterval(() => {
    if (Date.now() >= endsAt) {
      if (ticker) clearInterval(ticker);
      ticker = null;
      Notifications.dismissNotificationAsync(LIVE_ID).catch(() => {});
      return;
    }
    showLive(endsAt, next).catch(() => {});
  }, 1000);
}

/** Remove the countdown and cancel the end alert (rest skipped, or the screen closed). */
export async function stopRestNotification() {
  if (ticker) clearInterval(ticker);
  ticker = null;
  if (!supported) return;
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(END_ID).catch(() => {}),
    Notifications.dismissNotificationAsync(LIVE_ID).catch(() => {}),
  ]);
}
