import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Button, Chip, Flame, Press, Screen, SectionTitle } from '../../components/ui';
import { EXERCISES } from '../../data/exercises';
import { DAYS, dayById, WEEKDAY_LONG, WEEKDAY_SHORT } from '../../data/program';
import { haptic } from '../../feedback';
import { allTaken, num, previousSession, supplementStreak, todayKey, trainingStreak, useStore } from '../../store';
import { color, font, gradient, leading, radius, size, space, touch, type } from '../../theme';
import { WARMUP, dayProgress } from '../../workout';

export default function TodayScreen() {
  const { state, update } = useStore();
  const reduce = useReducedMotion();
  const now = new Date();
  const date = todayKey(now);
  const scheduled = state.week[now.getDay()];
  const [picked, setPicked] = useState<string | null>(null);
  // Picked day, else the workout already started today, else the scheduled one.
  const day = dayById(picked ?? state.sessions[date]?.dayId ?? scheduled);
  const progress = day ? dayProgress(state, day, date) : null;
  const started = !!progress && progress.done > 0;
  const finished = !!state.sessions[date]?.finishedAt;
  const nextTraining = (() => {
    for (let i = 1; i <= 7; i++) {
      const id = state.week[(now.getDay() + i) % 7];
      if (id) return { when: i === 1 ? 'Tomorrow' : WEEKDAY_LONG[(now.getDay() + i) % 7], day: dayById(id)! };
    }
    return null;
  })();

  const open = (exerciseId: string, slot: string) =>
    router.push({ pathname: '/exercise/[id]', params: { id: exerciseId, day: day!.id, slot } });

  const finish = () => {
    // eslint-disable-next-line react-hooks/purity -- runs in the tap handler, not during render
    const at = Date.now();
    update((s) => ({
      ...s,
      sessions: { ...s.sessions, [date]: { ...s.sessions[date], dayId: s.sessions[date]?.dayId ?? day!.id, finishedAt: at } },
    }));
    router.push({ pathname: '/complete', params: { date } });
  };

  const warmDone = !!state.warmups[date];
  const suppsDone = allTaken(state, date);

  return (
    <Screen>
      <View style={s.top}>
        <Text style={s.date}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Flame count={trainingStreak(state)} label="training" />
          <Flame count={supplementStreak(state)} label="supplement" tint={color.lime} />
        </View>
      </View>

      {day && progress ? (
        <Animated.View entering={reduce ? undefined : FadeInDown.duration(260)}>
          <LinearGradient colors={gradient.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <Text style={s.heroTitle}>{day.name}</Text>
            <Text style={s.heroFocus}>{day.focus}</Text>
            <View style={s.heroBarTrack}>
              <View style={[s.heroBarFill, { width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }]} />
            </View>
            <View style={s.heroRow}>
              <Text style={s.heroCount}>
                {progress.done}
                <Text style={s.heroCountOf}> / {progress.total} sets</Text>
              </Text>
              <Text style={s.heroMeta}>{day.exercises.length} exercises</Text>
            </View>
            {!finished && (
              <Press
                onPress={() => {
                  haptic.tap();
                  if (progress.next) open(progress.next.exerciseId, progress.next.plan.slot);
                  else finish();
                }}
                style={s.heroBtn}
                accessibilityRole="button"
              >
                <Text style={s.heroBtnText}>
                  {progress.allDone ? 'Finish workout' : started ? `Continue: ${EXERCISES[progress.next!.exerciseId].name}` : 'Start workout'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={color.lime} />
              </Press>
            )}
            {finished && (
              <View style={s.heroDone}>
                <Ionicons name="checkmark-circle" size={22} color={color.ink} />
                <Text style={s.heroDoneText}>Workout complete. Nice work.</Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      ) : (
        <View style={s.restCard}>
          <Ionicons name="bed" size={34} color={color.orange} />
          <Text style={type.title}>Rest day</Text>
          <Text style={type.bodyMuted}>
            Muscles grow while you recover. Take your supplements
            {nextTraining ? `, and get ready for ${nextTraining.day.name} ${nextTraining.when.toLowerCase() === 'tomorrow' ? 'tomorrow' : `on ${nextTraining.when}`}.` : '.'}
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.days} contentContainerStyle={{ gap: space.sm }}>
        {DAYS.map((d) => {
          const wd = state.week.indexOf(d.id);
          return (
            <Chip
              key={d.id}
              label={wd >= 0 ? WEEKDAY_SHORT[wd] : d.name.split(' ')[0]}
              icon={d.id === scheduled ? 'today' : undefined}
              active={d.id === day?.id}
              onPress={() => setPicked(d.id)}
            />
          );
        })}
      </ScrollView>

      {!suppsDone && (
        <Press onPress={() => router.navigate('/supplements')} style={s.nudge} accessibilityRole="button">
          <Ionicons name="flask" size={20} color={color.orange} />
          <Text style={s.nudgeText}>
            {state.supplements.filter((x) => !state.taken[date]?.[x]).join(' + ')} not taken yet
          </Text>
          <Press
            onPress={() => {
              haptic.setDone();
              update((st) => ({ ...st, taken: { ...st.taken, [date]: Object.fromEntries(st.supplements.map((x) => [x, true])) } }));
            }}
            style={s.nudgeBtn}
            accessibilityRole="button"
            accessibilityLabel="Mark supplements taken"
          >
            <Text style={s.nudgeBtnText}>Taken</Text>
          </Press>
        </Press>
      )}

      {day && progress && (
        <>
          <View style={[s.warm, warmDone && { backgroundColor: color.limeDim }]}>
            <View style={s.warmHead}>
              <Ionicons name={warmDone ? 'checkmark-circle' : 'flame-outline'} size={24} color={warmDone ? color.lime : color.orange} />
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>5-minute warm-up</Text>
                <Text style={type.small}>{warmDone ? 'Done. Joints are ready.' : 'Shoulders, elbows and wrists first.'}</Text>
              </View>
              <Press
                onPress={() => {
                  haptic.tap();
                  update((st) => ({ ...st, warmups: { ...st.warmups, [date]: !warmDone } }));
                }}
                style={[s.warmBtn, warmDone && { backgroundColor: color.surface3 }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: warmDone }}
                accessibilityLabel="Warm-up done"
              >
                <Text style={[s.warmBtnText, warmDone && { color: color.text }]}>{warmDone ? 'Undo' : 'Done'}</Text>
              </Press>
            </View>
            {!warmDone &&
              WARMUP.map((w) => (
                <View key={w.text} style={s.warmRow}>
                  <Ionicons name={w.icon} size={16} color={color.muted} />
                  <Text style={[type.small, { flex: 1, color: color.text }]}>{w.text}</Text>
                </View>
              ))}
          </View>

          {day.pressNote && (
            <View style={s.note}>
              <Ionicons name="alert-circle" size={20} color={color.orange} />
              <Text style={[type.small, { flex: 1, color: color.orangeSoft }]}>{day.pressNote}</Text>
            </View>
          )}

          <SectionTitle>The plan</SectionTitle>
          <View style={{ gap: space.sm }}>
            {progress.statuses.map((st, i) => {
              const ex = EXERCISES[st.exerciseId];
              const prev = previousSession(state.logs, st.exerciseId, date);
              const top = prev?.sets.reduce((a, b) => {
                const dw = (num(b.weight) ?? 0) - (num(a.weight) ?? 0);
                return dw > 0 || (dw === 0 && (num(b.reps) ?? 0) > (num(a.reps) ?? 0)) ? b : a;
              });
              const alt = st.plan.options.length > 1 ? st.plan.options.find((o) => o !== st.exerciseId) : null;
              const unitLabel = ex.kind === 'weight_time' ? 's' : ex.kind === 'reps' ? ' reps' : '';
              const last = top
                ? ex.kind === 'reps'
                  ? `last ${top.reps} reps`
                  : `last ${top.weight} ${state.unit} × ${top.reps}${ex.kind === 'weight_time' ? 's' : ''}`
                : 'first time';
              return (
                <Press
                  key={st.plan.slot}
                  onPress={() => open(st.exerciseId, st.plan.slot)}
                  style={[s.row, st.complete && !st.skipped && s.rowDone]}
                  accessibilityRole="button"
                  accessibilityLabel={`${ex.name}, ${st.plan.sets} sets of ${st.plan.target}${unitLabel}${st.complete ? ', done' : ''}`}
                >
                  <View style={[s.idx, st.complete && !st.skipped && { backgroundColor: color.lime }]}>
                    {st.complete && !st.skipped ? (
                      <Ionicons name="checkmark" size={20} color={color.ink} />
                    ) : st.skipped ? (
                      <Ionicons name="bandage" size={18} color={color.muted} />
                    ) : (
                      <Text style={s.idxText}>{i + 1}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.name, st.skipped && { color: color.muted, textDecorationLine: 'line-through' }]} numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text style={s.meta} numberOfLines={1}>
                      <Text style={s.metaStrong}>
                        {st.plan.sets} × {st.plan.target}
                        {unitLabel}
                      </Text>
                      {'  ·  '}
                      {st.skipped ? 'skipped (joint pain)' : last}
                    </Text>
                    {alt && <Text style={s.alt}>or {EXERCISES[alt].name}</Text>}
                  </View>
                  {!st.complete && st.done > 0 ? (
                    <Text style={s.partial}>
                      {st.done}/{st.plan.sets}
                    </Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={22} color={color.subtle} />
                  )}
                </Press>
              );
            })}
          </View>

          {started && !finished && (
            <View style={{ marginTop: space.xxl }}>
              <Button label={progress.allDone ? 'Finish workout' : 'Finish early'} kind={progress.allDone ? 'energy' : 'ghost'} icon="flag" big onPress={finish} />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg, gap: space.sm },
  date: { fontFamily: font.bodyBold, fontSize: size.small, color: color.muted, flexShrink: 1 },
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.sm },
  heroTitle: { fontFamily: font.display, fontSize: size.hero, lineHeight: leading.hero, letterSpacing: -1, color: color.ink },
  heroFocus: { fontFamily: font.bodySemi, fontSize: size.body, color: color.ink, opacity: 0.8 },
  heroBarTrack: { height: 10, borderRadius: radius.pill, backgroundColor: color.inkTrack, marginTop: space.md, overflow: 'hidden' },
  heroBarFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.ink },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  heroCount: { fontFamily: font.display, fontSize: size.title, color: color.ink, fontVariant: ['tabular-nums'] },
  heroCountOf: { fontFamily: font.bodyBold, fontSize: size.body, color: color.ink },
  heroMeta: { fontFamily: font.bodyBold, fontSize: size.small, color: color.ink, opacity: 0.8 },
  heroBtn: {
    marginTop: space.sm,
    minHeight: touch.primary,
    borderRadius: radius.pill,
    backgroundColor: color.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  heroBtnText: { fontFamily: font.bodyBlack, fontSize: size.body, color: color.lime, flexShrink: 1 },
  heroDone: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  heroDoneText: { fontFamily: font.bodyBlack, fontSize: size.body, color: color.ink },
  restCard: { backgroundColor: color.surface, borderRadius: radius.xl, padding: space.xl, gap: space.sm },
  days: { marginTop: space.lg, flexGrow: 0 },
  nudge: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.orangeDim,
    borderRadius: radius.lg,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    minHeight: 64,
  },
  nudgeText: { flex: 1, fontFamily: font.bodyBold, fontSize: size.small, color: color.orangeSoft },
  nudgeBtn: { backgroundColor: color.orange, borderRadius: radius.pill, paddingHorizontal: space.xl, minHeight: touch.min, justifyContent: 'center' },
  nudgeBtnText: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.ink },
  warm: { marginTop: space.lg, backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  warmHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  warmBtn: { backgroundColor: color.lime, borderRadius: radius.pill, minHeight: touch.min, paddingHorizontal: space.xl, justifyContent: 'center' },
  warmBtnText: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.ink },
  warmRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.xs, minHeight: 28 },
  note: {
    marginTop: space.md,
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    backgroundColor: color.orangeDim,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 76,
  },
  rowDone: { backgroundColor: color.limeDim },
  idx: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  idxText: { fontFamily: font.display, fontSize: size.h3, color: color.text },
  name: { fontFamily: font.display, fontSize: size.h3, color: color.text },
  meta: { fontFamily: font.body, fontSize: size.small, color: color.muted, marginTop: space.xxs },
  metaStrong: { fontFamily: font.bodyBold, color: color.text },
  alt: { fontFamily: font.bodySemi, fontSize: size.label, color: color.subtle, marginTop: space.xxs },
  partial: { fontFamily: font.display, fontSize: size.h3, color: color.lime, fontVariant: ['tabular-nums'] },
});
