import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Confetti } from '../components/celebrate';
import { Button } from '../components/ui';
import { EXERCISES } from '../data/exercises';
import { dayById } from '../data/program';
import { haptic } from '../feedback';
import { doneSets, num, prSetsOn, todayKey, trainingStreak, useStore } from '../store';
import { color, font, gradient, leading, radius, size, space, type } from '../theme';

export default function CompleteScreen() {
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam ?? todayKey();
  const { state } = useStore();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [burst] = useState(1);

  const stats = useMemo(() => {
    let sets = 0;
    let volume = 0;
    for (const [id, log] of Object.entries(state.logs[date] ?? {})) {
      const kind = EXERCISES[id]?.kind;
      if (!kind) continue;
      const d = doneSets(log, kind);
      sets += d.length;
      if (kind === 'weight_reps') volume += d.reduce((n, x) => n + num(x.weight)! * num(x.reps)!, 0);
    }
    const session = state.sessions[date];
    const mins =
      session?.startedAt && session.finishedAt ? Math.max(1, Math.round((session.finishedAt - session.startedAt) / 60000)) : null;
    return { sets, volume: Math.round(volume), mins, prs: prSetsOn(state.logs, date), dayId: session?.dayId };
  }, [state, date]);

  useEffect(() => {
    haptic.pr();
  }, []);

  const day = dayById(stats.dayId);
  const streak = trainingStreak(state, date);

  const tiles = [
    { icon: 'barbell', label: 'Volume', value: stats.volume.toLocaleString(), unit: state.unit },
    { icon: 'layers', label: 'Sets', value: String(stats.sets), unit: '' },
    { icon: 'trophy', label: 'PRs', value: String(stats.prs.length), unit: '' },
    { icon: 'time', label: 'Time', value: stats.mins ? String(stats.mins) : '—', unit: stats.mins ? 'min' : '' },
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.x4 }}>
        <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(12)}>
          <LinearGradient colors={gradient.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <Ionicons name="trophy" size={56} color={color.ink} />
            <Text style={s.title} accessibilityRole="header">
              Workout done!
            </Text>
            <Text style={s.sub}>{day ? day.name : 'Great session'}</Text>
            <View style={s.streak}>
              <Ionicons name="flame" size={22} color={color.orange} />
              <Text style={s.streakText}>{streak} day streak</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={s.grid}>
          {tiles.map((t, i) => (
            <Animated.View
              key={t.label}
              entering={reduce ? undefined : FadeInUp.delay(80 + i * 50).duration(240)}
              style={s.tile}
            >
              <Ionicons name={t.icon} size={20} color={t.label === 'PRs' ? color.gold : color.lime} />
              <Text style={[type.num, { fontSize: size.title }]} numberOfLines={1} adjustsFontSizeToFit>
                {t.value}
                {t.unit ? <Text style={s.unit}> {t.unit}</Text> : null}
              </Text>
              <Text style={type.label}>{t.label}</Text>
            </Animated.View>
          ))}
        </View>

        {stats.prs.length > 0 && (
          <View style={s.prs}>
            <Text style={[type.h2, { color: color.gold }]}>New records</Text>
            {stats.prs.map((p) => (
              <View key={p.exerciseId} style={s.prRow}>
                <Ionicons name="trophy" size={18} color={color.gold} />
                <Text style={[type.body, { flex: 1 }]}>{EXERCISES[p.exerciseId].name}</Text>
                <Text style={[type.num, { fontSize: size.h3, color: color.gold }]}>
                  {p.value}
                  {EXERCISES[p.exerciseId].kind === 'reps' ? ' reps' : ` ${state.unit}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[type.bodyMuted, { textAlign: 'center', marginVertical: space.xxl }]}>
          {stats.prs.length ? 'Stronger than last time. Eat, sleep, repeat.' : 'Every logged set counts. See you next session.'}
        </Text>
        <Button label="Back to Today" kind="lime" big icon="home" onPress={() => router.dismissTo('/')} />
      </ScrollView>
      <Confetti burst={burst} count={48} />
    </View>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xxl, alignItems: 'center', gap: space.sm },
  title: { fontFamily: font.display, fontSize: size.display, lineHeight: leading.display, color: color.ink, letterSpacing: -1 },
  sub: { fontFamily: font.bodyBold, fontSize: size.body, color: color.ink, opacity: 0.8 },
  streak: {
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  streakText: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.orange },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  tile: { flexBasis: '48%', flexGrow: 1, backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  unit: { fontFamily: font.bodySemi, fontSize: size.body, color: color.muted },
  prs: { marginTop: space.lg, backgroundColor: color.goldDim, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
