import { Ionicons } from '@expo/vector-icons';
import { registerRootComponent } from 'expo';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ExerciseScreen from '../src/app/exercise/[id]';
import ProgressScreen from '../src/app/(tabs)/progress';
import SettingsScreen from '../src/app/(tabs)/settings';
import SupplementsScreen from '../src/app/(tabs)/supplements';
import TrainScreen from '../src/app/(tabs)/index';
import { StoreProvider } from '../src/store';
import { C } from '../src/theme';
import { ParamsContext, setNav } from './router-shim';

const KEY = 'gym-tracker/state/v1';
const ago = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const sets = (w: number, reps: number[]) => reps.map((r) => ({ weight: String(w), reps: String(r), done: true }));

// Example history so the charts have something to show on first open.
function seedExampleData() {
  try {
    if (localStorage.getItem(KEY)) return;
    const logs: Record<string, Record<string, unknown>> = {};
    const weeks = [4, 3, 2, 1];
    weeks.forEach((wk, i) => {
      logs[ago((wk - 1) * 7 + 2)] = {
        'Wide-Grip_Lat_Pulldown': sets(105 + i * 5, i === 3 ? [10, 10, 10, 10] : [10, 9, 8, 8]),
        Bent_Over_Barbell_Row: sets(115 + i * 10, [8, 7, 7]),
        Barbell_Curl: sets(50 + i * 5, [10, 9, 8]),
      };
      logs[ago((wk - 1) * 7 + 3)] = {
        'Barbell_Bench_Press_-_Medium_Grip': sets(155 + i * 5, [8, 7, 6, 6]),
        Incline_Dumbbell_Press: sets(50 + i * 5, [10, 9, 8]),
      };
      logs[ago((wk - 1) * 7 + 1)] = { Barbell_Squat: sets(185 + i * 10, [8, 7, 6, 6]), Leg_Press: sets(270 + i * 20, [12, 11, 10]) };
    });
    const taken: Record<string, Record<string, boolean>> = {};
    for (let d = 1; d <= 9; d++) if (d !== 5) taken[ago(d)] = { Creatine: true, Protein: true };
    localStorage.setItem(KEY, JSON.stringify({ logs, taken, example: true }));
  } catch {}
}
seedExampleData();

const TABS = [
  { id: 'index', title: 'Train', icon: 'barbell', C: TrainScreen },
  { id: 'progress', title: 'Progress', icon: 'trending-up', C: ProgressScreen },
  { id: 'supplements', title: 'Supps', icon: 'flask', C: SupplementsScreen },
  { id: 'settings', title: 'Settings', icon: 'options', C: SettingsScreen },
] as const;

function Demo() {
  const [tab, setTab] = useState<string>('index');
  const [stack, setStack] = useState<Record<string, string>[]>([]);
  useEffect(() => {
    setNav({
      push: (r) => r.name === 'exercise' && setStack((s) => [...s, r.params]),
      back: () => setStack((s) => s.slice(0, -1)),
      tab: (t) => {
        setStack([]);
        setTab(t);
      },
    });
  }, []);
  const [example, setExample] = useState(() => {
    try {
      return !!JSON.parse(localStorage.getItem(KEY) ?? '{}').example;
    } catch {
      return false;
    }
  });
  const clearExample = () => {
    try {
      localStorage.removeItem(KEY);
      localStorage.setItem(KEY, '{}');
    } catch {}
    location.reload();
  };
  const top = stack[stack.length - 1];
  const Active = TABS.find((t) => t.id === tab)!.C;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {top ? (
        <ParamsContext.Provider value={top}>
          <ExerciseScreen key={JSON.stringify(top)} />
        </ParamsContext.Provider>
      ) : (
        <>
          {example && (
            <View style={s.banner}>
              <Text style={s.bannerText}>Demo with example workouts. Reminders only work in the Android app.</Text>
              <Pressable onPress={clearExample} style={s.bannerBtn} accessibilityRole="button">
                <Text style={s.bannerBtnText}>Clear</Text>
              </Pressable>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Active />
          </View>
          <View style={s.bar} accessibilityRole="tablist">
            {TABS.map((t) => {
              const on = t.id === tab;
              return (
                <Pressable key={t.id} onPress={() => setTab(t.id)} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                  <Ionicons name={t.icon} size={22} color={on ? C.accent : C.faint} />
                  <Text style={[s.tabText, { color: on ? C.accent : C.faint }]}>{t.title}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function Root() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Demo />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, paddingHorizontal: 16, paddingVertical: 8 },
  bannerText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 16 },
  bannerBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, minHeight: 32, justifyContent: 'center' },
  bannerBtnText: { color: C.text, fontWeight: '700', fontSize: 12 },
  bar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2, minHeight: 56 },
  tabText: { fontSize: 11, fontWeight: '600' },
});

registerRootComponent(Root);
