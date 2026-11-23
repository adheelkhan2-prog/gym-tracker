import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { todayKey, type State } from './store';
import { color } from './theme';

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
      lightColor: color.lime,
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

export type PlannedReminder = { id: string; when: Date; title: string; body: string; date: string; slot: number };

/**
 * The reminders that should be scheduled right now (pure, so it is unit-tested).
 * For today and the next DAYS_AHEAD - 1 days: one per reminder time that is still in the future,
 * skipping any day whose supplements are all marked taken. The first time of the day is the
 * morning reminder; later ones are the "still need them" follow-ups.
 */
export function planReminders(state: Pick<State, 'remindersOn' | 'supplements' | 'taken' | 'reminderTimes'>, now: Date): PlannedReminder[] {
  if (!state.remindersOn || !state.supplements.length) return [];
  const out: PlannedReminder[] = [];
  const list = state.supplements.join(' + ').toLowerCase();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = todayKey(day);
    const takenToday = state.taken[key] ?? {};
    const missing = state.supplements.filter((s) => !takenToday[s]);
    if (!missing.length) continue;
    const what = (i === 0 ? missing.join(' + ') : list).toLowerCase();
    state.reminderTimes.forEach((time, slot) => {
      const when = atTime(key, time);
      if (when <= now) return;
      const first = slot === 0;
      out.push({
        id: `${PREFIX}${key}-${slot}`,
        when,
        date: key,
        slot,
        title: first ? 'Morning stack' : 'Still need your supplements',
        body: first ? `Time for your ${what}.` : `You haven't marked your ${what} as taken today.`,
      });
    });
  }
  return out;
}

// Syncs run one at a time, and a sync that a newer one has overtaken stops before scheduling
// anything, so ticking two supplements quickly can never leave a stale follow-up behind.
let generation = 0;
let queue: Promise<void> = Promise.resolve();

/** Rebuild every scheduled supplement reminder from the current state. */
export function syncReminders(state: State): Promise<void> {
  if (!SUPPORTED) return Promise.resolve();
  const gen = ++generation;
  const run = async () => {
    if (gen !== generation) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    for (const r of planReminders(state, new Date())) {
      if (gen !== generation) return;
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: {
          title: r.title,
          body: r.body,
          categoryIdentifier: CATEGORY,
          data: { date: r.date, slot: r.slot },
          ...(Platform.OS === 'android' ? { color: color.lime } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.when, channelId: CHANNEL },
      });
    }
  };
  queue = queue.then(run, run);
  return queue;
}

/** What a tap on a reminder does: "Taken" marks every supplement for that day; "Not yet" and a plain tap change nothing. */
export function applyReminderAction<S extends Pick<State, 'taken' | 'supplements'>>(state: S, date: string, action: 'taken' | 'later' | 'open'): S {
  if (action !== 'taken') return state;
  return { ...state, taken: { ...state.taken, [date]: Object.fromEntries(state.supplements.map((x) => [x, true])) } };
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
