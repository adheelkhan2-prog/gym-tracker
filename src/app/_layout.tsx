import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onReminderResponse, setupNotifications, syncReminders } from '../reminders';
import { StoreProvider, useStore } from '../store';
import { C } from '../theme';

function ReminderBridge() {
  const { state, ready, update } = useStore();
  const setupDone = useRef(false);

  // Ask for permission + register the "Taken / Not yet" buttons once.
  useEffect(() => {
    if (!ready || setupDone.current) return;
    setupDone.current = true;
    setupNotifications().catch(() => {});
  }, [ready]);

  // "Taken" pressed on a notification -> tick every supplement for that day.
  useEffect(() => {
    if (!ready) return;
    return onReminderResponse((date, action) => {
      if (action !== 'taken') return;
      update((s) => ({
        ...s,
        taken: { ...s.taken, [date]: Object.fromEntries(s.supplements.map((x) => [x, true])) },
      }));
    });
  }, [ready, update]);

  // Rebuild the reminder schedule whenever anything it depends on changes.
  const deps = JSON.stringify([state.taken, state.reminderTimes, state.supplements, state.remindersOn]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => syncReminders(state).catch(() => {}), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, deps]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <ReminderBridge />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bg },
            animation: 'slide_from_right',
          }}
        />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
