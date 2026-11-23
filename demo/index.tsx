import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Figtree_800ExtraBold } from '@expo-google-fonts/figtree/800ExtraBold';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../src/components/icons';
import ProgressScreen from '../src/app/(tabs)/progress';
import SettingsScreen from '../src/app/(tabs)/settings';
import SupplementsScreen from '../src/app/(tabs)/supplements';
import TodayScreen from '../src/app/(tabs)/index';
import CompleteScreen from '../src/app/complete';
import FocusScreen from '../src/app/focus';
import ExerciseScreen from '../src/app/exercise/[id]';
import BuilderScreen from '../src/app/builder';
import ProgramsScreen from '../src/app/programs';
import { Loading, Press } from '../src/components/ui';
import { STORAGE_KEY, StoreProvider, addDays, todayKey, useStore, type DayLog } from '../src/store';
import { color, font, size, space } from '../src/theme';
import { FocusContext, ParamsContext, setNav, type Route } from './router-shim';

const sets = (w: number, reps: number[]) => reps.map((r) => ({ weight: String(w), reps: String(r), done: true }));

// Example history (clearly marked in the demo) so charts, streaks and the heat map have something to show.
function seedExampleData() {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const today = todayKey();
    const logs: Record<string, DayLog> = {};
    const sessions: Record<string, { dayId: string; startedAt: number; finishedAt: number }> = {};
    const bump = (wk: number) => (3 - wk) * 5;
    for (let back = 1; back <= 28; back++) {
      const d = addDays(today, -back);
      const wd = new Date(d.replace(/-/g, '/')).getDay();
      const wk = Math.floor(back / 7);
      const dayId = [null, 'mon', 'tue', 'wed', 'thu', 'fri', null][wd];
      if (!dayId) continue;
      const b = bump(wk);
      const L: Record<string, DayLog> = {
        mon: {
          flat_bench: { sets: sets(165 + b, [10, 9, 8]) },
          incline_db_press: { sets: sets(55 + b / 5 * 2.5, [12, 11, 10]) },
          cable_fly: { sets: sets(30, [15, 14, 13]) },
          incline_db_curl: { sets: sets(25, [12, 11, 10]) },
          ez_curl: { sets: sets(60 + b / 5 * 2.5, [10, 9, 9]) },
          lateral_raise: { sets: sets(20, [18, 16, 15, 14]) },
        },
        tue: {
          lat_pulldown: { sets: sets(120 + b, wk === 0 ? [12, 12, 12] : [11, 10, 9]) },
          seated_cable_row: { sets: sets(120 + b, [10, 10, 9]) },
          single_arm_db_row: { sets: sets(60 + b / 5 * 5, [12, 11, 10]) },
          triceps_pushdown: { sets: sets(50 + b / 5 * 5, [14, 12, 11]) },
        },
        wed: {
          incline_bb_press: { sets: sets(135, [9, 8, 7]) },
          push_ups: { sets: [{ weight: '', reps: String(22 + 2 * (3 - wk)), done: true }, { weight: '', reps: '18', done: true }] },
          wrist_curl: { sets: sets(30, [15, 15, 15]) },
          farmers_walk: { sets: sets(60 + b / 5 * 5, [35, 32, 30]) },
        },
        thu: {
          db_shoulder_press: { sets: sets(45 + b / 5 * 5, [10, 9, 8]) },
          lateral_raise: { sets: sets(20, [18, 17, 15]) },
          close_grip_bench: { sets: sets(135 + b, [9, 8, 8]) },
          hammer_curl: { sets: sets(30 + b / 5 * 2.5, [12, 11, 10]) },
        },
        fri: {
          wide_pulldown: { sets: sets(125 + b, [10, 9, 9]) },
          bb_bent_row: { sets: sets(135 + b, [9, 8, 8]) },
          flat_db_press: { sets: sets(60 + b / 5 * 5, [12, 11, 10]) },
        },
      };
      logs[d] = L[dayId];
      const t0 = new Date(d.replace(/-/g, '/')).getTime() + 18 * 3600e3;
      sessions[d] = { dayId, startedAt: t0, finishedAt: t0 + 52 * 60e3 };
    }
    const taken: Record<string, Record<string, boolean>> = {};
    for (let i = 1; i <= 12; i++) if (i !== 9) taken[addDays(today, -i)] = { Creatine: true, Protein: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ logs, sessions, taken, example: true }));
  } catch {}
}
seedExampleData();

const TABS: { id: string; title: string; icon: IconName; C: () => React.ReactNode }[] = [
  { id: 'index', title: 'Today', icon: 'barbell', C: TodayScreen },
  { id: 'progress', title: 'Progress', icon: 'chart', C: ProgressScreen },
  { id: 'supplements', title: 'Supps', icon: 'flask', C: SupplementsScreen },
  { id: 'settings', title: 'Settings', icon: 'sliders', C: SettingsScreen },
];

function Demo() {
  const { ready } = useStore();
  const [fonts] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<string>('index');
  // Like the app's tab bar: report its measured height so screens pad above it.
  const [barH, setBarH] = useState<number | undefined>(undefined);
  const [stack, setStack] = useState<Route[]>([]);
  const [example] = useState(() => {
    try {
      return !!JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').example;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setNav({
      push: (r) => setStack((s) => [...s, r]),
      replace: (r) => setStack((s) => [...s.slice(0, -1), r]),
      back: () => setStack((s) => s.slice(0, -1)),
      tab: (t) => {
        setStack([]);
        setTab(t);
      },
    });
  }, []);

  if (!ready || !fonts) return <Loading />;
  const top = stack[stack.length - 1];

  const clearExample = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({}));
    } catch {}
    location.reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {example && !top && (
        <View style={s.banner}>
          <Text style={s.bannerText}>Demo with example workouts. Reminders and haptics only work in the Android app.</Text>
          <Press onPress={clearExample} style={s.bannerBtn} accessibilityRole="button">
            <Text style={s.bannerBtnText}>Clear</Text>
          </Press>
        </View>
      )}
      {top && top.name !== 'tabs' && (
        <ParamsContext.Provider value={top.params}>
          {top.name === 'exercise' ? (
            <ExerciseScreen key={JSON.stringify(top.params)} />
          ) : top.name === 'programs' ? (
            <ProgramsScreen />
          ) : top.name === 'builder' ? (
            <BuilderScreen key={JSON.stringify(top.params)} />
          ) : top.name === 'focus' ? (
            <FocusScreen key={JSON.stringify(top.params)} />
          ) : (
            <CompleteScreen />
          )}
        </ParamsContext.Provider>
      )}
      {/* Tabs stay mounted under pushed screens, like the real app's stack. */}
      <View style={{ flex: 1, display: top ? 'none' : 'flex' }}>
          <BottomTabBarHeightContext.Provider value={barH}>
          <View style={{ flex: 1 }}>
            {TABS.map((t) => (
              <View key={t.id} style={{ flex: 1, display: t.id === tab ? 'flex' : 'none' }}>
                <FocusContext.Provider value={t.id === tab && !top}>
                  <t.C />
                </FocusContext.Provider>
              </View>
            ))}
          </View>
          </BottomTabBarHeightContext.Provider>
          <View
            style={[s.barWrap, { paddingBottom: insets.bottom + space.sm }]}
            pointerEvents="box-none"
            onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
          >
            <View style={s.bar}>
              <View style={{ flexDirection: 'row' }} accessibilityRole="tablist">
                {TABS.map((t) => {
                  const on = t.id === tab;
                  return (
                    <Press key={t.id} onPress={() => setTab(t.id)} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.title}>
                      {on && <View style={s.tabLine} />}
                      <Icon name={t.icon} size={22} color={on ? color.accent : color.subtle} filled={on} />
                      <Text style={[s.tabText, { color: on ? color.text : color.subtle }]} numberOfLines={1}>
                        {t.title}
                      </Text>
                    </Press>
                  );
                })}
              </View>
            </View>
          </View>
      </View>
    </View>
  );
}

function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider style={{ backgroundColor: color.bg }}>
        <StoreProvider>
          <Demo />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.surface2, paddingHorizontal: space.lg, paddingVertical: space.sm },
  bannerText: { flex: 1, fontFamily: font.body, fontSize: size.label, lineHeight: 16, color: color.muted },
  bannerBtn: { borderWidth: 1, borderColor: color.line, borderRadius: 999, paddingHorizontal: space.lg, minHeight: 48, justifyContent: 'center' },
  bannerBtnText: { fontFamily: font.bodyBold, fontSize: size.label, color: color.text },
  barWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg },
  bar: { padding: space.xs, borderRadius: 30, backgroundColor: color.surface, borderWidth: 1, borderColor: color.glassBorder },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 60, borderRadius: 24 },
  tabLine: { position: 'absolute', top: 0, width: 28, height: 2, borderRadius: 1, backgroundColor: color.accent },
  tabText: { fontFamily: font.bodyBold, fontSize: size.tiny, letterSpacing: 0.3 },
});

registerRootComponent(Root);
