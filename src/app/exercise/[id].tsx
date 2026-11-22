import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BodyModel, type PaintMap } from '../../components/body/BodyModel';
import { Confetti, PRBanner } from '../../components/celebrate';
import { RestBar } from '../../components/RestRing';
import { Button, Chip, IconButton, Press } from '../../components/ui';
import { EXERCISES, type ExerciseInfo } from '../../data/exercises';
import { MUSCLE_LABEL, type MuscleId } from '../../data/muscles';
import { dayById, pickOption, restFor, targetTop } from '../../data/program';
import { haptic } from '../../feedback';
import { bestBefore, num, previousSession, prMetric, todayKey, useStore, type SetEntry } from '../../store';
import { color, fmtClock, font, leading, motion, radius, restBarClearance, size, space, touch, type } from '../../theme';
import { restCarry } from '../../restCarry';
import { emptySets, hitTopOfRange } from '../../workout';

function SetCheck({ done, onPress, label }: { done: boolean; onPress: () => void; label: string }) {
  const reduce = useReducedMotion();
  const sc = useSharedValue(1);
  const prev = useRef(done);
  useEffect(() => {
    if (done && !prev.current && !reduce) sc.value = withSequence(withTiming(0.7, { duration: 70 }), withSpring(1, motion.pop));
    prev.current = done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Press
      onPress={onPress}
      style={[s.check, done && s.checkOn]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
      hitSlop={4}
    >
      <Animated.View style={st}>
        <Ionicons name="checkmark-sharp" size={30} color={done ? color.ink : color.subtle} />
      </Animated.View>
    </Press>
  );
}

export default function ExerciseScreen() {
  const params = useLocalSearchParams<{ id: string; day?: string; slot?: string }>();
  const insets = useSafeAreaInsets();
  const { state, update } = useStore();
  const date = todayKey();
  const day = dayById(params.day);
  const plan = day?.exercises.find((e) => e.slot === params.slot) ?? day?.exercises.find((e) => e.options.includes(params.id));
  const id = plan ? pickOption(plan, state.variants) : params.id;
  const ex: ExerciseInfo | undefined = EXERCISES[id];
  const targetSets = plan?.sets ?? 3;
  const unit = state.unit;
  const step = unit === 'kg' ? 2.5 : 5;

  const prev = previousSession(state.logs, id, date);
  const best = bestBefore(state.logs, id, date);
  const log = state.logs[date]?.[id];
  const sets: SetEntry[] = log?.sets?.length ? log.sets : emptySets(targetSets);
  const skipped = !!log?.skipped;

  // Pick up a rest that was still running on the previous exercise.
  const [restEnd, setRestEnd] = useState<number | null>(() =>
    restCarry.endsAt && restCarry.endsAt > Date.now() ? restCarry.endsAt : null,
  );
  const [restTotal, setRestTotal] = useState(restCarry.total);
  useEffect(() => {
    restCarry.endsAt = restEnd;
    restCarry.total = restTotal;
  }, [restEnd, restTotal]);
  const [confetti, setConfetti] = useState(0);
  const [prShow, setPrShow] = useState(0);
  const [prText, setPrText] = useState('');
  const [showSteps, setShowSteps] = useState(false);
  const [needWeight, setNeedWeight] = useState<number | null>(null);

  const paint: PaintMap = useMemo(() => {
    const p: PaintMap = {};
    if (!ex) return p;
    for (const m of ex.secondary) p[m] = { color: color.limeSoft, glow: 0.08 };
    for (const m of ex.primary) p[m] = { color: color.lime, glow: 0.45 };
    return p;
  }, [ex]);

  if (!ex || !plan || !day) {
    return (
      <View style={[s.missing, { paddingTop: insets.top + space.lg }]}>
        <Text style={type.h2}>That exercise isn’t in your program any more.</Text>
        <Button label="Back to Today" onPress={() => router.back()} />
      </View>
    );
  }

  const kind = ex.kind;
  const rest = restFor(id);
  const isPress = !!ex.press && !!day.pressNote;
  const top = targetTop(plan.target);
  const repsLabel = kind === 'weight_time' ? 'SEC' : 'REPS';
  const targetLabel = kind === 'weight_time' ? `${plan.target} s` : plan.target === 'max' ? 'max reps' : `${plan.target} reps`;
  const prevHitTop = !!prev && kind !== 'reps' && hitTopOfRange(prev.sets.map((x) => ({ ...x, done: true })), plan);
  const todayHitTop = kind !== 'reps' && hitTopOfRange(sets, plan);
  const prevTop = prev ? Math.max(...prev.sets.map((x) => num(x.weight) ?? 0)) : 0;
  const idx = day.exercises.indexOf(plan);
  const nextPlan = day.exercises[idx + 1];
  const allSetsDone = sets.filter((x) => x.done).length >= targetSets;
  const goNext = () =>
    nextPlan
      ? router.replace({ pathname: '/exercise/[id]', params: { id: pickOption(nextPlan, state.variants), day: day.id, slot: nextPlan.slot } })
      : router.back();

  const write = (next: { sets?: SetEntry[]; skipped?: boolean }) => {
    // eslint-disable-next-line react-hooks/purity -- runs in tap handlers, not during render
    const now = Date.now();
    update((st) => ({
      ...st,
      logs: { ...st.logs, [date]: { ...st.logs[date], [id]: { ...(st.logs[date]?.[id] ?? { sets }), ...next } } },
      sessions: st.sessions[date]?.startedAt
        ? st.sessions
        : { ...st.sessions, [date]: { ...st.sessions[date], dayId: st.sessions[date]?.dayId ?? day.id, startedAt: now } },
    }));
  };

  const edit = (i: number, patch: Partial<SetEntry>) => write({ sets: sets.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const complete = (i: number) => {
    const cur = sets[i];
    if (cur.done) return edit(i, { done: false });
    // Empty fields fall back to last session's numbers (shown as the grey placeholder).
    const ghost = prev?.sets[i] ?? prev?.sets[prev.sets.length - 1];
    const weight = kind === 'reps' ? '' : cur.weight || ghost?.weight || '';
    // Same rule as the grey hint in the box: last time's reps, else the top of the target range.
    const reps = cur.reps || ghost?.reps || (top ? String(top) : '');
    if (!reps || (kind !== 'reps' && !weight)) {
      haptic.tap();
      setNeedWeight(i);
      return;
    }
    setNeedWeight(null);
    const entry = { weight, reps, done: true };
    const value = prMetric(entry, kind);
    const bestToday = Math.max(0, ...sets.filter((x, j) => j !== i && x.done).map((x) => prMetric(x, kind) || 0));
    edit(i, entry);
    if (best > 0 && value > best && value > bestToday) {
      haptic.pr();
      setConfetti((c) => c + 1);
      setPrText(kind === 'reps' ? `${value} reps on ${ex.name}` : `${value} ${unit} on ${ex.name}`);
      setPrShow((c) => c + 1);
    } else haptic.setDone();
    setRestTotal(rest);
    // eslint-disable-next-line react-hooks/purity -- runs in the tap handler, not during render
    setRestEnd(Date.now() + rest * 1000);
  };

  const nudge = (i: number, field: 'weight' | 'reps', dir: 1 | -1) => {
    const ghost = prev?.sets[i]?.[field] ?? '';
    const base = num(sets[i][field]) ?? num(ghost) ?? 0;
    const by = field === 'weight' ? step : kind === 'weight_time' ? 5 : 1;
    haptic.tap();
    edit(i, { [field]: String(Math.max(0, Math.round((base + dir * by) * 10) / 10)), done: false });
  };

  const chooseVariant = (option: string) =>
    update((st) => ({ ...st, variants: { ...st.variants, [plan.slot]: option } }));

  const skip = () => {
    write({ skipped: !skipped });
    if (!skipped) {
      haptic.tap();
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: restBarClearance + insets.bottom }}>
        <View style={s.header}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
          <Text style={s.counter}>
            {idx + 1} of {day.exercises.length}
          </Text>
          <View style={{ width: touch.min }} />
        </View>

        <View style={s.pad}>
          <Text style={[type.display, { fontSize: size.hero, lineHeight: leading.hero }]} accessibilityRole="header">
            {ex.name}
          </Text>
          <View style={s.tags}>
            <Text style={[s.tag, s.tagLime]}>
              {plan.sets} × {targetLabel}
            </Text>
            <Text style={s.tag}>
              <Ionicons name="timer-outline" size={13} color={color.muted} /> rest {fmtClock(rest)}
            </Text>
            {best > 0 && (
              <Text style={[s.tag, s.tagGold]}>
                <Ionicons name="trophy" size={13} color={color.gold} /> best {best}
                {kind === 'reps' ? ' reps' : ` ${unit}`}
              </Text>
            )}
          </View>
        </View>

        <View style={[s.pad, { marginTop: space.lg }]}>
          <BodyModel
            paint={paint}
            height={300}
            describe={(m) => `${MUSCLE_LABEL[m]}${ex.primary.includes(m) ? ' · primary' : ex.secondary.includes(m) ? ' · secondary' : ''}`}
          />
          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: color.lime }]} />
              <Text style={s.legendText} numberOfLines={2}>
                {ex.primary.map((m: MuscleId) => MUSCLE_LABEL[m]).join(', ')}
              </Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: color.limeSoft }]} />
              <Text style={[s.legendText, { color: color.muted }]} numberOfLines={2}>
                {ex.secondary.map((m: MuscleId) => MUSCLE_LABEL[m]).join(', ')}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.pad}>
          {plan.options.length > 1 && (
            <View style={s.variants}>
              <Text style={[type.small, { color: color.text }]}>Pick your version (remembered):</Text>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                {plan.options.map((o) => (
                  <Chip key={o} label={EXERCISES[o].name} active={o === id} onPress={() => chooseVariant(o)} />
                ))}
              </View>
            </View>
          )}

          {isPress && (
            <View style={[s.callout, { backgroundColor: color.orangeDim }]}>
              <Ionicons name="alert-circle" size={20} color={color.orange} />
              <Text style={[s.calloutText, { color: color.orangeSoft }]}>{day.pressNote}</Text>
            </View>
          )}
          {plan.note && (
            <View style={s.callout}>
              <Ionicons name="information-circle" size={20} color={color.muted} />
              <Text style={s.calloutText}>{plan.note}</Text>
            </View>
          )}
          {(todayHitTop || prevHitTop) && (
            <View style={[s.callout, { backgroundColor: color.limeDim }]}>
              <Ionicons name="trending-up" size={22} color={color.lime} />
              <Text style={[s.calloutText, { color: color.limeSoft }]}>
                {todayHitTop
                  ? `Top of the range on every set. Add weight next time (+${step} ${unit}).`
                  : `You hit ${top} on every set last time. Add weight: try ${prevTop + step} ${unit}.`}
              </Text>
            </View>
          )}

          {skipped ? (
            <View style={s.skipped}>
              <Ionicons name="bandage" size={26} color={color.muted} />
              <Text style={[type.body, { flex: 1 }]}>Skipped today for joint pain. Your streak is safe.</Text>
              <Button label="Undo" kind="ghost" onPress={skip} />
            </View>
          ) : (
            <>
              <View style={s.tableHead}>
                <Text style={[s.th, { width: 64 }]} numberOfLines={1}>
                  SET
                </Text>
                {kind !== 'reps' && <Text style={[s.th, { flex: 1.4, textAlign: 'center' }]}>{unit.toUpperCase()}</Text>}
                <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>{repsLabel}</Text>
                <View style={{ width: 56 }} />
              </View>

              {sets.map((set, i) => {
                const ghost = prev?.sets[i];
                const isPR = set.done && best > 0 && prMetric(set, kind) > best;
                const lastText = ghost ? (kind === 'reps' ? `${ghost.reps}` : `${ghost.weight}×${ghost.reps}`) : '—';
                return (
                  <View key={i} style={[s.setRow, set.done && s.setRowDone, isPR && s.setRowPR]}>
                    <View style={s.setCol}>
                      <Text style={[s.setNo, set.done && { color: color.lime }]}>{i + 1}</Text>
                      <Text style={s.last} numberOfLines={1} accessibilityLabel={ghost ? `Last time ${lastText}` : 'No previous set'}>
                        {lastText}
                      </Text>
                    </View>
                    {kind !== 'reps' && (
                      <View style={[s.field, { flex: 1.4 }]}>
                        <Press onPress={() => nudge(i, 'weight', -1)} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`Set ${i + 1} weight minus ${step}`}>
                          <Ionicons name="remove" size={18} color={color.muted} />
                        </Press>
                        <TextInput
                          value={set.weight}
                          onChangeText={(t) => edit(i, { weight: t.replace(/[^0-9.,]/g, ''), done: false })}
                          placeholder={ghost?.weight ?? '0'}
                          placeholderTextColor={color.subtle}
                          keyboardType="decimal-pad"
                          style={s.input}
                          accessibilityLabel={`Set ${i + 1} weight in ${unit}`}
                          selectTextOnFocus
                        />
                        <Press onPress={() => nudge(i, 'weight', 1)} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`Set ${i + 1} weight plus ${step}`}>
                          <Ionicons name="add" size={18} color={color.muted} />
                        </Press>
                      </View>
                    )}
                    <View style={[s.field, { flex: 1 }]}>
                      <TextInput
                        value={set.reps}
                        onChangeText={(t) => edit(i, { reps: t.replace(/[^0-9]/g, ''), done: false })}
                        placeholder={ghost?.reps ?? (top ? String(top) : '0')}
                        placeholderTextColor={color.subtle}
                        keyboardType="number-pad"
                        style={s.input}
                        accessibilityLabel={`Set ${i + 1} ${kind === 'weight_time' ? 'seconds' : 'reps'}`}
                        selectTextOnFocus
                      />
                    </View>
                    <SetCheck done={set.done} onPress={() => complete(i)} label={`Complete set ${i + 1}`} />
                    {needWeight === i && (kind === 'reps' ? !set.reps : !set.weight) && (
                      <Text style={s.needWeight} accessibilityLiveRegion="polite">
                        {kind === 'reps' ? 'Enter your reps first' : 'Enter a weight first'}
                      </Text>
                    )}
                    {isPR && (
                      <View style={s.prBadge} pointerEvents="none">
                        <Ionicons name="trophy" size={10} color={color.ink} />
                        <Text style={s.prText}>PR</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              <View style={s.setBtns}>
                <Press
                  onPress={() => {
                    const lastSet = sets[sets.length - 1];
                    write({ sets: [...sets, { weight: lastSet?.weight ?? '', reps: lastSet?.reps ?? '', done: false }] });
                  }}
                  style={s.smallBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="add" size={18} color={color.text} />
                  <Text style={s.smallBtnText}>Add set</Text>
                </Press>
                {sets.length > 1 && (
                  <Press onPress={() => write({ sets: sets.slice(0, -1) })} style={s.smallBtn} accessibilityRole="button">
                    <Ionicons name="remove" size={18} color={color.text} />
                    <Text style={s.smallBtnText}>Remove set</Text>
                  </Press>
                )}
              </View>
            </>
          )}

          {nextPlan ? (
            <View style={{ marginTop: space.xxl }}>
              <Button
                label={`Next: ${EXERCISES[pickOption(nextPlan, state.variants)].name}`}
                kind={allSetsDone ? 'lime' : 'ghost'}
                icon="arrow-forward"
                onPress={goNext}
              />
            </View>
          ) : (
            <View style={{ marginTop: space.xxl }}>
              <Button label="Back to finish the workout" kind="energy" icon="flag" onPress={() => router.back()} />
            </View>
          )}

          {!skipped && (
            <Press onPress={skip} style={s.skipBtn} accessibilityRole="button">
              <Ionicons name="bandage-outline" size={18} color={color.muted} />
              <Text style={s.skipText}>Joint pain? Skip this exercise</Text>
            </Press>
          )}

          <Press onPress={() => setShowSteps((v) => !v)} style={s.howTo} accessibilityRole="button" accessibilityState={{ expanded: showSteps }}>
            <Text style={type.h2}>How to do it</Text>
            <Ionicons name={showSteps ? 'chevron-up' : 'chevron-down'} size={22} color={color.muted} />
          </Press>
          {showSteps &&
            ex.steps.map((t, i) => (
              <View key={i} style={s.step}>
                <Text style={s.stepNo}>{i + 1}</Text>
                <Text style={[type.body, { flex: 1, color: color.muted }]}>{t}</Text>
              </View>
            ))}
        </View>
      </ScrollView>

      {restEnd && (
        <View style={[s.restWrap, { bottom: insets.bottom + space.md }]}>
          <RestBar
            endsAt={restEnd}
            total={restTotal}
            onAdd={() => {
              setRestTotal((t) => t + 15);
              setRestEnd((e) => (e ?? Date.now()) + 15000);
            }}
            skipLabel={allSetsDone ? (nextPlan ? 'Next' : 'Done') : 'Skip'}
            onSkip={() => (allSetsDone ? goNext() : setRestEnd(null))}
            onDone={() => setRestEnd(null)}
          />
        </View>
      )}
      <Confetti burst={confetti} />
      <PRBanner show={prShow} text={prText} />
    </View>
  );
}

const s = StyleSheet.create({
  missing: { flex: 1, backgroundColor: color.bg, padding: space.lg, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  counter: { fontFamily: font.bodyBold, fontSize: size.small, color: color.muted },
  pad: { paddingHorizontal: space.lg },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  tag: {
    fontFamily: font.bodyBold,
    fontSize: size.small,
    color: color.muted,
    backgroundColor: color.surface2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  tagLime: { color: color.ink, backgroundColor: color.lime },
  tagGold: { color: color.gold, backgroundColor: color.goldDim },
  legend: { marginTop: space.md, gap: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 14, height: 14, borderRadius: radius.pill },
  legendText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.small, color: color.text },
  variants: { marginTop: space.lg, gap: space.sm },
  callout: {
    marginTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  calloutText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.small, lineHeight: leading.small, color: color.muted },
  skipped: {
    marginTop: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xxl, marginBottom: space.sm, paddingHorizontal: space.md },
  th: { fontFamily: font.bodyBlack, fontSize: size.tiny, letterSpacing: 1, color: color.subtle },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.sm,
    paddingLeft: space.md,
    marginBottom: space.sm,
    minHeight: 72,
    borderWidth: 2,
    borderColor: color.surface,
  },
  setRowDone: { backgroundColor: color.limeDim, borderColor: color.limeDim },
  setRowPR: { borderColor: color.gold },
  setCol: { width: 64, alignItems: 'flex-start', gap: space.xxs },
  setNo: { fontFamily: font.display, fontSize: size.h2, lineHeight: leading.h2, color: color.muted },
  last: { fontFamily: font.bodySemi, fontSize: size.label, color: color.subtle, fontVariant: ['tabular-nums'] },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.surface2, borderRadius: radius.md, minHeight: 56 },
  stepBtn: { width: 30, height: 56, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    padding: 0,
    textAlign: 'center',
    fontFamily: font.display,
    fontSize: size.h2,
    color: color.text,
    fontVariant: ['tabular-nums'],
  },
  check: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: color.lime },
  prBadge: {
    position: 'absolute',
    top: -8,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    backgroundColor: color.gold,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
  },
  needWeight: {
    position: 'absolute',
    bottom: -2,
    left: 64 + space.md + space.sm,
    fontFamily: font.bodyBold,
    fontSize: size.tiny,
    color: color.orange,
  },
  prText: { fontFamily: font.bodyBlack, fontSize: size.tiny, color: color.ink },
  setBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: touch.min,
  },
  smallBtnText: { fontFamily: font.bodyBold, fontSize: size.small, color: color.text },
  skipBtn: { marginTop: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: touch.min },
  skipText: { fontFamily: font.bodySemi, fontSize: size.small, color: color.muted },
  howTo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, minHeight: touch.min },
  step: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  stepNo: { fontFamily: font.display, fontSize: size.h3, color: color.lime, width: 20 },
  restWrap: { position: 'absolute', left: space.lg, right: space.lg },
});
