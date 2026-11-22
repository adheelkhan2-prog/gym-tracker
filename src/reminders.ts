import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { todayKey, type State } from './store';

/*
 * How the supplement reminders work
 * ---------------------------------
 * For each of the next DAYS_AHEAD days we schedule one notification per reminder
 * time (default 08:00, 13:00, 19:00). Each notification has two buttons:
 *
 *   "Taken"        -> opens the app, marks today's supplements as taken and
 *                     cancels the rest of today's reminders.
 *   "Not yet"      -> just dismisses. The 1 pm / 7 pm follow-ups are already
 *                     scheduled, so you get nagged again later.
 *
 * Because the follow-ups are scheduled in advance, they fire even if the app
 * is closed. Each time the app opens, or a supplement is ticked, we rebuild
 * the schedule so it stays DAYS_AHEAD days long.
 */

export const SUPPORTED = Platform.OS !== 'web';
const CHANNEL = 'supplements';
const CATEGORY = 'supplement';
const PREFIX = 'supp-';
const DAYS_AHEAD = 10;
export const ACTION_TAKEN = 'TAKEN';
export const ACTION_LATER = 'NOT_YET';

if (SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function setupNotifications(): Promise<boolean> {
  if (!SUPPORTED) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Supplement reminders',
      // eslint-disable-next-line import/namespace -- exported at runtime; the lint parser misses it
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#C6F432',
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: ACTION_TAKEN, buttonTitle: 'Taken ✓', options: { opensAppToForeground: true } },
    { identifier: ACTION_LATER, buttonTitle: 'Not yet', options: { opensAppToForeground: false } },
  ]);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

const atTime = (dateKey: string, hhmm: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
};

/** Rebuild every scheduled supplement reminder from the current state. */
export async function syncReminders(state: State) {
  if (!SUPPORTED) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  if (!state.remindersOn || !state.supplements.length) return;
  const now = new Date();
  const list = state.supplements.join(' + ').toLowerCase();

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = todayKey(day);
    const takenToday = state.taken[key] ?? {};
    const missing = state.supplements.filter((s) => !takenToday[s]);
    if (!missing.length) continue;
    const what = (i === 0 ? missing.join(' + ') : list).toLowerCase();

    for (const [slot, time] of state.reminderTimes.entries()) {
      const when = atTime(key, time);
      if (when <= now) continue;
      const first = slot === 0;
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${key}-${slot}`,
        content: {
          title: first ? 'Morning stack 💪' : 'Still need your supplements',
          body: first ? `Time for your ${what}.` : `You haven't marked your ${what} as taken today.`,
          categoryIdentifier: CATEGORY,
          data: { date: key, slot },
          ...(Platform.OS === 'android' ? { color: '#C6F432' } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
      });
    }
  }
}

/** Listen for taps on reminder notifications / their buttons. */
export function onReminderResponse(handler: (date: string, action: 'taken' | 'later' | 'open') => void) {
  if (!SUPPORTED) return () => {};
  const handle = (r: Notifications.NotificationResponse | null) => {
    if (!r) return;
    const data = r.notification.request.content.data as { date?: string } | undefined;
    if (!r.notification.request.identifier.startsWith(PREFIX) || !data?.date) return;
    const action =
      r.actionIdentifier === ACTION_TAKEN ? 'taken' : r.actionIdentifier === ACTION_LATER ? 'later' : 'open';
    Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
    handler(data.date, action);
    Notifications.clearLastNotificationResponse?.();
  };
  // App was launched by tapping a notification button.
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
