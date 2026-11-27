import RestAlarm from '../modules/rest-alarm';
import { Platform } from 'react-native';
import { NOTIFY_OK, Notifications } from './notifications';
import { color, fmtClock } from './theme';

/*
 * Rest timer notifications (Android).
 *
 * - "Rest is over" is scheduled the moment rest starts as an EXACT alarm clock (AlarmManager
 *   setAlarmClock: never deferred by battery saving, also with the screen off or the app in the
 *   background), on a high-importance channel that vibrates and plays the sound at 0:00.
 * - The countdown is one ongoing notification with a count-down chronometer that Android draws
 *   itself (no app updates needed), visible on the lock screen, removed by Android at 0:00.
 * - +15s and Skip reschedule or cancel both straight away.
 * Without the native module (tests, web) the countdown falls back to an updated notification.
 */

const LIVE_CHANNEL = 'rest-live';
// Channel settings can't change after creation, so the alarm-style channels have new ids.
const END_CHANNEL = 'rest-end-alarm';
const END_QUIET_CHANNEL = 'rest-end-vibrate';
const OLD_END_CHANNEL = 'rest-end';
const LIVE_ID = 'rest-live';
const END_ID = 'rest-end';
const supported = Platform.OS !== 'web' && NOTIFY_OK;
const VIBRATE = [0, 450, 150, 450, 150, 450];

let channels: Promise<unknown> | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

function ensureChannels() {
  if (!supported || Platform.OS !== 'android') return Promise.resolve();
  channels ??= Promise.all([
    Notifications.setNotificationChannelAsync(LIVE_CHANNEL, {
      name: 'Rest timer (countdown)',
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      vibrationPattern: null,
      enableVibrate: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync(END_CHANNEL, {
      name: 'Rest timer: time is up',
      description: 'Vibrates and plays a sound the moment rest ends, also with the screen off.',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: VIBRATE,
      enableVibrate: true,
      lightColor: color.accent,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      // On the alarm stream, so it is heard like a timer.
      audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM, contentType: Notifications.AndroidAudioContentType.SONIFICATION },
    }),
    Notifications.setNotificationChannelAsync(END_QUIET_CHANNEL, {
      name: 'Rest timer: time is up (sound off)',
      importance: Notifications.AndroidImportance.MAX,
      sound: null,
      vibrationPattern: VIBRATE,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.deleteNotificationChannelAsync(OLD_END_CHANNEL).catch(() => {}),
  ]).catch(() => {});
  return channels;
}

/** The countdown text shown in the fallback notification. */
export const restBody = (endsAt: number, next: string, now = Date.now()) =>
  `${fmtClock(Math.max(0, Math.ceil((endsAt - now) / 1000)))} left · Next: ${next}`;

/** Fallback countdown (no native module): the same notification updated every second. */
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

/** The alarm for the end of rest (exact; the only thing that has to fire with the app asleep). */
export function endTrigger(endsAt: number, sound: boolean) {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(endsAt),
    channelId: sound ? END_CHANNEL : END_QUIET_CHANNEL,
    delivery: 'alarmClock' as const,
  };
}

/** Start (or restart, e.g. after +15s) the rest notifications for a rest ending at `endsAt`. */
export async function startRestNotification(endsAt: number, next: string, sound: boolean) {
  if (!supported) return;
  await stopRestNotification();
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    identifier: END_ID,
    content: {
      title: 'Rest is over',
      body: `Next: ${next}`,
      sound: sound ? 'default' : false,
      vibrate: VIBRATE,
      priority: Notifications.AndroidNotificationPriority.MAX,
      color: color.accent,
      data: { rest: true },
    },
    trigger: endTrigger(endsAt, sound),
  }).catch(() => {});
  if (RestAlarm) {
    await RestAlarm.showCountdown(endsAt, 'Resting', `Next: ${next}`, LIVE_CHANNEL, color.accent).catch(() => {});
    return;
  }
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

/** Remove the countdown and cancel the end alert (rest skipped, or the workout closed). */
export async function stopRestNotification() {
  if (ticker) clearInterval(ticker);
  ticker = null;
  if (!supported) return;
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(END_ID).catch(() => {}),
    Notifications.dismissNotificationAsync(LIVE_ID).catch(() => {}),
    RestAlarm?.cancelCountdown().catch(() => {}),
  ]);
}
