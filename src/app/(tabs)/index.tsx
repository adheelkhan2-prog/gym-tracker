import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip, SectionLabel, Screen, SupplementNudge } from '../../components/ui';
import { EXERCISES } from '../../data/exercises';
import { DAYS, dayById, WEEKDAY_SHORT } from '../../data/program';
import { num, previousSession, todayKey, useStore } from '../../store';
import { C, R, font } from '../../theme';

export default function TrainScreen() {
  const { state } = useStore();
  const now = new Date();
  const date = todayKey(now);
  const scheduled = state.week[now.getDay()];
  const [picked, setPicked] = useState<string | null>(null);
  const dayId = picked ?? scheduled;
  const day = dayId ? dayById(dayId) : undefined;
  const log = state.logs[date] ?? {};

  const totalSets = day?.exercises.reduce((n, e) => n + e.sets, 0) ?? 0;
  const doneSets = day?.exercises.reduce((n, e) => n + (log[e.exerciseId]?.filter((x) => x.done).length ?? 0), 0) ?? 0;

  return (
    <Screen>
      <Text style={s.date}>
        {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>
      <Text style={font.display}>{day ? `${day.name} day` : 'Rest day'}</Text>
      <Text style={s.focus}>{day ? day.focus : 'Recover, eat well, and still take your supplements.'}</Text>

      <SupplementNudge />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 20 }} contentContainerStyle={{ gap: 8 }}>
        {DAYS.map((d) => (
          <Chip
            key={d.id}
            label={d.id === scheduled ? `${d.name} · today` : d.name}
            active={d.id === dayId}
            onPress={() => setPicked(d.id)}
          />
        ))}
      </ScrollView>

      {day ? (
        <>
          <View style={s.progressWrap}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }]} />
            </View>
            <Text style={[s.progressText, font.num]}>
              {doneSets}/{totalSets} sets
            </Text>
          </View>

          <SectionLabel>{`${day.exercises.length} exercises`}</SectionLabel>
          <View style={{ gap: 10 }}>
            {day.exercises.map((p, i) => {
              const ex = EXERCISES[p.exerciseId];
              const sets = log[p.exerciseId] ?? [];
              const done = sets.filter((x) => x.done).length;
              const complete = done >= p.sets;
              const prev = previousSession(state.logs, p.exerciseId, date);
              const top = prev?.sets.reduce((a, b) => (num(b.weight)! > num(a.weight)! ? b : a));
              return (
                <Pressable
                  key={p.exerciseId}
                  onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: p.exerciseId, day: day.id } })}
                  style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${ex.name}, ${p.sets} sets of ${p.reps}`}
                >
                  <Image source={ex.images[0]} style={s.thumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.order}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={s.name} numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text style={[s.meta, font.num]}>
                      {p.sets} × {p.reps}
                      {top ? `  ·  last ${top.weight} ${state.unit} × ${top.reps}` : ''}
                    </Text>
                  </View>
                  {complete ? (
                    <Ionicons name="checkmark-circle" size={28} color={C.accent} />
                  ) : done > 0 ? (
                    <Text style={[s.partial, font.num]}>
                      {done}/{p.sets}
                    </Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={22} color={C.faint} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <View style={s.rest}>
          <Ionicons name="bed-outline" size={34} color={C.muted} />
          <Text style={s.restText}>
            Nothing scheduled for {WEEKDAY_SHORT[now.getDay()]}. Pick a day above if you want to train anyway.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  date: { color: C.accent, fontWeight: '700', marginBottom: 4 },
  focus: { color: C.muted, fontSize: 16, marginTop: 4 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  progressTrack: { flex: 1, height: 8, backgroundColor: C.surface2, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.accent, borderRadius: 999 },
  progressText: { color: C.muted, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: R.md,
    padding: 10,
    paddingRight: 14,
  },
  thumb: { width: 64, height: 64, borderRadius: R.sm, backgroundColor: '#fff' },
  order: { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  name: { color: C.text, fontSize: 16, fontWeight: '700', marginTop: 1 },
  meta: { color: C.muted, fontSize: 13, marginTop: 3 },
  partial: { color: C.accent, fontWeight: '800' },
  rest: { alignItems: 'center', gap: 12, paddingVertical: 48, paddingHorizontal: 24 },
  restText: { color: C.muted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
});
