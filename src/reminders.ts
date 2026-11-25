import { NOTIFY_OK, Notifications } from './notifications';
import type { NotificationResponse } from 'expo-notifications';
import { Platform } from 'react-native';
import { reminderFor, todayKey, type State } from './store';
import { color } from './theme';

/*
 * How the supplement reminders work
 * ---------------------------------
 * Every supplement has its own reminders: a morning one, follow-ups while it isn't marked taken,
 * and a last call (see SuppReminder in store.tsx). For each of the next DAYS_AHEAD days we schedule
 * one notification per time, per supplement ("Time for your creatine"), each with two buttons:
 *
 *   "Taken"        -> opens the app and marks THAT supplement taken for the day, which cancels
 *                     only its own remaining reminders. Other supplements keep theirs.
 *   "Not yet"      -> just dismisses. The follow-ups are already scheduled, so you get nagged
 *                     again later.
 *
 * Because the follow-ups are scheduled in advance, they fire even if the app is closed. Each time
 * the app opens, or a supplement is ticked, the schedule is rebuilt so it stays DAYS_AHEAD days long.
 */

export const SUPPORTED = Platform.OS !== 'web' && NOTIFY_OK;
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
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: color.accent,
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

export type PlannedReminder = { id: string; when: Date; title: string; body: string; date: string; slot: number; supp: string };

/** A short, stable id part for a supplement name. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'supp';

/** "creatine" for the notification text (names keep their own capitals after the first word). */
const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

/**
 * The reminders that should be scheduled right now (pure, so it is unit-tested).
 * For each supplement whose reminders are on, for today and the next DAYS_AHEAD - 1 days: one per
 * time still in the future, skipping any day it's already marked taken.
 */
export function planReminders(state: Pick<State, 'supplements' | 'taken' | 'suppReminders'>, now: Date): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  state.supplements.forEach((name, n) => {
    const r = reminderFor(state, name);
    if (!r.on) return;
    const times = [r.morning, ...r.followUps, ...(r.lastCall ? [r.lastCall] : [])];
    const what = lower(name);
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = todayKey(day);
      if (state.taken[key]?.[name]) continue;
      times.forEach((time, slot) => {
        const when = atTime(key, time);
        if (when <= now) return;
        const last = !!r.lastCall && slot === times.length - 1;
        out.push({
          id: `${PREFIX}${slug(name)}${n}-${key}-${slot}`,
          when,
          date: key,
          slot,
          supp: name,
          title: slot === 0 ? `Time for your ${what}` : last ? `Last call: ${what}` : `Still need your ${what}?`,
          body: slot === 0 ? `Tap Taken once you've had it.` : `You haven't marked your ${what} as taken today.`,
        });
      });
    }
  });
  return out.sort((a, b) => a.when.getTime() - b.when.getTime());
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
          data: { date: r.date, slot: r.slot, supp: r.supp },
          ...(Platform.OS === 'android' ? { color: color.accent } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.when, channelId: CHANNEL },
      });
    }
  };
  queue = queue.then(run, run);
  return queue;
}

/**
 * What a tap on a reminder does: "Taken" marks that one supplement for that day (older
 * notifications without a supplement mark them all); "Not yet" and a plain tap change nothing.
 */
export function applyReminderAction<S extends Pick<State, 'taken' | 'supplements'>>(state: S, date: string, action: 'taken' | 'later' | 'open', supp?: string): S {
  if (action !== 'taken') return state;
  const names = supp && state.supplements.includes(supp) ? [supp] : state.supplements;
  return { ...state, taken: { ...state.taken, [date]: { ...state.taken[date], ...Object.fromEntries(names.map((x) => [x, true])) } } };
}

/** Send one supplement's reminder in a few seconds, to check notifications work. */
export async function sendTestReminder(name: string, date: string) {
  if (!SUPPORTED) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `${PREFIX}test-${slug(name)}`,
    content: {
      title: `Time for your ${lower(name)}`,
      body: 'Test reminder. Tap Taken to mark it.',
      categoryIdentifier: CATEGORY,
      data: { date, slot: -1, supp: name },
      ...(Platform.OS === 'android' ? { color: color.accent } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}

/** Listen for taps on reminder notifications / their buttons. */
export function onReminderResponse(handler: (date: string, action: 'taken' | 'later' | 'open', supp?: string) => void) {
  if (!SUPPORTED) return () => {};
  const handle = (r: NotificationResponse | null) => {
    if (!r) return;
    const data = r.notification.request.content.data as { date?: string; supp?: string } | undefined;
    if (!r.notification.request.identifier.startsWith(PREFIX) || !data?.date) return;
    const action =
      r.actionIdentifier === ACTION_TAKEN ? 'taken' : r.actionIdentifier === ACTION_LATER ? 'later' : 'open';
    Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
    handler(data.date, action, data.supp);
    Notifications.clearLastNotificationResponse?.();
  };
  // App was launched by tapping a notification button.
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
