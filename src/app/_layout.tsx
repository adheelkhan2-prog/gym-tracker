// First: make Node-only APIs that npm packages may touch at load time harmless (see polyfills.ts).
import '../polyfills';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Figtree_800ExtraBold } from '@expo-google-fonts/figtree/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Loading } from '../components/ui';
import { crumb, installCrashReporting, setForeground } from '../crash';
import { shareCrashLog } from '../crashShare';
import { applyReminderAction, onReminderResponse, setupNotifications, syncReminders } from '../reminders';
import { StoreProvider, useStore } from '../store';
import { color } from '../theme';

// Before anything renders: log an unexpected close from last time, catch fatal JS errors.
installCrashReporting();

/** Breadcrumbs for the crash log: every screen opened, and the app going to/from the background. */
function CrashTrail() {
  const path = usePathname();
  useEffect(() => crumb(`screen ${path}`), [path]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setForeground(st === 'active'));
    return () => sub.remove();
  }, []);
  return null;
}

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
      if (action === 'taken') update((s) => applyReminderAction(s, date, action));
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
      <CrashTrail />
      <ReminderBridge />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
          animation: 'fade',
          animationDuration: 200,
        }}
      >
        <Stack.Screen name="complete" options={{ animation: 'fade_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="focus" options={{ animation: 'fade_from_bottom', animationDuration: 220, gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider style={{ backgroundColor: color.bg }}>
        <StoreProvider>
          <StatusBar style="light" />
          <ErrorBoundary onShareLog={() => void shareCrashLog().catch(() => {})}>
            <Gate />
          </ErrorBoundary>
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// One bad screen shows a recovery panel for that screen only; it never takes the app down.
export { RouteError as ErrorBoundary } from '../components/RouteError';
