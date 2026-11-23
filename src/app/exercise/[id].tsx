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
import { HowTo, MachineSheet, MuscleLegend, PlateSheet, SwapSheet } from '../../components/ExerciseParts';
import { Backdrop, Glass } from '../../components/glass';
import { Icon } from '../../components/icons';
import { Burst, Flash } from '../../components/motion';
import { RestTimer } from '../../components/RestRing';
import { Badge, Button, Chip, IconButton, Press } from '../../components/ui';
import { EXERCISES, type ExerciseInfo } from '../../data/exercises';
import { MUSCLE_LABEL } from '../../data/muscles';
import { pickOption, restFor, targetTop } from '../../data/program';
import { swapsFor } from '../../data/swaps';
import { haptic } from '../../feedback';
import {
  LOAD_HINT,
  LOAD_LABEL,
  barFor,
  colorsKg,
  fmtKg,
  fromKg,
  loadTypeOf,
  loadTypesFor,
  platesTotal,
  round1,
  stackKg,
  type LoadInfo,
  type LoadType,
} from '../../load';
import { restCarry } from '../../restCarry';
import { bestBefore, dayById, kgOf, num, previousSession, prMetric, todayKey, useStore, type SetEntry } from '../../store';
import { color, fmtClock, font, leading, motion, radius, restBarClearance, size, space, touch, type } from '../../theme';
import { emptySets, exerciseFor, hitTopOfRange, loadText, setText, titleOf, visiblePlans } from '../../workout';

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

type Tab = 'howto' | 'muscles';
type SheetState = { kind: 'swap' } | { kind: 'machine' } | { kind: 'plates'; set: number } | null;

export default function ExerciseScreen() {
  const params = useLocalSearchParams<{ id: string; day?: string; slot?: string }>();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { state, update } = useStore();
  const date = todayKey();
  const day = dayById(state, params.day);
  const plan = day?.exercises.find((e) => e.slot === params.slot) ?? day?.exercises.find((e) => e.options.includes(params.id));
  // The planned exercise, and the one actually done (a remembered swap wins).
  const original = plan ? pickOption(plan, state.variants) : params.id;
  const id = plan ? exerciseFor(state, plan) : params.id;
  const ex: ExerciseInfo | undefined = EXERCISES[id];
  const targetSets = plan?.sets ?? 3;
  const unit = state.unit;
  const step = unit === 'kg' ? 2.5 : 5;
  const gym = state.gym;
  const machine = state.machines[id] ?? {};
  const lt: LoadType = loadTypeOf(id, state.loadTypes);

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
  const [switchBlocked, setSwitchBlocked] = useState(false);
  // A rest carried over from the previous exercise arrives as the slim bar, not full screen.
  const [carriedEnd] = useState(restEnd);
  // Each finished set starts a fresh rest (full screen); +15s keeps the current one.
  const [restId, setRestId] = useState(0);
  useEffect(() => {
    restCarry.endsAt = restEnd;
    restCarry.total = restTotal;
  }, [restEnd, restTotal]);

  const [tab, setTab] = useState<Tab>('muscles');
  const [sheet, setSheet] = useState<SheetState>(null);
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

  if (!ex) {
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
  const weighted = kind === 'weight_reps' || kind === 'weight_time';
  const rest = restFor(id, plan);
  const isPress = !!ex.press && !!day?.pressNote;
  const top = plan ? targetTop(plan.target) : null;
  const repsLabel = kind === 'weight_time' || kind === 'time' ? 'SEC' : 'REPS';
  const targetLabel = !plan
    ? ''
    : kind === 'weight_time' || kind === 'time'
      ? `${plan.target} s`
      : plan.target === 'max'
        ? 'max reps'
        : `${plan.target} reps`;
  const plans = day ? visiblePlans(state, day) : [];
  const idx = plan ? plans.indexOf(plan) : -1;
  const nextPlan = idx >= 0 ? plans[idx + 1] : undefined;
  const doneCount = sets.filter((x) => x.done).length;
  // Sets are stored per exercise, so switching version or swapping after logging would strand
  // today's sets under the old exercise. Block it (with a note) until they're cleared.
  const canSwitch = doneCount === 0;
  const allSetsDone = doneCount >= targetSets;
  const nextSetIdx = sets.findIndex((x) => !x.done);
  // Never offer an exercise another slot already uses today: logs are kept per exercise, so two slots would share one log.
  const taken = new Set(plans.filter((x) => x !== plan).map((x) => exerciseFor(state, x)));
  const swaps = swapsFor(original, state.injured).filter((x) => !taken.has(x.id));
  const swapped = id !== original;

  // ----- Weights in your unit -----
  /** A set's weight in the unit you're viewing, without rewriting what was saved. */
  const shown = (x: SetEntry | undefined) => {
    if (!x || x.weight === '') return '';
    if ((x.u ?? unit) === unit) return x.weight;
    const kg = kgOf(x);
    return kg === null ? '' : round1(fromKg(kg, unit));
  };
  const ghostOf = (i: number) => prev?.sets[i] ?? prev?.sets[prev.sets.length - 1];
  /** Pin / plates / colours: today's, else pre-filled from last session if it used the same load type. */
  const loadOf = (i: number): LoadInfo | undefined => {
    const own = sets[i]?.load;
    if (own?.t === lt) return own;
    // Carry forward the nearest earlier set today that used this load type.
    for (let j = i - 1; j >= 0; j--) {
      const before = sets[j]?.load;
      if (before?.t === lt) return before;
    }
    const g = ghostOf(i)?.load;
    return g?.t === lt ? g : undefined;
  };
  /** Turn a load into a saved weight (kg) for this set. */
  const fromLoad = (l: LoadInfo): Pick<SetEntry, 'weight' | 'u' | 'load'> => {
    let kg: number | null = null;
    if (l.t === 'stack' && l.pin !== undefined) kg = stackKg(l.pin, machine);
    if (l.t === 'plates') kg = platesTotal(l.plates ?? [], l.bar ?? 0);
    if (l.t === 'colors') kg = (l.bar ?? 0) + 2 * colorsKg(l.colors ?? [], gym);
    return { weight: kg === null ? '' : String(Math.round(kg * 100) / 100), u: 'kg', load: l };
  };

  const prevTopKg = prev ? Math.max(0, ...prev.sets.map((x) => kgOf(x) ?? 0)) : 0;
  const prevTopPin = prev ? Math.max(0, ...prev.sets.map((x) => x.load?.pin ?? 0)) : 0;
  const prevHitTop = !!prev && !!plan && kind !== 'reps' && hitTopOfRange(prev.sets.map((x) => ({ ...x, done: true })), plan);
  const todayHitTop = !!plan && kind !== 'reps' && hitTopOfRange(sets, plan);
  const addHint = () => {
    if (lt === 'stack') return todayHitTop ? 'Top of the range on every set. Go up a pin next time.' : `You hit ${top} on every set last time. Go up a pin: try pin ${prevTopPin + 1}.`;
    if (kind === 'time') return todayHitTop ? 'Top of the range on every set. Add 10 seconds next time.' : `You hit ${top} s every set last time. Add 10 seconds.`;
    return todayHitTop
      ? `Top of the range on every set. Add weight next time (+${step} ${unit}).`
      : `You hit ${top} on every set last time. Add weight: try ${round1(fromKg(prevTopKg, unit) + step)} ${unit}.`;
  };

  const goNext = () =>
    nextPlan && day
      ? router.replace({ pathname: '/exercise/[id]', params: { id: exerciseFor(state, nextPlan), day: day.id, slot: nextPlan.slot } })
      : router.back();

  const write = (next: { sets?: SetEntry[]; skipped?: boolean }) => {
    // eslint-disable-next-line react-hooks/purity -- runs in tap handlers, not during render
    const now = Date.now();
    update((st) => ({
      ...st,
      logs: { ...st.logs, [date]: { ...st.logs[date], [id]: { ...(st.logs[date]?.[id] ?? { sets }), ...next } } },
      sessions:
        st.sessions[date]?.startedAt || !day
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
      value: weighted ? fmtKg(value, unit) : kind === 'time' ? `${value} s` : `${value} reps`,
      delta: weighted ? `+${round1(fromKg(delta, unit))} ${unit} vs your best` : `+${delta}${kind === 'time' ? ' s' : ' reps'} vs your best`,
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

  /** The set as it would be saved now: typed values, else last session's, else the top of the range. */
  const resolved = (i: number): SetEntry => {
    const cur = sets[i];
    const ghost = ghostOf(i);
    const reps = cur.reps || ghost?.reps || (top ? String(top) : '');
    if (!weighted) return { weight: '', reps, done: cur.done };
    if (lt === 'weight') {
      if (cur.weight) return { weight: cur.weight, u: cur.u ?? unit, reps, done: cur.done };
      const g = shown(ghost) || (ghost && kgOf(ghost) !== null ? round1(fromKg(kgOf(ghost)!, unit)) : '');
      return { weight: g, u: unit, reps, done: cur.done };
    }
    const l = loadOf(i);
    return l ? { ...fromLoad(l), reps, done: cur.done } : { weight: '', reps, done: cur.done };
  };

  const complete = (i: number) => {
    const cur = sets[i];
    if (cur.done) return edit(i, { done: false });
    const entry = { ...resolved(i), done: true };
    const missingLoad = weighted && entry.weight === '' && entry.load?.pin === undefined;
    if (!entry.reps || missingLoad) {
      haptic.tap();
      setNeedInput(i);
      if (missingLoad && (lt === 'plates' || lt === 'colors')) setSheet({ kind: 'plates', set: i });
      return;
    }
    setNeedInput(null);
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
    const base = num(shown(sets[i])) ?? num(resolved(i).weight) ?? 0;
    edit(i, { weight: String(Math.max(0, Math.round((base + dir * step) * 10) / 10)), u: unit, load: undefined, done: false });
  };

  const pinStep = (i: number, dir: 1 | -1) => {
    const cur = loadOf(i)?.pin ?? 0;
    const pin = Math.max(1, cur + dir);
    edit(i, { ...fromLoad({ t: 'stack', pin }), done: false });
  };

  const skip = () => {
    write({ skipped: !skipped });
    if (!skipped) router.back();
  };

  const pickSwap = (to: string) => {
    if (!plan) return;
    haptic.setDone();
    update((st) => {
      const next = { ...st.swaps };
      if (to === original) delete next[plan.slot];
      else next[plan.slot] = to;
      return { ...st, swaps: next };
    });
    setSheet(null);
  };

  const nextLabel = allSetsDone
    ? nextPlan
      ? `Next up: ${EXERCISES[exerciseFor(state, nextPlan)].name}`
      : 'Last exercise done'
    : nextSetIdx < 0
      ? 'All sets done'
      : `Set ${nextSetIdx + 1} · ${setText(resolved(nextSetIdx), kind, unit, gym).replace(/^ × /, '')}`;

  const types = loadTypesFor(id);
  const plateSet = sheet?.kind === 'plates' ? sheet.set : -1;
  const plateLoad = plateSet >= 0 ? loadOf(plateSet) : undefined;

  return (
    <Backdrop>
      <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: restBarClearance + insets.bottom }}>
          <View style={s.header}>
            <IconButton icon="back" label="Back" onPress={() => router.back()} />
            {day && plan ? <Badge label={`${titleOf(day)} · ${idx + 1}/${plans.length}`} variant="secondary" /> : <Badge label="Exercise library" variant="secondary" />}
            <View style={{ width: touch.min }} />
          </View>

          <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(16)} style={s.pad}>
            <Text style={s.title} accessibilityRole="header" testID="exercise-title">
              {ex.name}
            </Text>
            <View style={s.tags}>
              {plan && <Badge label={`${plan.sets} × ${targetLabel}`} />}
              <Badge label={`Rest ${fmtClock(rest)}`} variant="secondary" icon="timer" />
              {best > 0 && (
                <Badge label={`Best ${weighted ? fmtKg(best, unit) : `${best}${kind === 'time' ? ' s' : ' reps'}`}`} variant="outline" icon="trophy" />
              )}
            </View>
            {plan && (
              <View style={s.swapRow}>
                <Button size="sm" variant="outline" icon="swap" label="Swap" accessibilityLabel={`Swap ${ex.name}`} onPress={() => (canSwitch ? setSheet({ kind: 'swap' }) : setSwitchBlocked(true))} />
                {swapped && (
                  <Text style={s.swappedText} numberOfLines={2}>
                    Swapped from {EXERCISES[original].name}.{' '}
                    <Text style={s.reset} onPress={() => pickSwap(original)} accessibilityRole="button">
                      Reset
                    </Text>
                  </Text>
                )}
              </View>
            )}
          </Animated.View>

          {/* How to / Muscles */}
          <View style={[s.pad, { marginTop: space.lg }]}>
            <View style={s.tabs} accessibilityRole="tablist">
              {(['howto', 'muscles'] as Tab[]).map((t) => (
                <Press
                  key={t}
                  onPress={() => setTab(t)}
                  style={[s.tab, tab === t && s.tabOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t }}
                >
                  <Icon name={t === 'howto' ? 'info' : 'body'} size={16} color={tab === t ? color.ink : color.muted} />
                  <Text style={[s.tabText, tab === t && { color: color.ink }]}>{t === 'howto' ? 'How to' : 'Muscles'}</Text>
                </Press>
              ))}
            </View>
            <View style={{ marginTop: space.md }}>
              {tab === 'howto' ? (
                <HowTo ex={ex} />
              ) : (
                <>
                  <Glass strong r={radius.xxl} style={{ overflow: 'hidden' }}>
                    <BodyModel
                      paint={paint}
                      height={320}
                      tint={color.lime}
                      describe={(m) => `${MUSCLE_LABEL[m]}${ex.primary.includes(m) ? ' · primary' : ex.secondary.includes(m) ? ' · secondary' : ''}`}
                    />
                  </Glass>
                  <MuscleLegend ex={ex} />
                </>
              )}
            </View>
          </View>

          {plan && day && (
            <View style={s.pad}>
              {plan.options.length > 1 && !swapped && (
                <View style={s.variants}>
                  <Text style={[type.small, { color: color.text }]}>Pick your version (remembered)</Text>
                  <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                    {plan.options.map((o) => (
                      <Chip
                        key={o}
                        label={EXERCISES[o].name}
                        active={o === id}
                        onPress={() => (o === id ? undefined : canSwitch ? update((st) => ({ ...st, variants: { ...st.variants, [plan.slot]: o } })) : setSwitchBlocked(true))}
                      />
                    ))}
                  </View>
                </View>
              )}

              {switchBlocked && !canSwitch && (
                <Glass r={radius.lg} style={s.callout}>
                  <Icon name="info" size={22} color={color.muted} />
                  <Text style={s.calloutText} accessibilityLiveRegion="polite">
                    You&apos;ve logged sets on {ex.name} today. Untick them to switch exercise, or keep going and switch next time.
                  </Text>
                </Glass>
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
                  <Text style={[s.calloutText, { color: color.limeSoft }]}>{addHint()}</Text>
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
                  {/* Load type: remembered per exercise */}
                  {types.length > 1 && (
                    <View style={s.loadBox}>
                      <View style={s.loadHead}>
                        <Text style={type.label}>Log weight as</Text>
                        {(lt === 'stack' || lt === 'plates' || lt === 'colors') && (
                          <Press onPress={() => setSheet({ kind: 'machine' })} style={s.gear} accessibilityRole="button" accessibilityLabel="Machine and bar settings">
                            <Icon name="sliders" size={16} color={color.muted} />
                            <Text style={s.gearText}>{lt === 'stack' ? (machine.perPlate ? `${round1(machine.perPlate)} kg / plate` : 'Set kg per plate') : `Bar ${round1(barFor(id, gym, machine))} kg`}</Text>
                          </Press>
                        )}
                      </View>
                      <View style={s.loadChips}>
                        {types.map((t) => (
                          <Chip key={t} label={LOAD_LABEL[t]} active={t === lt} onPress={() => update((st) => ({ ...st, loadTypes: { ...st.loadTypes, [id]: t } }))} />
                        ))}
                      </View>
                      <Text style={[type.small, { marginTop: space.xs }]}>{LOAD_HINT[lt]}</Text>
                    </View>
                  )}

                  <View style={s.tableHead}>
                    <Text style={[s.th, { width: 64 }]}>SET</Text>
                    {weighted && (
                      <Text style={[s.th, { flex: 1.4, textAlign: 'center' }]}>
                        {lt === 'stack' ? 'PIN' : lt === 'weight' ? unit.toUpperCase() : 'PLATES'}
                      </Text>
                    )}
                    <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>{repsLabel}</Text>
                    <View style={{ width: 56 }} />
                  </View>

                  {sets.map((set, i) => {
                    const ghost = prev?.sets[i];
                    const isPR = set.done && best > 0 && prMetric(set, kind) > best;
                    const lastText = ghost ? (weighted ? `${shown(ghost) || (ghost.load?.pin ? `P${ghost.load.pin}` : '?')}×${ghost.reps}` : `${ghost.reps}`) : '—';
                    const r = resolved(i);
                    const l = loadOf(i);
                    const label = weighted && lt !== 'weight' ? loadText(set.done ? set : r, unit, gym) : '';
                    return (
                      <Animated.View key={i} entering={reduce ? undefined : FadeInDown.delay(motion.stagger * (i + 2)).springify().damping(16)}>
                        <View style={[s.setRow, set.done && s.setRowDone, isPR && s.setRowPR]} testID={`set-row-${i}`}>
                          <View style={s.setCol}>
                            <Text style={[s.setNo, set.done && { color: color.lime }]}>{i + 1}</Text>
                            <Text style={s.last} numberOfLines={1} accessibilityLabel={ghost ? `Last time ${lastText}` : 'No previous set'}>
                              {lastText}
                            </Text>
                          </View>
                          {weighted && lt === 'weight' && (
                            <View style={[s.field, { flex: 1.4 }]}>
                              <Press onPress={() => nudge(i, -1)} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`Set ${i + 1} weight minus ${step}`}>
                                <Icon name="minus" size={16} color={color.muted} />
                              </Press>
                              <TextInput
                                value={shown(set)}
                                onChangeText={(t) => edit(i, { weight: t.replace(/[^0-9.,]/g, ''), u: unit, load: undefined, done: false })}
                                placeholder={r.weight || '0'}
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
                          {weighted && lt === 'stack' && (
                            <View style={[s.field, { flex: 1.4 }]}>
                              <Press onPress={() => pinStep(i, -1)} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`Set ${i + 1} pin down`}>
                                <Icon name="minus" size={16} color={color.muted} />
                              </Press>
                              <Text style={[s.input, s.pinText, !set.load?.pin && { color: l?.pin ? color.muted : color.subtle }]} accessibilityLabel={`Set ${i + 1} pin ${l?.pin ?? 'not set'}`}>
                                {l?.pin ?? '–'}
                              </Text>
                              <Press onPress={() => pinStep(i, 1)} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`Set ${i + 1} pin up`}>
                                <Icon name="plus" size={16} color={color.muted} />
                              </Press>
                            </View>
                          )}
                          {weighted && (lt === 'plates' || lt === 'colors') && (
                            <Press
                              onPress={() => setSheet({ kind: 'plates', set: i })}
                              style={[s.field, s.plateField, { flex: 1.4 }]}
                              accessibilityRole="button"
                              accessibilityLabel={`Set ${i + 1} plates: ${label || 'none'}. Change`}
                            >
                              {lt === 'colors' && !(set.done && set.load?.t !== 'colors') && l?.colors?.length ? (
                                <View style={s.dots}>
                                  {l.colors.map((c, k) => (
                                    <View key={k} style={[s.dot, { backgroundColor: gym.colors.find((x) => x.id === c)?.hex ?? color.subtle }]} />
                                  ))}
                                </View>
                              ) : null}
                              <Text style={[s.plateKg, !set.load && { color: color.muted }]} numberOfLines={1}>
                                {set.done && kgOf(set) !== null ? fmtKg(kgOf(set)!, unit) : r.weight ? fmtKg(Number(r.weight), unit) : 'Tap to load'}
                              </Text>
                            </Press>
                          )}
                          <View style={[s.field, { flex: 1 }]}>
                            <TextInput
                              value={set.reps}
                              onChangeText={(t) => edit(i, { reps: t.replace(/[^0-9]/g, ''), done: false })}
                              placeholder={ghost?.reps ?? (top ? String(top) : '0')}
                              placeholderTextColor={color.subtle}
                              keyboardType="number-pad"
                              style={s.input}
                              accessibilityLabel={`Set ${i + 1} ${repsLabel === 'SEC' ? 'seconds' : 'reps'}`}
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
                          {needInput === i && (
                            <Text style={s.needInput} accessibilityLiveRegion="polite">
                              {!r.reps ? 'Enter your reps first' : lt === 'stack' ? 'Pick a pin first' : lt === 'weight' ? 'Enter a weight first' : 'Load the plates first'}
                            </Text>
                          )}
                        </View>
                        {label ? (
                          <Text style={s.loadLabel} numberOfLines={1} testID={`set-label-${i}`}>
                            {label}
                          </Text>
                        ) : null}
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
                        write({ sets: [...sets, { ...lastSet, weight: lastSet?.weight ?? '', reps: lastSet?.reps ?? '', done: false }] });
                      }}
                    />
                    {sets.length > 1 && <Button size="sm" variant="secondary" icon="minus" label="Remove" onPress={() => write({ sets: sets.slice(0, -1) })} />}
                  </View>
                </>
              )}

              <View style={{ marginTop: space.xxl }}>
                {nextPlan ? (
                  <Button variant={allSetsDone ? 'default' : 'secondary'} iconRight="arrowRight" label={`Next: ${EXERCISES[exerciseFor(state, nextPlan)].name}`} onPress={goNext} />
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
            </View>
          )}
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

        {sheet?.kind === 'swap' && plan && (
          <SwapSheet original={original} current={id} swaps={swaps} onPick={pickSwap} onReset={() => pickSwap(original)} onClose={() => setSheet(null)} />
        )}
        {sheet?.kind === 'machine' && (
          <MachineSheet
            name={ex.name}
            setup={machine}
            showBar={lt !== 'stack'}
            onClose={() => setSheet(null)}
            onSave={(m) => {
              update((st) => ({ ...st, machines: { ...st.machines, [id]: m } }));
              setSheet(null);
            }}
          />
        )}
        {sheet?.kind === 'plates' && (lt === 'plates' || lt === 'colors') && (
          <PlateSheet
            mode={lt}
            gym={gym}
            unit={unit}
            initial={(lt === 'plates' ? plateLoad?.plates : plateLoad?.colors) ?? []}
            bar={plateLoad?.bar ?? barFor(id, gym, machine)}
            onClose={() => setSheet(null)}
            onSave={(side, bar) => {
              const l: LoadInfo = lt === 'plates' ? { t: 'plates', plates: side as number[], bar } : { t: 'colors', colors: side as string[], bar };
              edit(plateSet, { ...fromLoad(l), done: false });
              setNeedInput(null);
              setSheet(null);
            }}
          />
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
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  swappedText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.label, color: color.muted },
  reset: { fontFamily: font.bodyBlack, color: color.lime, textDecorationLine: 'underline' },
  tabs: { flexDirection: 'row', gap: space.xs, padding: space.xs, borderRadius: radius.pill, backgroundColor: color.glassSolid, borderWidth: 1, borderColor: color.glassBorder },
  tab: { flex: 1, flexDirection: 'row', gap: space.xs, alignItems: 'center', justifyContent: 'center', minHeight: touch.min - 4, borderRadius: radius.pill },
  tabOn: { backgroundColor: color.lime },
  tabText: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.muted },
  loadBox: { marginTop: space.xl, gap: space.xs },
  loadHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loadChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  gear: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touch.min, paddingHorizontal: space.sm, borderRadius: radius.pill },
  gearText: { fontFamily: font.bodyBold, fontSize: size.label, color: color.muted },
  pinText: { textAlignVertical: 'center', lineHeight: 56 },
  plateField: { justifyContent: 'center', gap: space.xs, paddingHorizontal: space.sm, flexDirection: 'column' },
  plateKg: { fontFamily: font.display, fontSize: size.body, color: color.text, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 3, justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: color.glassBorder },
  loadLabel: { fontFamily: font.bodyBold, fontSize: size.label, color: color.muted, marginTop: -space.xs, marginBottom: space.sm, marginLeft: 64 + space.md + space.sm },
  prWrap: { position: 'absolute', left: space.lg, right: space.lg },
  prCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderColor: color.pink },
  prIcon: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: color.pink, alignItems: 'center', justifyContent: 'center' },
  prTitle: { fontFamily: font.display, fontSize: size.h2, color: color.text },
  prDelta: { fontFamily: font.bodyBold, fontSize: size.small, color: color.pinkSoft, marginTop: space.xxs },
});
