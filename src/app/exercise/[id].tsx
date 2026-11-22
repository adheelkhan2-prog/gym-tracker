import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  SlideInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BodyModel, type PaintMap } from '../../components/body/BodyModel';
import { Backdrop, Glass } from '../../components/glass';
import { Icon } from '../../components/icons';
import { Burst, Flash } from '../../components/motion';
import { RestTimer } from '../../components/RestRing';
import { Badge, Button, Chip, IconButton, Press } from '../../components/ui';
import { EXERCISES, type ExerciseInfo } from '../../data/exercises';
import { MUSCLE_LABEL } from '../../data/muscles';
import { dayById, pickOption, restFor, targetTop } from '../../data/program';
import { haptic } from '../../feedback';
import { restCarry } from '../../restCarry';
import { bestBefore, num, previousSession, prMetric, todayKey, useStore, type SetEntry } from '../../store';
import { color, dayTitle, fmtClock, font, leading, motion, radius, restBarClearance, size, space, touch, type } from '../../theme';
import { emptySets, hitTopOfRange } from '../../workout';

type Rect = { x: number; y: number };

function SetCheck({ done, onPress, label, checkRef }: { done: boolean; onPress: () => void; label: string; checkRef: (v: React.ComponentRef<typeof View> | null) => void }) {
  const reduce = useReducedMotion();
  const sc = useSharedValue(1);
  const prev = useRef(done);
  useEffect(() => {
    if (done && !prev.current && !reduce) sc.set(withSequence(withTiming(0.6, { duration: 60 }), withSpring(1, motion.pop)));
    prev.current = done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <View ref={checkRef} collapsable={false}>
      <Press
        onPress={onPress}
        style={[s.check, done && s.checkOn]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={label}
        hitSlop={4}
        tick={false}
      >
        <Animated.View style={st}>
          <Icon name="check" size={28} color={done ? color.ink : color.subtle} />
        </Animated.View>
      </Press>
    </View>
  );
}

export default function ExerciseScreen() {
  const params = useLocalSearchParams<{ id: string; day?: string; slot?: string }>();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
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
  // A rest carried over from the previous exercise arrives as the slim bar, not full screen.
  const [carriedEnd] = useState(restEnd);
  // Each finished set starts a fresh rest (full screen); +15s keeps the current one.
  const [restId, setRestId] = useState(0);
  useEffect(() => {
    restCarry.endsAt = restEnd;
    restCarry.total = restTotal;
  }, [restEnd, restTotal]);

  const [showSteps, setShowSteps] = useState(false);
  const [needInput, setNeedInput] = useState<number | null>(null);
  // PR moment
  const [burst, setBurst] = useState(0);
  const [burstAt, setBurstAt] = useState<Rect>({ x: 0, y: 0 });
  const [flash, setFlash] = useState(0);
  const [pr, setPr] = useState<{ value: string; delta: string } | null>(null);
  const checkRefs = useRef<(React.ComponentRef<typeof View> | null)[]>([]);
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);

  useEffect(() => {
    if (!pr) return;
    const t = setTimeout(() => setPr(null), 2600);
    return () => clearTimeout(t);
  }, [pr]);

  const paint: PaintMap = useMemo(() => {
    const p: PaintMap = {};
    if (!ex) return p;
    for (const m of ex.secondary) p[m] = { color: color.muscleSecondary };
    for (const m of ex.primary) p[m] = { color: color.musclePrimary, glow: 0.18 };
    return p;
  }, [ex]);

  if (!ex || !plan || !day) {
    return (
      <Backdrop>
        <View style={[s.missing, { paddingTop: insets.top + space.lg }]}>
          <Text style={type.h2}>That exercise isn’t in your program any more.</Text>
          <Button label="Back to Today" onPress={() => router.back()} />
        </View>
      </Backdrop>
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
  const doneCount = sets.filter((x) => x.done).length;
  const allSetsDone = doneCount >= targetSets;
  const nextSetIdx = sets.findIndex((x) => !x.done);
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

  const celebrate = (i: number, value: number) => {
    haptic.thump();
    setTimeout(() => haptic.pr(), 120);
    const delta = value - best;
    setPr({
      value: kind === 'reps' ? `${value} reps` : `${value} ${unit}`,
      delta: kind === 'reps' ? `+${delta} reps vs your best` : `+${Math.round(delta * 10) / 10} ${unit} vs your best`,
    });
    setFlash((f) => f + 1);
    const node = checkRefs.current[i];
    const root = rootRef.current;
    if (node && root) {
      root.measureInWindow((rx: number, ry: number) => {
        node.measureInWindow((x: number, y: number, w: number, h: number) => {
          setBurstAt({ x: x - rx + w / 2, y: y - ry + h / 2 });
          setBurst((b) => b + 1);
        });
      });
    }
  };

  const complete = (i: number) => {
    const cur = sets[i];
    if (cur.done) return edit(i, { done: false });
    // Empty fields fall back to the grey hint: last session's numbers, else the top of the range.
    const ghost = prev?.sets[i] ?? prev?.sets[prev.sets.length - 1];
    const weight = kind === 'reps' ? '' : cur.weight || ghost?.weight || '';
    const reps = cur.reps || ghost?.reps || (top ? String(top) : '');
    if (!reps || (kind !== 'reps' && !weight)) {
      haptic.tap();
      setNeedInput(i);
      return;
    }
    setNeedInput(null);
    const entry = { weight, reps, done: true };
    const value = prMetric(entry, kind);
    const bestToday = Math.max(0, ...sets.filter((x, j) => j !== i && x.done).map((x) => prMetric(x, kind) || 0));
    edit(i, entry);
    if (best > 0 && value > best && value > bestToday) celebrate(i, value);
    else haptic.setDone();
    setRestTotal(rest);
    setRestId((n) => n + 1);
    // eslint-disable-next-line react-hooks/purity -- runs in the tap handler, not during render
    setRestEnd(Date.now() + rest * 1000);
  };

  const nudge = (i: number, dir: 1 | -1) => {
    const base = num(sets[i].weight) ?? num(prev?.sets[i]?.weight ?? '') ?? 0;
    edit(i, { weight: String(Math.max(0, Math.round((base + dir * step) * 10) / 10)), done: false });
  };

  const skip = () => {
    write({ skipped: !skipped });
    if (!skipped) router.back();
  };

  const nextSet = nextSetIdx >= 0 ? sets[nextSetIdx] : null;
  const nextGhost = nextSetIdx >= 0 ? prev?.sets[nextSetIdx] : undefined;
  const nextLabel = allSetsDone
    ? nextPlan
      ? `Next up: ${EXERCISES[pickOption(nextPlan, state.variants)].name}`
      : 'Last exercise done'
    : `Set ${nextSetIdx + 1}${
        kind === 'reps'
          ? ` · ${nextSet?.reps || nextGhost?.reps || 'max'} reps`
          : ` · ${nextSet?.weight || nextGhost?.weight || '?'} ${unit} × ${nextSet?.reps || nextGhost?.reps || top || '?'}`
      }`;

  return (
    <Backdrop>
      <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: restBarClearance + insets.bottom }}>
          <View style={s.header}>
            <IconButton icon="back" label="Back" onPress={() => router.back()} />
            <Badge label={`${dayTitle[day.id]} · ${idx + 1}/${day.exercises.length}`} variant="secondary" />
            <View style={{ width: touch.min }} />
          </View>

          <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(16)} style={s.pad}>
            <Text style={s.title} accessibilityRole="header">
              {ex.name}
            </Text>
            <View style={s.tags}>
              <Badge label={`${plan.sets} × ${targetLabel}`} />
              <Badge label={`Rest ${fmtClock(rest)}`} variant="secondary" icon="timer" />
              {best > 0 && <Badge label={`Best ${best}${kind === 'reps' ? ' reps' : ` ${unit}`}`} variant="outline" icon="trophy" />}
            </View>
          </Animated.View>

          <Animated.View entering={reduce ? undefined : FadeInDown.delay(motion.stagger).springify().damping(16)} style={[s.pad, { marginTop: space.lg }]}>
            <Glass strong r={radius.xxl} style={{ overflow: 'hidden' }}>
              <BodyModel
                paint={paint}
                height={320}
                tint={color.lime}
                describe={(m) => `${MUSCLE_LABEL[m]}${ex.primary.includes(m) ? ' · primary' : ex.secondary.includes(m) ? ' · secondary' : ''}`}
              />
            </Glass>
            <View style={s.legend}>
              <View style={s.legendItem}>
                <View style={[s.swatch, { backgroundColor: color.musclePrimary }]} />
                <Text style={s.legendText} numberOfLines={2}>
                  {ex.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}
                </Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.swatch, { backgroundColor: color.muscleSecondary }]} />
                <Text style={[s.legendText, { color: color.muted }]} numberOfLines={2}>
                  {ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}
                </Text>
              </View>
            </View>
          </Animated.View>

          <View style={s.pad}>
            {plan.options.length > 1 && (
              <View style={s.variants}>
                <Text style={[type.small, { color: color.text }]}>Pick your version (remembered)</Text>
                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  {plan.options.map((o) => (
                    <Chip key={o} label={EXERCISES[o].name} active={o === id} onPress={() => update((st) => ({ ...st, variants: { ...st.variants, [plan.slot]: o } }))} />
                  ))}
                </View>
              </View>
            )}

            {isPress && (
              <Glass r={radius.lg} style={s.callout}>
                <Icon name="alert" size={22} color={color.pink} />
                <Text style={s.calloutText}>{day.pressNote}</Text>
              </Glass>
            )}
            {plan.note && (
              <Glass r={radius.lg} style={s.callout}>
                <Icon name="info" size={22} color={color.muted} />
                <Text style={s.calloutText}>{plan.note}</Text>
              </Glass>
            )}
            {(todayHitTop || prevHitTop) && (
              <Glass r={radius.lg} style={[s.callout, { borderColor: color.lime }]}>
                <Icon name="arrowUp" size={22} color={color.lime} />
                <Text style={[s.calloutText, { color: color.limeSoft }]}>
                  {todayHitTop
                    ? `Top of the range on every set. Add weight next time (+${step} ${unit}).`
                    : `You hit ${top} on every set last time. Add weight: try ${prevTop + step} ${unit}.`}
                </Text>
              </Glass>
            )}

            {skipped ? (
              <Glass r={radius.lg} style={[s.callout, { marginTop: space.xl }]}>
                <Icon name="bandage" size={26} color={color.muted} />
                <Text style={[type.body, { flex: 1 }]}>Skipped today for joint pain. Your streak is safe.</Text>
                <Button size="sm" variant="secondary" label="Undo" onPress={skip} />
              </Glass>
            ) : (
              <>
                <View style={s.tableHead}>
                  <Text style={[s.th, { width: 64 }]}>SET</Text>
                  {kind !== 'reps' && <Text style={[s.th, { flex: 1.4, textAlign: 'center' }]}>{unit.toUpperCase()}</Text>}
                  <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>{repsLabel}</Text>
                  <View style={{ width: 56 }} />
                </View>

                {sets.map((set, i) => {
                  const ghost = prev?.sets[i];
                  const isPR = set.done && best > 0 && prMetric(set, kind) > best;
                  const lastText = ghost ? (kind === 'reps' ? `${ghost.reps}` : `${ghost.weight}×${ghost.reps}`) : '—';
                  return (
                    <Animated.View key={i} entering={reduce ? undefined : FadeInDown.delay(motion.stagger * (i + 2)).springify().damping(16)}>
                      <View style={[s.setRow, set.done && s.setRowDone, isPR && s.setRowPR]}>
                        <View style={s.setCol}>
                          <Text style={[s.setNo, set.done && { color: color.lime }]}>{i + 1}</Text>
                          <Text style={s.last} numberOfLines={1} accessibilityLabel={ghost ? `Last time ${lastText}` : 'No previous set'}>
                            {lastText}
                          </Text>
                        </View>
                        {kind !== 'reps' && (
                          <View style={[s.field, { flex: 1.4 }]}>
                            <Press onPress={() => nudge(i, -1)} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`Set ${i + 1} weight minus ${step}`}>
                              <Icon name="minus" size={16} color={color.muted} />
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
                            <Press onPress={() => nudge(i, 1)} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`Set ${i + 1} weight plus ${step}`}>
                              <Icon name="plus" size={16} color={color.muted} />
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
                        <SetCheck
                          done={set.done}
                          onPress={() => complete(i)}
                          label={`Complete set ${i + 1}`}
                          checkRef={(v) => {
                            checkRefs.current[i] = v;
                          }}
                        />
                        {isPR && (
                          <View style={s.prBadge} pointerEvents="none">
                            <Badge label="PR" variant="pr" icon="trophy" />
                          </View>
                        )}
                        {needInput === i && (kind === 'reps' ? !set.reps : !set.weight) && (
                          <Text style={s.needInput} accessibilityLiveRegion="polite">
                            {kind === 'reps' ? 'Enter your reps first' : 'Enter a weight first'}
                          </Text>
                        )}
                      </View>
                    </Animated.View>
                  );
                })}

                <View style={s.setBtns}>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="plus"
                    label="Add set"
                    onPress={() => {
                      const lastSet = sets[sets.length - 1];
                      write({ sets: [...sets, { weight: lastSet?.weight ?? '', reps: lastSet?.reps ?? '', done: false }] });
                    }}
                  />
                  {sets.length > 1 && <Button size="sm" variant="secondary" icon="minus" label="Remove" onPress={() => write({ sets: sets.slice(0, -1) })} />}
                </View>
              </>
            )}

            <View style={{ marginTop: space.xxl }}>
              {nextPlan ? (
                <Button
                  variant={allSetsDone ? 'default' : 'secondary'}
                  iconRight="arrowRight"
                  label={`Next: ${EXERCISES[pickOption(nextPlan, state.variants)].name}`}
                  onPress={goNext}
                />
              ) : (
                <Button iconRight="flag" label="Back to finish the workout" onPress={() => router.back()} />
              )}
            </View>

            {!skipped && (
              <Press onPress={skip} style={s.skipBtn} accessibilityRole="button" glow={color.muted}>
                <Icon name="bandage" size={18} color={color.muted} />
                <Text style={s.skipText}>Joint pain? Skip this exercise</Text>
              </Press>
            )}

            <Press onPress={() => setShowSteps((v) => !v)} style={s.howTo} accessibilityRole="button" accessibilityState={{ expanded: showSteps }}>
              <Text style={type.h2}>How to do it</Text>
              <Icon name={showSteps ? 'chevronUp' : 'chevronDown'} size={22} color={color.muted} />
            </Press>
            {showSteps &&
              ex.steps.map((t, i) => (
                <Animated.View key={i} entering={reduce ? undefined : FadeInDown.delay(i * motion.stagger).springify()} style={s.step}>
                  <Text style={s.stepNo}>{i + 1}</Text>
                  <Text style={[type.body, { flex: 1, color: color.muted }]}>{t}</Text>
                </Animated.View>
              ))}
          </View>
        </ScrollView>

        {restEnd && (
          <RestTimer
            key={restId}
            endsAt={restEnd}
            total={restTotal}
            tint={color.lime}
            nextLabel={nextLabel}
            skipLabel={allSetsDone ? (nextPlan ? 'Next' : 'Done') : 'Skip'}
            sound={state.restSound}
            startMini={restId === 0 && restEnd === carriedEnd}
            onAdd={() => {
              setRestTotal((t) => t + 15);
              setRestEnd((e) => (e ?? Date.now()) + 15000);
            }}
            onSkip={() => (allSetsDone ? goNext() : setRestEnd(null))}
            onDone={() => setRestEnd(null)}
          />
        )}
        <Flash fire={flash} />
        <Burst burst={burst} x={burstAt.x} y={burstAt.y} colors={[color.lime, color.pink, color.limeSoft, color.flash, color.pinkSoft]} />
        {pr && (
          <Animated.View entering={reduce ? undefined : SlideInUp.springify().damping(14)} style={[s.prWrap, { top: insets.top + space.md }]}>
            <Press onPress={() => setPr(null)} accessibilityRole="button" accessibilityLabel={`New PR, ${pr.value}. ${pr.delta}. Tap to dismiss`} style={{ borderRadius: radius.xl }} glow={color.pink}>
              <Glass strong r={radius.xl} style={s.prCard} glow={color.pink}>
                <View style={s.prIcon}>
                  <Icon name="trophy" size={28} color={color.ink} filled />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.prTitle}>NEW PR · {pr.value}</Text>
                  <Text style={s.prDelta}>{pr.delta}</Text>
                </View>
              </Glass>
            </Press>
          </Animated.View>
        )}
      </View>
    </Backdrop>
  );
}

const s = StyleSheet.create({
  missing: { flex: 1, padding: space.lg, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  pad: { paddingHorizontal: space.lg },
  title: { fontFamily: font.display, fontSize: size.display, lineHeight: leading.display, letterSpacing: -1.2, color: color.text, marginTop: space.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  legend: { marginTop: space.md, gap: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 14, height: 14, borderRadius: radius.pill },
  legendText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.small, color: color.text },
  variants: { marginTop: space.lg, gap: space.sm },
  callout: { marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  calloutText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.small, lineHeight: leading.small, color: color.text },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xxl, marginBottom: space.sm, paddingHorizontal: space.md },
  th: { fontFamily: font.bodyBlack, fontSize: size.tiny, letterSpacing: 1, color: color.subtle },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.glassSolid,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.glassBorder,
    padding: space.sm,
    paddingLeft: space.md,
    marginBottom: space.sm,
    minHeight: 76,
  },
  setRowDone: { backgroundColor: color.limeDim, borderColor: color.limeGlow },
  setRowPR: { borderColor: color.pink, borderWidth: 2 },
  setCol: { width: 64, gap: space.xxs },
  setNo: { fontFamily: font.display, fontSize: size.h2, lineHeight: leading.h2, color: color.muted },
  last: { fontFamily: font.bodySemi, fontSize: size.label, color: color.subtle, fontVariant: ['tabular-nums'] },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.surface2, borderRadius: radius.md, minHeight: 56 },
  stepBtn: { width: 30, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
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
  check: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: color.surface3, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: color.lime },
  prBadge: { position: 'absolute', top: -12, right: space.md },
  needInput: { position: 'absolute', bottom: space.xxs, left: 64 + space.md + space.sm, fontFamily: font.bodyBold, fontSize: size.tiny, color: color.pink },
  setBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  skipBtn: { marginTop: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: touch.min, borderRadius: radius.pill },
  skipText: { fontFamily: font.bodySemi, fontSize: size.small, color: color.muted },
  howTo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, minHeight: touch.min, borderRadius: radius.md },
  step: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  stepNo: { fontFamily: font.display, fontSize: size.h3, color: color.lime, width: 20 },
  prWrap: { position: 'absolute', left: space.lg, right: space.lg },
  prCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderColor: color.pink },
  prIcon: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: color.pink, alignItems: 'center', justifyContent: 'center' },
  prTitle: { fontFamily: font.display, fontSize: size.h2, color: color.text },
  prDelta: { fontFamily: font.bodyBold, fontSize: size.small, color: color.pinkSoft, marginTop: space.xxs },
});
