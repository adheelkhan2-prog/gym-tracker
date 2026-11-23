import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Backdrop, Vignette } from '../components/glass';
import { Icon } from '../components/icons';
import { Burst, Flash } from '../components/motion';
import { RestTimer } from '../components/RestRing';
import { Button, IconButton, Press } from '../components/ui';
import { EXERCISES } from '../data/exercises';
import { howToImages } from '../data/how-to';
import { MUSCLE_LABEL } from '../data/muscles';
import { restFor } from '../data/program';
import { crumb, logCrash } from '../crash';
import { haptic } from '../feedback';
import { readyToLog, stepFor, suggestSet, weightIn } from '../focus';
import { fmtKg, loadTypeOf, round1, weightFromLoad } from '../load';
import { restCarry } from '../restCarry';
import { bestBefore, dayById, num, prMetric, todayKey, useStore, type SetEntry } from '../store';
import { color, font, leading, motion, radius, size, space, touch, type } from '../theme';
import { loadText, setText, slotStatuses } from '../workout';

/**
 * Focus mode: one exercise at a time, nothing else on screen. The current set is big in the
 * middle and pre-filled (last time, or a step up when you earned it), so logging is one tap.
 * Swipe left/right (or the arrows) between exercises, pull down to close. Long-press a set to
 * edit it, swipe it left to delete (with undo). Everything you press lives in the bottom third.
 */
export default function FocusScreen() {
  const params = useLocalSearchParams<{ day?: string }>();
  const { state, update, commit } = useStore();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const date = todayKey();
  const day = dayById(state, params.day);
  const statuses = day ? slotStatuses(state, day, date) : [];
  const firstOpen = Math.max(0, statuses.findIndex((x) => !x.complete));
  const [idx, setIdx] = useState(firstOpen);
  const i = Math.min(idx, Math.max(0, statuses.length - 1));
  const st = statuses[i];
  const allDone = statuses.length > 0 && statuses.every((x) => x.complete);

  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ key: string; set: SetEntry } | null>(null);
  const [undo, setUndo] = useState<{ id: string; sets: SetEntry[]; n: number } | null>(null);
  const [restEnd, setRestEnd] = useState<number | null>(() => (restCarry.endsAt && restCarry.endsAt > Date.now() ? restCarry.endsAt : null));
  const [restTotal, setRestTotal] = useState(restCarry.total);
  const [pr, setPr] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    restCarry.endsAt = restEnd;
    restCarry.total = restTotal;
  }, [restEnd, restTotal]);
  useEffect(() => () => void (undoTimer.current && clearTimeout(undoTimer.current)), []);

  // ----- Gestures: pull down to close, swipe between exercises -----
  const y = useSharedValue(0);
  const x = useSharedValue(0);
  const close = () => router.back();
  const go = (to: number) => {
    if (!statuses.length) return;
    const n = (to + statuses.length) % statuses.length;
    if (n === i) return;
    haptic.tap();
    setEditing(null);
    setIdx(n);
    if (!reduce) {
      x.set(to > i ? width * 0.35 : -width * 0.35);
      x.set(withSpring(0, motion.swipe));
    }
  };
  const pull = usePanGesture({
    activeOffsetY: [-1000, 18],
    failOffsetX: [-16, 16],
    onUpdate: (e) => {
      'worklet';
      y.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 140 || e.velocityY > 1000) scheduleOnRN(close);
      else y.set(withSpring(0, motion.spring));
    },
  });
  const swipe = usePanGesture({
    activeOffsetX: [-16, 16],
    failOffsetY: [-14, 14],
    onUpdate: (e) => {
      'worklet';
      x.set(e.translationX * 0.6);
    },
    onDeactivate: (e) => {
      'worklet';
      const fling = e.translationX + e.velocityX * 0.12;
      if (fling < -90) scheduleOnRN(go, i + 1);
      else if (fling > 90) scheduleOnRN(go, i - 1);
      else x.set(withSpring(0, motion.spring));
    },
  });
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: interpolate(y.value, [0, 300], [1, 0.4], 'clamp'),
  }));
  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: interpolate(Math.abs(x.value), [0, width * 0.5], [1, 0.3], 'clamp') }));

  if (!day || !st) {
    return (
      <Backdrop>
        <View style={[s.empty, { paddingTop: insets.top + space.x4 }]}>
          <Text style={type.title}>No workout today</Text>
          <Button variant="outline" label="Close" onPress={close} />
        </View>
      </Backdrop>
    );
  }

  // ----- The exercise on screen -----
  const id = st.exerciseId;
  const plan = st.plan;
  const ex = EXERCISES[id];
  const kind = ex.kind;
  const weighted = kind === 'weight_reps' || kind === 'weight_time';
  const unit = state.unit;
  const step = stepFor(unit);
  const lt = loadTypeOf(id, state.loadTypes);
  const machine = state.machines[id];
  const log = state.logs[date]?.[id];
  const all = log?.sets ?? [];
  const done = all.filter((x) => x.done);
  const cur = done.length;
  const key = `${id}:${editing ?? `n${cur}`}`;
  const suggestion = suggestSet(state, id, plan, date, editing ?? cur);
  const value: SetEntry = draft?.key === key ? draft.set : editing !== null ? { ...done[editing], done: false } : suggestion.set;
  const setValue = (v: SetEntry) => setDraft({ key, set: v });
  const exDone = cur >= plan.sets;
  const next = statuses.find((x, j) => j > i && !x.complete) ?? statuses.find((x) => !x.complete && x !== st);

  /** Save `done` sets (in order) for this exercise, keeping at least the planned number of rows. */
  const saveDone = (nextDone: SetEntry[]) => {
    const pad = Math.max(0, plan.sets - nextDone.length);
    const rows = [...nextDone, ...Array.from({ length: pad }, () => ({ weight: '', reps: '', done: false }))];
    update((s) => ({
      ...s,
      logs: { ...s.logs, [date]: { ...s.logs[date], [id]: { ...(s.logs[date]?.[id] ?? {}), sets: rows } } },
      sessions: s.sessions[date]?.startedAt ? s.sessions : { ...s.sessions, [date]: { ...s.sessions[date], dayId: s.sessions[date]?.dayId ?? day.id, startedAt: Date.now() } },
    }));
  };

  // ----- Adjust the set before logging -----
  const bump = (dir: 1 | -1) => {
    haptic.tap();
    if (lt === 'stack' && weighted) {
      const pin = Math.max(1, (value.load?.pin ?? 0) + dir);
      setValue({ ...value, ...weightFromLoad({ t: 'stack', pin }, state.gym, machine) });
    } else {
      const w = Math.max(0, (num(value.weight) ?? 0) + dir * step);
      setValue({ ...value, weight: round1(w), u: unit, load: undefined });
    }
  };
  const bumpReps = (dir: 1 | -1) => {
    haptic.tap();
    const d = kind === 'time' || kind === 'weight_time' ? 5 : 1;
    setValue({ ...value, reps: String(Math.max(0, (num(value.reps) ?? 0) + dir * d)) });
  };

  // ----- Log (one tap) -----
  const logSet = () => {
    if (!readyToLog(value, id)) {
      haptic.tap();
      if (weighted && lt !== 'weight' && lt !== 'stack') router.push({ pathname: '/exercise/[id]', params: { id, day: day.id, slot: plan.slot } });
      return;
    }
    const entry: SetEntry = { ...value, done: true };
    if (editing !== null) {
      saveDone(done.map((x, k) => (k === editing ? entry : x)));
      setEditing(null);
      haptic.setDone();
      return;
    }
    const metric = prMetric(entry, kind);
    const best = bestBefore(state.logs, id, date);
    const bestToday = Math.max(0, ...done.map((x) => prMetric(x, kind) || 0));
    saveDone([...done, entry]);
    if (best > 0 && metric > best && metric > bestToday) {
      haptic.thump();
      setTimeout(() => haptic.pr(), 120);
      setFlash((n) => n + 1);
      setPr(weighted ? fmtKg(metric, unit) : `${metric}${kind === 'time' ? ' s' : ' reps'}`);
      setTimeout(() => setPr(null), 2600);
    } else haptic.setDone();
    const finishedExercise = cur + 1 >= plan.sets;
    const finishedDay = finishedExercise && statuses.every((x) => x === st || x.complete);
    if (finishedDay) {
      setRestEnd(null);
      return;
    }
    const rest = restFor(id, plan);
    setRestTotal(rest);
    // eslint-disable-next-line react-hooks/purity -- runs in the tap handler, not during render
    setRestEnd(Date.now() + rest * 1000);
    if (finishedExercise && next) setTimeout(() => go(statuses.indexOf(next)), 450);
  };

  // ----- Swipe a set to delete, with undo -----
  const deleteSet = (k: number) => {
    haptic.setDone();
    setUndo({ id, sets: all, n: k + 1 });
    saveDone(done.filter((_, j) => j !== k));
    setEditing(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };
  const undoDelete = () => {
    if (!undo) return;
    haptic.tap();
    update((s) => ({ ...s, logs: { ...s.logs, [date]: { ...s.logs[date], [undo.id]: { ...(s.logs[date]?.[undo.id] ?? {}), sets: undo.sets } } } }));
    setUndo(null);
  };

  // Save the finished session to disk first; only then open the celebration (heavy: 3D model,
  // particles), so a crash there can never lose the workout.
  const finishWorkout = async () => {
    haptic.pr();
    crumb('finish workout (focus)');
    // eslint-disable-next-line react-hooks/purity -- runs in the tap handler, not during render
    const at = Date.now();
    await commit((s) => ({ ...s, sessions: { ...s.sessions, [date]: { ...s.sessions[date], dayId: s.sessions[date]?.dayId ?? day.id, finishedAt: at } } })).catch((e) =>
      logCrash('error', e, 'saving finished workout'),
    );
    router.replace({ pathname: '/complete', params: { date } });
  };

  // ----- What the big number says -----
  const w = weighted && value.weight !== '' ? weightIn(value, unit) : null;
  const shownWeight = w === null ? '' : round1(w);
  const bigMain = weighted ? (lt === 'stack' && value.load?.pin !== undefined && value.weight === '' ? `Pin ${value.load.pin}` : shownWeight || '—') : value.reps || '—';
  const bigUnit = weighted ? (lt === 'stack' && value.weight === '' ? '' : unit) : kind === 'time' ? 's' : 'reps';
  const repsLine = weighted ? `× ${value.reps || '—'}${kind === 'weight_time' ? ' s' : ' reps'}` : '';
  const loadLine = weighted && lt !== 'weight' ? loadText({ ...value, done: false }, unit, state.gym) : '';
  const clay = howToImages(id);
  const fig = clay?.clay ? (exDone ? clay.end : clay.start) : null;
  const lastLine = suggestion.last ? `Last time ${setText(suggestion.last, kind, unit, state.gym)}` : 'First time: pick a weight you can do with good form';
  const why = editing !== null ? `Editing set ${editing + 1}` : suggestion.reason === 'up' ? `Up ${lt === 'stack' ? 'a pin' : `${step} ${unit}`}: you hit the top of the range last time` : suggestion.reason === 'today' ? 'Same as your last set' : '';

  return (
    <Backdrop>
      <GestureDetector gesture={pull}>
        <Animated.View style={[{ flex: 1 }, sheetStyle]}>
          {/* Top: close, where you are, details */}
          <View style={[s.top, { paddingTop: insets.top + space.sm }]}>
            <IconButton icon="arrowDown" label="Close focus mode" onPress={close} />
            <View style={s.dots} accessibilityLabel={`Exercise ${i + 1} of ${statuses.length}`}>
              {statuses.map((x, j) => (
                <View key={x.plan.slot} style={[s.dot, x.complete && s.dotDone, j === i && s.dotOn]} />
              ))}
            </View>
            <IconButton icon="info" label={`${ex.name} details`} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id, day: day.id, slot: plan.slot } })} />
          </View>

          <GestureDetector gesture={swipe}>
            <Animated.View style={[s.page, pageStyle]}>
              <View style={s.titleRow}>
                <Text style={s.exName} numberOfLines={2} accessibilityRole="header" testID="focus-title">
                  {ex.name}
                </Text>
                <Text style={type.small} numberOfLines={1}>
                  {plan.sets} × {plan.target}
                  {kind === 'time' || kind === 'weight_time' ? ' s' : ''} · {ex.primary.map((m) => MUSCLE_LABEL[m]).slice(0, 2).join(', ')}
                </Text>
              </View>

              {allDone ? (
                <View style={s.center}>
                  <Icon name="checkCircle" size={40} color={color.accent} filled />
                  <Text style={[type.title, { marginTop: space.md }]}>Every set done</Text>
                  <Text style={[type.bodyMuted, { marginTop: space.xs }]}>Finish to bank the session.</Text>
                </View>
              ) : (
                <View style={s.center}>
                  {/* The exercise itself, lit in the same dark room (clay render), dimmed behind the numbers. */}
                  {fig ? (
                    <View style={s.figure} pointerEvents="none">
                      <Image source={fig} style={s.figureImg} resizeMode="contain" accessibilityIgnoresInvertColors />
                      <Vignette width="100%" height="100%" strength={1} id={`focus-vig-${id}`} cy="48%" />
                    </View>
                  ) : null}
                  <Text style={type.label}>{exDone && editing === null ? 'Exercise done' : editing !== null ? `Set ${editing + 1}` : `Set ${cur + 1} of ${plan.sets}`}</Text>
                  <View style={s.bigRow} accessibilityLabel={`${bigMain} ${bigUnit} ${repsLine}`}>
                    <Text style={[s.big, value.weight !== '' || !weighted ? { color: color.accent } : null]} numberOfLines={1} adjustsFontSizeToFit>
                      {bigMain}
                    </Text>
                    {bigUnit ? <Text style={s.bigUnit}>{bigUnit}</Text> : null}
                  </View>
                  {repsLine ? <Text style={s.reps}>{repsLine}</Text> : null}
                  {loadLine ? <Text style={type.small}>{loadLine}</Text> : null}
                  <Text style={[type.small, { marginTop: space.md, textAlign: 'center' }]} numberOfLines={2}>
                    {lastLine}
                  </Text>
                  {why ? <Text style={s.why}>{why}</Text> : null}
                </View>
              )}

              {/* Sets done today: long-press to edit, swipe left to delete */}
              <View style={s.doneList}>
                {done.map((x, k) => (
                  <DoneRow
                    key={`${id}-${k}-${x.weight}-${x.reps}`}
                    n={k + 1}
                    text={setText(x, kind, unit, state.gym)}
                    editing={editing === k}
                    onEdit={() => {
                      haptic.setDone();
                      setEditing(k);
                    }}
                    onDelete={() => deleteSet(k)}
                  />
                ))}
              </View>
            </Animated.View>
          </GestureDetector>

          {/* Thumb zone: adjust, then one tap to log */}
          <View style={[s.bottom, { paddingBottom: insets.bottom + space.lg }]}>
            {undo && (
              <Animated.View entering={reduce ? undefined : FadeIn.duration(motion.fast)} exiting={reduce ? undefined : FadeOut.duration(motion.fast)} style={s.undo}>
                <Text style={[type.small, { flex: 1, color: color.text }]}>Set {undo.n} deleted</Text>
                <Button size="sm" variant="ghost" label="Undo" onPress={undoDelete} />
              </Animated.View>
            )}
            {!allDone && (!exDone || editing !== null) && (
              <View style={s.adjust}>
                {weighted && (lt === 'weight' || lt === 'stack') && (
                  <Stepper label={lt === 'stack' ? 'Pin' : unit} onMinus={() => bump(-1)} onPlus={() => bump(1)} name={lt === 'stack' ? 'pin' : 'weight'} />
                )}
                <Stepper label={kind === 'time' || kind === 'weight_time' ? 'sec' : 'reps'} onMinus={() => bumpReps(-1)} onPlus={() => bumpReps(1)} name={kind === 'time' || kind === 'weight_time' ? 'seconds' : 'reps'} />
              </View>
            )}
            <View style={s.navRow}>
              <IconButton icon="back" label="Previous exercise" onPress={() => go(i - 1)} />
              <View style={{ flex: 1 }}>
                {allDone ? (
                  <Button size="lg" variant="solid" label="Finish workout" iconRight="flag" onPress={finishWorkout} />
                ) : editing !== null ? (
                  <Button size="lg" label={`Save set ${editing + 1}`} icon="check" onPress={logSet} />
                ) : exDone ? (
                  <Button size="lg" label={next ? `Next: ${EXERCISES[next.exerciseId].name}` : 'Next exercise'} iconRight="arrowRight" onPress={() => go(next ? statuses.indexOf(next) : i + 1)} />
                ) : (
                  <Button size="lg" label={`Log set ${cur + 1}`} icon="check" onPress={logSet} />
                )}
              </View>
              <IconButton icon="next" label="Next exercise" onPress={() => go(i + 1)} />
            </View>
            {editing !== null && <Button size="sm" variant="ghost" label="Cancel edit" onPress={() => setEditing(null)} />}
          </View>
        </Animated.View>
      </GestureDetector>

      {restEnd && (
        <RestTimer
          endsAt={restEnd}
          total={restTotal}
          tint={color.accent}
          nextLabel={next || !exDone ? (exDone && next ? EXERCISES[next.exerciseId].name : `Set ${Math.min(cur + 1, plan.sets)} · ${setText(suggestSet(state, id, plan, date, cur).set, kind, unit, state.gym)}`) : 'Finish'}
          skipLabel="Skip"
          sound={state.restSound}
          onAdd={() => {
            setRestEnd((e) => (e ?? Date.now()) + 15000);
            setRestTotal((t) => t + 15);
          }}
          onSkip={() => setRestEnd(null)}
          onDone={() => setRestEnd(null)}
        />
      )}
      {/* The PR moment draws above the rest timer that opens with it. */}
      <Flash fire={flash} />
      <Burst burst={flash} x={width / 2} y={300} colors={[color.accent, color.accentPressed, color.text]} count={28} />
      {pr && (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(motion.fast)} exiting={reduce ? undefined : FadeOut.duration(motion.base)} style={[s.pr, { top: insets.top + 72 }]} pointerEvents="none">
          <Icon name="trophy" size={18} color={color.accent} filled />
          <Text style={s.prText} accessibilityLiveRegion="polite">
            New PR · {pr}
          </Text>
        </Animated.View>
      )}

    </Backdrop>
  );
}

/** −/+ pair for weight, pin, reps or seconds. 56dp targets for sweaty thumbs. */
function Stepper({ label, name, onMinus, onPlus }: { label: string; name: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={s.stepper}>
      <Press onPress={onMinus} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`Less ${name}`}>
        <Icon name="minus" size={20} color={color.text} />
      </Press>
      <Text style={s.stepLabel}>{label}</Text>
      <Press onPress={onPlus} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`More ${name}`}>
        <Icon name="plus" size={20} color={color.text} />
      </Press>
    </View>
  );
}

/** A finished set: long-press to edit, swipe left to delete (also as screen-reader actions). */
function DoneRow({ n, text, editing, onEdit, onDelete }: { n: number; text: string; editing: boolean; onEdit: () => void; onDelete: () => void }) {
  const dx = useSharedValue(0);
  const pan = usePanGesture({
    activeOffsetX: [-14, 1000],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      dx.set(Math.min(0, e.translationX));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX < -110 || e.velocityX < -900) {
        dx.set(withTiming(-500, { duration: 160 }));
        scheduleOnRN(onDelete);
      } else dx.set(withSpring(0, motion.spring));
    },
  });
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }] }));
  const del = useAnimatedStyle(() => ({ opacity: interpolate(dx.value, [-110, -20], [1, 0], 'clamp') }));
  return (
    <View style={s.rowWrap}>
      <Animated.View style={[s.rowDelete, del]} pointerEvents="none">
        <Icon name="trash" size={18} color={color.warn} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={st}>
          <Press
            onLongPress={onEdit}
            delayLongPress={350}
            style={[s.row, editing && s.rowEditing]}
            accessibilityRole="button"
            accessibilityLabel={`Set ${n}, ${text}. Long press to edit, swipe left to delete`}
            accessibilityActions={[
              { name: 'edit', label: 'Edit set' },
              { name: 'delete', label: 'Delete set' },
            ]}
            onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'edit' ? onEdit() : onDelete())}
            testID={`focus-set-${n}`}
          >
            <Text style={s.rowN}>{n}</Text>
            <Text style={s.rowText} numberOfLines={1}>
              {text}
            </Text>
            <Icon name="check" size={16} color={color.accent} />
          </Press>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  dots: { flexDirection: 'row', gap: space.xs, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.surface3 },
  dotDone: { backgroundColor: color.muted },
  dotOn: { width: 18, backgroundColor: color.accent },
  page: { flex: 1, paddingHorizontal: space.xl },
  titleRow: { marginTop: space.xl, gap: space.xs, alignItems: 'center' },
  exName: { fontFamily: font.display, fontSize: size.title, lineHeight: leading.title, color: color.text, textAlign: 'center', letterSpacing: -0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 220, paddingBottom: space.lg },
  // 'lighten' drops the render's near-black ground into the scene, so only the lit figure shows.
  figure: { flex: 1, width: '100%', maxHeight: 300, minHeight: 120, opacity: 0.75, marginBottom: -space.xl, mixBlendMode: 'lighten' },
  figureImg: { width: '100%', height: '100%' },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm, maxWidth: '100%' },
  big: { fontFamily: font.display, fontSize: size.giga, lineHeight: leading.giga + 8, color: color.text, fontVariant: ['tabular-nums'], letterSpacing: -1.5 },
  bigUnit: { fontFamily: font.displayBold, fontSize: size.h2, color: color.muted },
  reps: { fontFamily: font.displayBold, fontSize: size.title, color: color.text, marginTop: space.xxs },
  why: { marginTop: space.sm, fontFamily: font.bodySemi, fontSize: size.small, color: color.accentText, textAlign: 'center' },
  doneList: { gap: space.xs, marginBottom: space.md },
  rowWrap: { justifyContent: 'center' },
  rowDelete: { position: 'absolute', right: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.min,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  rowEditing: { borderColor: color.accentEdge },
  rowN: { fontFamily: font.bodyBold, fontSize: size.small, color: color.subtle, width: 16 },
  rowText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.small, color: color.text },
  bottom: { paddingHorizontal: space.lg, gap: space.md },
  adjust: { flexDirection: 'row', gap: space.md },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.glassBorder,
    padding: space.xxs,
  },
  stepBtn: { width: touch.primary, height: touch.primary, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: font.bodyBold, fontSize: size.small, color: color.muted, letterSpacing: 0.4 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  pr: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.accentEdge,
    backgroundColor: 'rgba(7,7,8,0.9)',
  },
  prText: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.accentText, letterSpacing: 0.3 },
});
