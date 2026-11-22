import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Chip, SectionLabel, Screen } from '../../components/ui';
import { DAYS, WEEKDAY_SHORT } from '../../data/program';
import { useStore } from '../../store';
import { C, font } from '../../theme';

// Monday-first ordering for display.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const CYCLE: (string | null)[] = [...DAYS.map((d) => d.id), null];

export default function SettingsScreen() {
  const { state, update } = useStore();

  const cycleDay = (weekday: number) =>
    update((s) => {
      const cur = s.week[weekday];
      const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      const week = [...s.week];
      week[weekday] = next;
      return { ...s, week };
    });

  const resetLogs = () => {
    const doIt = () => update((s) => ({ ...s, logs: {} }));
    if (Platform.OS === 'web') return doIt();
    Alert.alert('Delete all workout history?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doIt },
    ]);
  };

  return (
    <Screen>
      <Text style={font.display}>Settings</Text>

      <SectionLabel>Weight unit</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Pounds (lb)" active={state.unit === 'lb'} onPress={() => update((s) => ({ ...s, unit: 'lb' }))} />
        <Chip label="Kilograms (kg)" active={state.unit === 'kg'} onPress={() => update((s) => ({ ...s, unit: 'kg' }))} />
      </View>

      <SectionLabel>Weekly schedule</SectionLabel>
      <Text style={s.help}>Tap a day to change which workout it gets.</Text>
      <Card style={{ padding: 0 }}>
        {ORDER.map((wd, i) => {
          const id = state.week[wd];
          const day = DAYS.find((d) => d.id === id);
          return (
            <Pressable
              key={wd}
              onPress={() => cycleDay(wd)}
              style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAY_SHORT[wd]}: ${day?.name ?? 'Rest'}. Tap to change.`}
            >
              <Text style={s.wd}>{WEEKDAY_SHORT[wd]}</Text>
              <Text style={[s.dayName, !day && { color: C.faint }]}>{day?.name ?? 'Rest'}</Text>
              <Text style={s.focus} numberOfLines={1}>
                {day?.focus ?? ''}
              </Text>
            </Pressable>
          );
        })}
      </Card>

      <SectionLabel>Data</SectionLabel>
      <Text style={s.help}>Everything is stored on this phone only.</Text>
      <Pressable onPress={resetLogs} style={s.danger} accessibilityRole="button">
        <Text style={{ color: C.danger, fontWeight: '700' }}>Delete workout history</Text>
      </Pressable>

      <Text style={s.credit}>
        Exercise photos and instructions: free-exercise-db (public domain).
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  help: { color: C.muted, marginBottom: 10, marginTop: -4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 56 },
  wd: { color: C.muted, width: 36, fontWeight: '700' },
  dayName: { color: C.text, fontWeight: '700', fontSize: 16, width: 64 },
  focus: { color: C.faint, flex: 1, fontSize: 13 },
  danger: { backgroundColor: C.surface, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  credit: { color: C.faint, fontSize: 12, marginTop: 32, textAlign: 'center' },
});
