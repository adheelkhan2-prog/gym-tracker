import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Figtree_800ExtraBold } from '@expo-google-fonts/figtree/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '../components/ui';
import { onReminderResponse, setupNotifications, syncReminders } from '../reminders';
import { StoreProvider, useStore } from '../store';
import { color } from '../theme';

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

function Gate() {
  const { ready } = useStore();
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  if (!ready || (!fontsLoaded && !fontError)) return <Loading />;
  return (
    <>
      <ReminderBridge />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
          animation: 'slide_from_right',
          animationDuration: 220,
        }}
      >
        <Stack.Screen name="complete" options={{ animation: 'fade_from_bottom', gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: color.bg }}>
      <StoreProvider>
        <StatusBar style="light" />
        <Gate />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
