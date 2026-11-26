/**
 * Per-supplement reminders: each supplement's own morning reminder, follow-ups and last call, the
 * "Not yet" option, Taken stopping only that supplement, restarts, midnight, and the Android 13+
 * permission flow.
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

const R = { on: true, morning: '08:00', followUps: ['13:00'], lastCall: '19:00' };
const base: State = { ...DEFAULT_STATE, supplements: ['Creatine', 'Protein'], suppReminders: { Creatine: R, Protein: R }, taken: {} };
const at = (y: number, m: number, d: number, hh: number, mm = 0) => new Date(y, m - 1, d, hh, mm);
const ids = (now: Date, s = base) => planReminders(s, now).map((r) => r.id);
const today = (now: Date, s = base, supp?: string) => planReminders(s, now).filter((r) => r.date === '2026-11-23' && (!supp || r.supp === supp));

describe('schedule', () => {
  test('each supplement gets its own morning reminder, follow-up and last call', () => {
    const r = today(at(2026, 11, 23, 7), base, 'Creatine');
    expect(r.map((x) => [x.when.getHours(), x.title])).toEqual([
      [8, 'Time for your creatine'],
      [13, 'Still need your creatine?'],
      [19, 'Last call: creatine'],
    ]);
    expect(today(at(2026, 11, 23, 7), base, 'Protein').map((x) => x.title)[0]).toBe('Time for your protein');
  });

  test('each supplement keeps its own times', () => {
    const s = { ...base, suppReminders: { ...base.suppReminders, Protein: { on: true, morning: '07:15', followUps: ['10:00', '15:30'], lastCall: null } } };
    expect(today(at(2026, 11, 23, 6), s, 'Protein').map((x) => [x.when.getHours(), x.when.getMinutes()])).toEqual([
      [7, 15],
      [10, 0],
      [15, 30],
    ]);
    expect(today(at(2026, 11, 23, 6), s, 'Creatine').map((x) => x.when.getHours())).toEqual([8, 13, 19]);
  });

  test('after the morning reminder: only the follow-ups still to come', () => {
    expect(today(at(2026, 11, 23, 10), base, 'Creatine').map((x) => x.when.getHours())).toEqual([13, 19]);
    expect(today(at(2026, 11, 23, 15), base, 'Creatine').map((x) => x.when.getHours())).toEqual([19]);
    expect(today(at(2026, 11, 23, 19, 30))).toHaveLength(0);
  });

  test('marking one taken stops only its own reminders that day', () => {
    const s = { ...base, taken: { '2026-11-23': { Creatine: true } } };
    expect(today(at(2026, 11, 23, 9), s, 'Creatine')).toHaveLength(0);
    expect(today(at(2026, 11, 23, 9), s, 'Protein').map((x) => x.when.getHours())).toEqual([13, 19]);
    // ...and the next days are still scheduled.
    expect(planReminders(s, at(2026, 11, 23, 9)).some((r) => r.supp === 'Creatine' && r.date === '2026-11-24')).toBe(true);
  });

  test('a supplement with reminders off, or no supplements: nothing scheduled for it', () => {
    const off = { ...base, suppReminders: { ...base.suppReminders, Protein: { ...R, on: false } } };
    expect(planReminders(off, at(2026, 11, 23, 7)).every((r) => r.supp === 'Creatine')).toBe(true);
    expect(planReminders({ ...base, supplements: [] }, at(2026, 11, 23, 7))).toEqual([]);
  });

  test('a supplement added without saved reminders gets the default times', () => {
    const s = { ...base, supplements: ['Creatine', 'Protein', 'Fish oil'] };
    expect(today(at(2026, 11, 23, 7), s, 'Fish oil').map((x) => x.title)).toEqual(['Time for your fish oil', 'Still need your fish oil?', 'Last call: fish oil']);
  });

  test('across midnight: late evening schedules tomorrow from the morning; month and year boundaries too', () => {
    const late = planReminders(base, at(2026, 11, 23, 23, 59));
    expect(late[0]).toMatchObject({ date: '2026-11-24' });
    expect(late[0].when).toEqual(at(2026, 11, 24, 8));
    expect(planReminders(base, at(2026, 12, 31, 20))[0].date).toBe('2027-01-01');
  });

  test('10 days ahead, with stable unique ids, so rebuilding after a restart replaces rather than duplicates', () => {
    const now = at(2026, 11, 23, 7);
    const a = ids(now);
    expect(new Set(planReminders(base, now).map((x) => x.date)).size).toBe(10);
    expect(new Set(a).size).toBe(a.length);
    expect(ids(now)).toEqual(a);
  });
});

describe('limits and order', () => {
  test('many reminders a day: fewer days ahead, never more than 60 scheduled', () => {
    const big = { on: true, morning: '07:00', followUps: ['10:00', '12:00', '15:00'], lastCall: '21:00' };
    const s = { ...base, supplements: ['A', 'B', 'C', 'D'], suppReminders: { A: big, B: big, C: big, D: big } };
    const plan = planReminders(s, at(2026, 11, 23, 6));
    expect(plan.length).toBeLessThanOrEqual(60);
    expect(plan.length).toBeGreaterThan(20);
  });
  test('titles follow the time order, whatever order the times were set in', () => {
    const odd = { ...base, suppReminders: { ...base.suppReminders, Creatine: { on: true, morning: '08:00', followUps: ['21:00'], lastCall: '12:00' } } };
    expect(today(at(2026, 11, 23, 7), odd, 'Creatine').map((x) => [x.when.getHours(), x.title])).toEqual([
      [8, 'Time for your creatine'],
      [12, 'Still need your creatine?'],
      [21, 'Last call: creatine'],
    ]);
  });
});

describe('taking action on a reminder', () => {
  test('"Taken" on a reminder for a supplement renamed or removed since changes nothing', () => {
    expect(applyReminderAction(base, '2026-11-23', 'taken', 'Old name')).toBe(base);
  });

  test('"Taken" marks that supplement only; "Not yet" and a plain tap change nothing', () => {
    const marked = applyReminderAction(base, '2026-11-23', 'taken', 'Creatine');
    expect(marked.taken['2026-11-23']).toEqual({ Creatine: true });
    expect(applyReminderAction(base, '2026-11-23', 'later', 'Creatine')).toBe(base);
    expect(applyReminderAction(base, '2026-11-23', 'open', 'Creatine')).toBe(base);
    // After "Taken", creatine's follow-ups are gone; protein's stay.
    expect(today(at(2026, 11, 23, 9), marked, 'Creatine')).toHaveLength(0);
    expect(today(at(2026, 11, 23, 9), marked, 'Protein')).toHaveLength(2);
    // An older notification without a supplement still marks them all.
    expect(applyReminderAction(base, '2026-11-23', 'taken').taken['2026-11-23']).toEqual({ Creatine: true, Protein: true });
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
    expect(N.__scheduled.filter((n) => n.identifier.includes('-2026-11-23-'))).toEqual([]);
    expect(N.__scheduled.some((n) => n.identifier.includes('-2026-11-24-'))).toBe(true);
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
