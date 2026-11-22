import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EXERCISES } from '../../data/exercises';
import { dayById } from '../../data/program';
import { bestWeight, num, previousSession, todayKey, useStore, type SetEntry } from '../../store';
import { C, R, fmtRest, font } from '../../theme';

const buzz = (kind: 'light' | 'success') => {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export default function ExerciseScreen() {
  const { id, day: dayId } = useLocalSearchParams<{ id: string; day?: string }>();
  const insets = useSafeAreaInsets();
  const { state, update } = useStore();
  const ex = EXERCISES[id];
  const plan = dayById(dayId ?? '')?.exercises.find((e) => e.exerciseId === id);
  const targetSets = plan?.sets ?? 3;
  const date = todayKey();
  const unit = state.unit;
  const step = unit === 'kg' ? 2.5 : 5;

  const prev = useMemo(() => previousSession(state.logs, id, date), [state.logs, id, date]);
  const pr = useMemo(() => bestWeight(state.logs, id, date), [state.logs, id, date]);
  const logged = state.logs[date]?.[id];
  const sets: SetEntry[] = logged ?? Array.from({ length: targetSets }, () => ({ weight: '', reps: '', done: false }));

  // Progressive overload hint: every set last time hit the top of the rep range -> add weight.
  const topReps = plan ? Math.max(...(plan.reps.match(/\d+/g) ?? ['0']).map(Number)) : 0;
  const readyToProgress =
    !!prev && topReps > 0 && prev.sets.length >= targetSets && prev.sets.every((x) => num(x.reps)! >= topReps);
  const prevTop = prev ? Math.max(...prev.sets.map((x) => num(x.weight)!)) : 0;

  const [frame, setFrame] = useState(0);
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    if (!animate) return;
    const t = setInterval(() => setFrame((f) => 1 - f), 1100);
    return () => clearInterval(t);
  }, [animate]);

  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!restEnd) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= restEnd) {
        setRestEnd(null);
        buzz('success');
      }
    }, 250);
    return () => clearInterval(t);
  }, [restEnd]);
  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0;

  const [showSteps, setShowSteps] = useState(false);

  if (!ex) return null;

  const write = (next: SetEntry[]) =>
    update((s) => ({ ...s, logs: { ...s.logs, [date]: { ...s.logs[date], [id]: next } } }));

  const edit = (i: number, patch: Partial<SetEntry>) => write(sets.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const toggleDone = (i: number) => {
    const cur = sets[i];
    if (cur.done) return edit(i, { done: false });
    // Empty fields fall back to what you did last time (shown as the grey placeholder).
    const ghost = prev?.sets[i] ?? prev?.sets[prev.sets.length - 1];
    const weight = cur.weight || ghost?.weight || '';
    const reps = cur.reps || ghost?.reps || '';
    if (!weight || !reps) return; // nothing to log yet
    edit(i, { weight, reps, done: true });
    buzz('light');
    if (plan) {
      setRestEnd(Date.now() + plan.rest * 1000);
      setNow(Date.now());
    }
  };

  const addSet = () => {
    const last = sets[sets.length - 1];
    write([...sets, { weight: last?.weight ?? '', reps: last?.reps ?? '', done: false }]);
  };
  const removeSet = () => sets.length > 1 && write(sets.slice(0, -1));

  const nudgeWeight = (i: number, dir: 1 | -1) => {
    const base = num(sets[i].weight) ?? num(prev?.sets[i]?.weight ?? '') ?? 0;
    edit(i, { weight: String(Math.max(0, base + dir * step)) });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 140 }}>
        <Pressable onPress={() => setAnimate((a) => !a)} accessibilityLabel="Exercise demonstration. Tap to pause.">
          <Image source={ex.images[frame]} style={s.hero} resizeMode="cover" />
          <View style={s.heroTag}>
            <Text style={s.heroTagText}>{frame === 0 ? 'START' : 'FINISH'}</Text>
            <Ionicons name={animate ? 'pause' : 'play'} size={12} color={C.text} />
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          style={[s.back, { top: insets.top + 8 }]}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>

        <View style={{ paddingHorizontal: 16 }}>
          <Text style={[font.display, { fontSize: 28, marginTop: 18 }]}>{ex.name}</Text>
          <View style={s.tags}>
            {plan && (
              <Text style={[s.tag, s.tagAccent]}>
                {plan.sets} × {plan.reps}
              </Text>
            )}
            {plan && <Text style={s.tag}>rest {fmtRest(plan.rest)}</Text>}
            {ex.primary.map((m) => (
              <Text key={m} style={s.tag}>
                {m}
              </Text>
            ))}
          </View>

          {(pr > 0 || readyToProgress) && (
            <View style={s.stats}>
              {pr > 0 && (
                <View style={s.stat}>
                  <Text style={font.label}>Best</Text>
                  <Text style={[s.statNum, font.num]}>
                    {pr} <Text style={s.statUnit}>{unit}</Text>
                  </Text>
                </View>
              )}
              {readyToProgress && (
                <View style={[s.stat, { flex: 2 }]}>
                  <Text style={[font.label, { color: C.accent }]}>Go heavier</Text>
                  <Text style={s.hint}>
                    You hit {topReps} reps on every set last time. Try {prevTop + step} {unit}.
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={s.tableHead}>
            <Text style={[s.th, { width: 34 }]}>SET</Text>
            <Text style={[s.th, { flex: 1.3 }]}>LAST TIME</Text>
            <Text style={[s.th, { flex: 1.6, textAlign: 'center' }]}>{unit.toUpperCase()}</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>REPS</Text>
            <View style={{ width: 44 }} />
          </View>

          {sets.map((set, i) => {
            const ghost = prev?.sets[i];
            const isPR = set.done && pr > 0 && (num(set.weight) ?? 0) > pr;
            return (
              <View key={i} style={[s.setRow, set.done && s.setRowDone]}>
                <Text style={[s.setNo, font.num]}>{i + 1}</Text>
                <Text style={[s.prev, font.num]} numberOfLines={1}>
                  {ghost ? `${ghost.weight} × ${ghost.reps}` : '—'}
                </Text>
                <View style={[s.weightBox, { flex: 1.6 }]}>
                  <Pressable onPress={() => nudgeWeight(i, -1)} hitSlop={6} style={s.nudge} accessibilityLabel={`Minus ${step}`}>
                    <Ionicons name="remove" size={16} color={C.muted} />
                  </Pressable>
                  <TextInput
                    value={set.weight}
                    onChangeText={(t) => edit(i, { weight: t.replace(/[^0-9.,]/g, ''), done: false })}
                    placeholder={ghost?.weight ?? '0'}
                    placeholderTextColor={C.faint}
                    keyboardType="decimal-pad"
                    style={[s.input, font.num, { flex: 1 }]}
                    accessibilityLabel={`Set ${i + 1} weight in ${unit}`}
                    selectTextOnFocus
                  />
                  <Pressable onPress={() => nudgeWeight(i, 1)} hitSlop={6} style={s.nudge} accessibilityLabel={`Plus ${step}`}>
                    <Ionicons name="add" size={16} color={C.muted} />
                  </Pressable>
                </View>
                <TextInput
                  value={set.reps}
                  onChangeText={(t) => edit(i, { reps: t.replace(/[^0-9]/g, ''), done: false })}
                  placeholder={ghost?.reps ?? '0'}
                  placeholderTextColor={C.faint}
                  keyboardType="number-pad"
                  style={[s.input, s.repsInput, font.num, { flex: 1 }]}
                  accessibilityLabel={`Set ${i + 1} reps`}
                  selectTextOnFocus
                />
                <Pressable
                  onPress={() => toggleDone(i)}
                  style={[s.check, set.done && s.checkOn]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: set.done }}
                  accessibilityLabel={`Complete set ${i + 1}`}
                >
                  <Ionicons name="checkmark" size={20} color={set.done ? C.accentInk : C.faint} />
                </Pressable>
                {isPR && (
                  <View style={s.prBadge}>
                    <Text style={s.prText}>PR</Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={s.setBtns}>
            <Pressable onPress={addSet} style={s.smallBtn} accessibilityRole="button">
              <Ionicons name="add" size={18} color={C.text} />
              <Text style={s.smallBtnText}>Add set</Text>
            </Pressable>
            {sets.length > 1 && (
              <Pressable onPress={removeSet} style={s.smallBtn} accessibilityRole="button">
                <Ionicons name="remove" size={18} color={C.text} />
                <Text style={s.smallBtnText}>Remove</Text>
              </Pressable>
            )}
          </View>

          <Pressable onPress={() => setShowSteps((v) => !v)} style={s.howTo} accessibilityRole="button">
            <Text style={font.h2}>How to do it</Text>
            <Ionicons name={showSteps ? 'chevron-up' : 'chevron-down'} size={20} color={C.muted} />
          </Pressable>
          {showSteps &&
            ex.steps.map((t, i) => (
              <View key={i} style={s.step}>
                <Text style={[s.stepNo, font.num]}>{i + 1}</Text>
                <Text style={s.stepText}>{t}</Text>
              </View>
            ))}
        </View>
      </ScrollView>

      {restEnd && (
        <View style={[s.rest, { bottom: insets.bottom + 16 }]}>
          <Ionicons name="timer-outline" size={22} color={C.accentInk} />
          <View style={{ flex: 1 }}>
            <Text style={s.restLabel}>Rest</Text>
            <Text style={[s.restTime, font.num]}>{fmtRest(restLeft)}</Text>
          </View>
          <Pressable onPress={() => setRestEnd((e) => (e ?? Date.now()) + 15000)} style={s.restBtn} accessibilityRole="button">
            <Text style={s.restBtnText}>+15s</Text>
          </Pressable>
          <Pressable onPress={() => setRestEnd(null)} style={s.restBtn} accessibilityRole="button">
            <Text style={s.restBtnText}>Skip</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { width: '100%', aspectRatio: 1.5, backgroundColor: '#fff' },
  heroTag: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,14,16,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroTagText: { color: C.text, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  back: {
    position: 'absolute',
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(13,14,16,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    color: C.muted,
    backgroundColor: C.surface2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
    overflow: 'hidden',
  },
  tagAccent: { color: C.accentInk, backgroundColor: C.accent },
  stats: { flexDirection: 'row', gap: 10, marginTop: 18 },
  stat: { flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: 14, gap: 4 },
  statNum: { color: C.text, fontSize: 24, fontWeight: '800' },
  statUnit: { color: C.muted, fontSize: 14, fontWeight: '600' },
  hint: { color: C.text, fontSize: 14, lineHeight: 20 },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 6, paddingHorizontal: 8 },
  th: { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: R.md,
    padding: 8,
    marginBottom: 6,
  },
  setRowDone: { backgroundColor: '#1E2611' },
  setNo: { width: 26, color: C.muted, fontWeight: '800', fontSize: 16, textAlign: 'center' },
  prev: { flex: 1.3, color: C.faint, fontSize: 13 },
  weightBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface2, borderRadius: R.sm },
  nudge: { width: 26, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 44,
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    padding: 0,
    minWidth: 0,
  },
  repsInput: { backgroundColor: C.surface2, borderRadius: R.sm },
  check: {
    width: 44,
    height: 44,
    borderRadius: R.sm,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: C.accent },
  prBadge: {
    position: 'absolute',
    top: -6,
    right: 50,
    backgroundColor: C.pr,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  prText: { color: C.accentInk, fontSize: 10, fontWeight: '900' },
  setBtns: { flexDirection: 'row', gap: 8, marginTop: 6 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface2,
    borderRadius: R.sm,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  smallBtnText: { color: C.text, fontWeight: '600' },
  howTo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, minHeight: 44 },
  step: { flexDirection: 'row', gap: 12, marginTop: 12 },
  stepNo: { color: C.accent, fontWeight: '800', width: 18 },
  stepText: { flex: 1, color: C.muted, fontSize: 15, lineHeight: 22 },
  rest: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.accent,
    borderRadius: R.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  restLabel: { color: C.accentInk, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  restTime: { color: C.accentInk, fontSize: 26, fontWeight: '900' },
  restBtn: { backgroundColor: 'rgba(13,14,16,0.12)', borderRadius: R.sm, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  restBtnText: { color: C.accentInk, fontWeight: '800' },
});
