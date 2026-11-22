import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { todayKey, useStore } from '../store';
import { C, R, font } from '../theme';

export function Screen({ children, padBottom = 32 }: { children: React.ReactNode; padBottom?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: padBottom }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <Text style={font.label}>{children}</Text>
      {right}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [s.chip, active && s.chipActive, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.chipText, active && { color: C.accentInk }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, primary ? s.btnPrimary : s.btnGhost, pressed && { opacity: 0.75 }]}
    >
      {icon && <Ionicons name={icon} size={18} color={primary ? C.accentInk : C.text} />}
      <Text style={[s.btnText, { color: primary ? C.accentInk : C.text }]}>{label}</Text>
    </Pressable>
  );
}

/** Shown on the Train tab until today's supplements are ticked off. */
export function SupplementNudge() {
  const { state, update } = useStore();
  const key = todayKey();
  const taken = state.taken[key] ?? {};
  const missing = state.supplements.filter((x) => !taken[x]);
  if (!missing.length) return null;
  const markAll = () =>
    update((st) => ({
      ...st,
      taken: { ...st.taken, [key]: Object.fromEntries(st.supplements.map((x) => [x, true])) },
    }));
  return (
    <Pressable onPress={() => router.navigate('/supplements')} style={s.nudge}>
      <Ionicons name="flask" size={18} color={C.warn} />
      <Text style={s.nudgeText} numberOfLines={1}>
        {missing.join(' + ')} not taken yet
      </Text>
      <Pressable onPress={markAll} hitSlop={10} style={s.nudgeBtn} accessibilityRole="button">
        <Text style={s.nudgeBtnText}>Taken</Text>
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: R.md, padding: 16 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 10 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: C.surface2,
  },
  chipActive: { backgroundColor: C.accent },
  chipText: { color: C.text, fontWeight: '600', fontSize: 14 },
  btn: {
    minHeight: 50,
    borderRadius: R.md,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimary: { backgroundColor: C.accent },
  btnGhost: { backgroundColor: C.surface2 },
  btnText: { fontSize: 16, fontWeight: '700' },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2A2110',
    borderRadius: R.md,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 16,
  },
  nudgeText: { flex: 1, color: C.warn, fontWeight: '600' },
  nudgeBtn: { backgroundColor: C.warn, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 9 },
  nudgeBtnText: { color: C.accentInk, fontWeight: '800' },
});
