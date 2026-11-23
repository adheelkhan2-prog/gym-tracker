/**
 * Creatine / protein reminders: morning reminder, the "Not yet" option, 1 PM and 7 PM follow-ups,
 * nothing once marked taken, restarts, midnight, and the Android 13+ permission flow.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ACTION_LATER, ACTION_TAKEN, applyReminderAction, planReminders, setupNotifications, syncReminders } from '../reminders';
import { DEFAULT_STATE, type State } from '../store';

jest.mock('expo-notifications', () => {
  const scheduled: { identifier: string }[] = [];
  return {
    __scheduled: scheduled,
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    setNotificationCategoryAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async () => ({ granted: false })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getAllScheduledNotificationsAsync: jest.fn(async () => [...scheduled]),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
      const i = scheduled.findIndex((n) => n.identifier === id);
      if (i >= 0) scheduled.splice(i, 1);
    }),
    scheduleNotificationAsync: jest.fn(async (req: { identifier: string }) => {
      // Let other work run between schedule calls, like the real native bridge.
      await new Promise((r) => setTimeout(r, 1));
      scheduled.push(req);
      return req.identifier;
    }),
    AndroidImportance: { HIGH: 4 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
  };
});

const N = Notifications as unknown as typeof Notifications & { __scheduled: { identifier: string; content: { body: string } }[] };

const base: State = { ...DEFAULT_STATE, supplements: ['Creatine', 'Protein'], remindersOn: true, reminderTimes: ['08:00', '13:00', '19:00'], taken: {} };
const at = (y: number, m: number, d: number, hh: number, mm = 0) => new Date(y, m - 1, d, hh, mm);
const ids = (now: Date, s = base) => planReminders(s, now).map((r) => r.id);
const today = (now: Date, s = base) => planReminders(s, now).filter((r) => r.date === '2026-11-23');

describe('schedule', () => {
  test('before 8 AM: morning reminder plus the 1 PM and 7 PM follow-ups today', () => {
    const r = today(at(2026, 11, 23, 7));
    expect(r.map((x) => [x.when.getHours(), x.title])).toEqual([
      [8, 'Morning stack'],
      [13, 'Still need your supplements'],
      [19, 'Still need your supplements'],
    ]);
    expect(r[0].body).toBe('Time for your creatine + protein.');
    expect(r[1].body).toBe("You haven't marked your creatine + protein as taken today.");
  });

  test('after the morning reminder: only the follow-ups still to come', () => {
    expect(today(at(2026, 11, 23, 10)).map((x) => x.when.getHours())).toEqual([13, 19]);
    expect(today(at(2026, 11, 23, 15)).map((x) => x.when.getHours())).toEqual([19]);
    expect(today(at(2026, 11, 23, 19, 30))).toHaveLength(0);
  });

  test('no reminders for a day once everything is marked taken', () => {
    const s = { ...base, taken: { '2026-11-23': { Creatine: true, Protein: true } } };
    expect(today(at(2026, 11, 23, 9), s)).toHaveLength(0);
    // ...but the next days are still scheduled.
    expect(ids(at(2026, 11, 23, 9), s)).toContain('supp-2026-11-24-0');
  });

  test('half taken: follow-ups name only what is missing', () => {
    const s = { ...base, taken: { '2026-11-23': { Creatine: true } } };
    expect(today(at(2026, 11, 23, 9), s).map((x) => x.body)).toEqual([
      "You haven't marked your protein as taken today.",
      "You haven't marked your protein as taken today.",
    ]);
  });

  test('reminders off, or no supplements: nothing scheduled', () => {
    expect(planReminders({ ...base, remindersOn: false }, at(2026, 11, 23, 7))).toEqual([]);
    expect(planReminders({ ...base, supplements: [] }, at(2026, 11, 23, 7))).toEqual([]);
  });

  test('across midnight: late evening schedules tomorrow from the morning; just after midnight, the new day', () => {
    const late = planReminders(base, at(2026, 11, 23, 23, 59));
    expect(late[0]).toMatchObject({ id: 'supp-2026-11-24-0', date: '2026-11-24' });
    expect(late[0].when).toEqual(at(2026, 11, 24, 8));
    const early = planReminders(base, at(2026, 11, 24, 0, 30));
    expect(early.slice(0, 3).map((x) => x.id)).toEqual(['supp-2026-11-24-0', 'supp-2026-11-24-1', 'supp-2026-11-24-2']);
    // Month and year boundaries too.
    expect(planReminders(base, at(2026, 12, 31, 20))[0].id).toBe('supp-2027-01-01-0');
  });

  test('10 days ahead, with stable ids, so rebuilding after a restart replaces rather than duplicates', () => {
    const now = at(2026, 11, 23, 7);
    const a = ids(now);
    expect(new Set(a.map((x) => x.slice(5, 15))).size).toBe(10);
    expect(new Set(a).size).toBe(a.length);
    expect(ids(now)).toEqual(a);
  });
});

describe('taking action on a reminder', () => {
  test('"Taken" marks every supplement for that day; "Not yet" and a plain tap change nothing', () => {
    const marked = applyReminderAction(base, '2026-11-23', 'taken');
    expect(marked.taken['2026-11-23']).toEqual({ Creatine: true, Protein: true });
    expect(applyReminderAction(base, '2026-11-23', 'later')).toBe(base);
    expect(applyReminderAction(base, '2026-11-23', 'open')).toBe(base);
    // After "Taken", that day's follow-ups are gone from the plan.
    expect(today(at(2026, 11, 23, 9), marked)).toHaveLength(0);
    // After "Not yet", the 1 PM and 7 PM follow-ups stay.
    expect(today(at(2026, 11, 23, 9), applyReminderAction(base, '2026-11-23', 'later'))).toHaveLength(2);
  });

  test('both buttons are registered on the notification', async () => {
    await setupNotifications();
    const [, actions] = (Notifications.setNotificationCategoryAsync as jest.Mock).mock.calls[0];
    expect(actions.map((a: { identifier: string }) => a.identifier)).toEqual([ACTION_TAKEN, ACTION_LATER]);
  });
});

describe('syncing with the phone', () => {
  beforeEach(() => {
    N.__scheduled.length = 0;
    jest.useFakeTimers({ doNotFake: ['setTimeout'] }).setSystemTime(at(2026, 11, 23, 9));
  });
  afterEach(() => jest.useRealTimers());

  test('rebuilding (app open / phone restart) gives the same schedule, with no duplicates', async () => {
    await syncReminders(base);
    const first = N.__scheduled.map((n) => n.identifier).sort();
    await syncReminders(base);
    expect(N.__scheduled.map((n) => n.identifier).sort()).toEqual(first);
  });

  test('marking taken while an older sync is still running leaves no stale follow-up for today', async () => {
    const a = syncReminders({ ...base, taken: { '2026-11-23': { Creatine: true } } });
    const b = syncReminders({ ...base, taken: { '2026-11-23': { Creatine: true, Protein: true } } });
    await Promise.all([a, b]);
    expect(N.__scheduled.filter((n) => n.identifier.startsWith('supp-2026-11-23'))).toEqual([]);
    expect(N.__scheduled.some((n) => n.identifier.startsWith('supp-2026-11-24'))).toBe(true);
  });
});

describe('Android 13+ notification permission', () => {
  const realOS = Platform.OS;
  afterAll(() => Object.defineProperty(Platform, 'OS', { value: realOS }));

  test('the channel is created before asking, and permission is asked only when not yet granted', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const order: string[] = [];
    (Notifications.setNotificationChannelAsync as jest.Mock).mockImplementation(async () => order.push('channel'));
    (Notifications.requestPermissionsAsync as jest.Mock).mockImplementation(async () => (order.push('ask'), { granted: true }));
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    expect(await setupNotifications()).toBe(true);
    expect(order).toEqual(['channel', 'ask']);

    order.length = 0;
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true });
    expect(await setupNotifications()).toBe(true);
    expect(order).toEqual(['channel']);
  });

  test('a denied permission is reported, not thrown', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    expect(await setupNotifications()).toBe(false);
  });

  test('the app declares POST_NOTIFICATIONS (Android 13+) and boot-completed (reschedule after restart)', () => {
    const perms: string[] = require('../../app.json').expo.android.permissions;
    expect(perms).toEqual(expect.arrayContaining(['android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED']));
  });
});
