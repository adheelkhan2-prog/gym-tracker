import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeInDown,
  SlideInRight,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BodyModel, type PaintMap, type PulseMap } from '../components/body/BodyModel';
import { Backdrop, Glass } from '../components/glass';
import { Icon } from '../components/icons';
import { Burst, CountUp, Flash } from '../components/motion';
import { Badge, Button, StatusBarShade } from '../components/ui';
import { FINISH, FINISH_PR, line } from '../copy';
import { EXERCISES } from '../data/exercises';
import { MUSCLE_LABEL, type MuscleId } from '../data/muscles';
import { haptic } from '../feedback';
import { fmtKg, fromKg, round1 } from '../load';
import { bestBefore, dayById, doneSets, formatDate, prSetsOn, todayKey, trainingStreak, useStore } from '../store';
import { titleOf } from '../workout';
import { color, font, leading, motion, radius, size, space, themed, type } from '../theme';
import { pctChange, pinSetsOn, pinSetsText, previousSameDay, volumeOn } from '../totals';

/** Muscles seen from behind (the model faces them at yaw π). */
const BACK = new Set<MuscleId>(['posterior_delt', 'rotator_cuff', 'triceps_long', 'triceps_lateral', 'triceps_medial', 'upper_lats', 'lower_lats', 'teres_major', 'rhomboids', 'upper_traps', 'mid_traps', 'lower_traps', 'erector_spinae', 'neck_extensors', 'forearm_extensors', 'glute_max', 'glute_med', 'medial_hamstrings', 'lateral_hamstrings', 'gastrocnemius', 'soleus']);

/** Leg and hip muscles: a day that works them shows the whole body. */
const LEGS = new Set<MuscleId>(['glute_max', 'glute_med', 'hip_rotators', 'hip_flexors', 'adductors', 'rectus_femoris', 'vastus_group', 'medial_hamstrings', 'lateral_hamstrings', 'gastrocnemius', 'soleus', 'tibialis_anterior']);

// Choreography (ms after open). One tap anywhere jumps to the end.
const T = { muscles: 900, perMuscle: 170, afterMuscles: 250, stats: 650, prGap: 650 };

export default function CompleteScreen() {
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam ?? todayKey();
  const { state } = useStore();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();

  const data = useMemo(() => {
    const session = state.sessions[date];
    const dayId = session?.dayId ?? '';
    // Muscles trained, most sets first (primary 1, secondary 0.5).
    const load: Partial<Record<MuscleId, number>> = {};
    let sets = 0;
    for (const [id, log] of Object.entries(state.logs[date] ?? {})) {
      const ex = EXERCISES[id];
      if (!ex) continue;
      const n = doneSets(log, ex.kind).length;
      sets += n;
      if (!n) continue;
      for (const m of ex.primary) load[m] = (load[m] ?? 0) + n;
      for (const m of ex.secondary) load[m] = (load[m] ?? 0) + n * 0.5;
    }
    const muscles = (Object.entries(load) as [MuscleId, number][])
      .sort((a, b) => b[1] - a[1]);
    // Volume is summed in kg, shown in your unit.
    const volume = Math.round(fromKg(volumeOn(state, date), state.unit));
    const prevDate = dayId ? previousSameDay(state, date, dayId) : null;
    // No kg logged (e.g. machine pins without kg per plate): nothing to compare, so no "-100%".
    const change = prevDate && volume > 0 ? pctChange(volume, Math.round(fromKg(volumeOn(state, prevDate), state.unit))) : null;
    // Logs can hold exercises this version no longer knows (kept on update): skip those here.
    const prs = prSetsOn(state.logs, date).filter((p) => EXERCISES[p.exerciseId]).map((p) => {
      const kind = EXERCISES[p.exerciseId].kind;
      const before = bestBefore(state.logs, p.exerciseId, date);
      if (kind === 'reps' || kind === 'time') {
        const u = kind === 'reps' ? 'reps' : 's';
        return { name: EXERCISES[p.exerciseId].name, value: `${p.value} ${u}`, delta: `+${p.value - before} ${u} vs last best` };
      }
      return {
        name: EXERCISES[p.exerciseId].name,
        value: fmtKg(p.value, state.unit),
        delta: `+${round1(fromKg(p.value - before, state.unit))} ${state.unit} vs last best`,
      };
    });
    const mins = session?.startedAt && session.finishedAt ? Math.max(1, Math.round((session.finishedAt - session.startedAt) / 60000)) : null;
    // Machine-pin sets are never kg: shown next to the volume, not added to it.
    const pinSets = pinSetsOn(state, date);
    return { dayId, muscles, sets, volume, change, prevDate, prs, mins, pinSets };
  }, [state, date]);

  // ---------- Timeline ----------
  // One clock drives the whole sequence; haptics, flashes and bursts fire from its tick.
  const [t0] = useState(() => Date.now());
  const [t, setT] = useState(reduce ? Infinity : 0);
  const skipped = t === Infinity;
  const tStats = T.muscles + data.muscles.length * T.perMuscle + T.afterMuscles;
  const tPrs = tStats + T.stats + 500;
  const tActions = tPrs + data.prs.length * T.prGap + 200;
  const tEnd = tActions + 600;
  const litAt = (e: number) => Math.max(0, Math.min(data.muscles.length, Math.floor((e - T.muscles) / T.perMuscle) + 1));
  const prAt = (e: number) => Math.max(0, Math.min(data.prs.length, Math.floor((e - tPrs) / T.prGap) + 1));
  const [flash, setFlash] = useState(0);
  const [burst, setBurst] = useState(0);
  const [burstAt, setBurstAt] = useState({ x: 0, y: 0 });
  type Node = React.ComponentRef<typeof View>;
  const rootRef = useRef<Node>(null);
  const prIconRefs = useRef<(Node | null)[]>([]);
  /** Centre of `node` in the screen root's coordinates. */
  const centreOf = (node: Node | null | undefined, done: (p: { x: number; y: number }) => void) => {
    const root = rootRef.current;
    if (!node || !root) return;
    root.measureInWindow((rx: number, ry: number) =>
      node.measureInWindow((x: number, y: number, w: number, h: number) => done({ x: x - rx + w / 2, y: y - ry + h / 2 })),
    );
  };
  const seen = useRef({ lit: 0, prs: 0 });
  useEffect(() => {
    if (skipped) return;
    const iv = setInterval(() => {
      const e = Date.now() - t0;
      const lit = litAt(e);
      if (lit > seen.current.lit) {
        seen.current.lit = lit;
        haptic.tap();
      }
      const p = prAt(e);
      if (p > seen.current.prs) {
        seen.current.prs = p;
        haptic.thump();
        setFlash((f) => f + 1);
        // The new row renders on this tick; measure its trophy on the next frame.
        requestAnimationFrame(() =>
          centreOf(prIconRefs.current[p - 1], (at) => {
            setBurstAt(at);
            setBurst((b) => b + 1);
          }),
        );
      }
      setT(e >= tEnd ? Infinity : e);
    }, 80);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipped]);

  // Muscles light up one by one; each gets a glow pulse at its own start time.
  const lit = skipped ? data.muscles.length : litAt(t);
  const pulses: PulseMap = useMemo(() => {
    const p: PulseMap = {};
    data.muscles.forEach(([m], i) => {
      p[m] = t0 + T.muscles + i * T.perMuscle;
    });
    return p;
  }, [data.muscles, t0]);
  const paint: PaintMap = useMemo(() => {
    const p: PaintMap = {};
    data.muscles.slice(0, lit).forEach(([m], i) => {
      p[m] = { color: i < Math.ceil(data.muscles.length * 0.4) ? color.musclePrimary : color.muscleSecondary, glow: 0.2 };
    });
    return p;
  }, [lit, data.muscles]);

  const prShown = skipped ? data.prs.length : prAt(t);

  const arrow = useSharedValue(0);
  useEffect(() => {
    if (t >= tStats && data.change !== null) arrow.set(skipped ? 1 : withDelay(500, withSpring(1, motion.pop)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t >= tStats]);
  const up = (data.change ?? 0) >= 0;
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrow.value,
    transform: [{ translateY: (1 - arrow.value) * (up ? 14 : -14) }, { scale: 0.6 + arrow.value * 0.4 }],
  }));

  // The 3D model starts after the screen transition, so the new GL context never competes with
  // the navigation animation (and the previous screen's teardown) for the GPU.
  const [show3d, setShow3d] = useState(false);
  useEffect(() => {
    // The screen's fade-in transition takes ~300 ms (see _layout.tsx).
    const t = setTimeout(() => setShow3d(true), 350);
    return () => clearTimeout(t);
  }, []);
  const trained = useMemo(() => new Set(data.muscles.map(([m]) => m)), [data.muscles]);
  // Face the side that did most of the work: the back for a back day, else the front.
  const startYaw = useMemo(() => {
    let back = 0;
    let front = 0;
    for (const [m, n] of data.muscles) {
      if (BACK.has(m)) back += n;
      else front += n;
    }
    return back > front ? Math.PI : 0;
  }, [data.muscles]);
  // The upper body, unless legs did a real share of the work (then the whole body).
  const framing = useMemo(() => {
    const total = data.muscles.reduce((n, [, x]) => n + x, 0);
    const legs = data.muscles.filter(([m]) => LEGS.has(m)).reduce((n, [, x]) => n + x, 0);
    return total > 0 && legs / total > 0.3 ? 'full' : 'upperBody';
  }, [data.muscles]);
  const describe = useCallback((m: MuscleId) => `${MUSCLE_LABEL[m]}${trained.has(m) ? ' · trained today' : ''}`, [trained]);

  const copy = line(data.prs.length ? FINISH_PR : FINISH, date + data.sets);
  const enter = (delay: number) => (reduce || skipped ? undefined : FadeInDown.delay(delay).springify().damping(15));

  return (
    <Backdrop intensity={1.5}>
      <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
      <ScrollView
        onTouchStart={() => !skipped && setT(Infinity)}
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.x5 }}
      >
        <View style={s.pad}>
          <View style={s.topRow}>
            <Badge label={`${(dayById(state, data.dayId) ? titleOf(dayById(state, data.dayId)!) : 'Workout')} · done`} icon="check" />
            {!skipped && <Text style={s.skipHint}>Tap to skip</Text>}
          </View>
        </View>

        {/* Hero: the body you just trained */}
        <View style={{ marginTop: space.sm }}>
          {show3d ? (
            <BodyModel paint={paint} pulses={pulses} height={420} framing={framing} startYaw={startYaw} intro tint={color.accent} describe={describe} showHint={false} />
          ) : (
            <View style={{ height: 420 }} />
          )}
        </View>
        {lit > 0 && (
          <View style={[s.pad, s.muscleRow]}>
            {data.muscles.slice(0, Math.min(lit, 6)).map(([m], i) => (
              <Animated.View key={m} entering={reduce || skipped ? undefined : ZoomIn.springify().damping(12)}>
                <View style={[s.mChip, i < Math.ceil(data.muscles.length * 0.4) && s.mChipHot]}>
                  <Text style={s.mChipText}>{MUSCLE_LABEL[m]}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {t >= tStats && (
          <View style={s.pad}>
            {/* One huge number, not a grid of tiles */}
            <Animated.View entering={enter(0)}>
              {/* Machine pins without kg per plate have no kg: show the sets instead of "0 kg". */}
              <Text style={s.kicker}>{data.volume > 0 ? 'Total volume' : 'Sets done'}</Text>
              <View style={s.megaRow}>
                <CountUp to={data.volume > 0 ? data.volume : data.sets} duration={1100} style={[s.mega, { fontSize: data.volume >= 100000 ? size.numXL : width < 380 ? size.mega : size.giga }]} skip={skipped} />
                <Text style={s.megaUnit}>{data.volume > 0 ? state.unit : 'sets'}</Text>
              </View>
              {data.volume > 0 && data.pinSets > 0 && (
                <Text style={s.pinNote} testID="complete-pin-sets">
                  {pinSetsText(data.pinSets)} by machine pin (not in the kg total)
                </Text>
              )}
              {data.change !== null && (
                <View style={s.changeRow}>
                  <Animated.View style={[s.arrow, { backgroundColor: up ? color.accent : color.surface3 }, arrowStyle]}>
                    <Icon name={up ? 'arrowUp' : 'arrowDown'} size={18} color={color.onAccent} />
                  </Animated.View>
                  <Text style={s.changeText}>
                    <Text style={{ color: up ? color.accent : color.muted }}>
                      {up ? '+' : ''}
                      {data.change}%
                    </Text>{' '}
                    vs last {(dayById(state, data.dayId) ? titleOf(dayById(state, data.dayId)!) : 'session')} ({formatDate(data.prevDate!)})
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Asymmetric stats: one big, two small */}
            <View style={s.statRow}>
              <Animated.View entering={enter(motion.stagger)} style={{ flex: 1.3 }}>
                <Glass r={radius.xl} style={s.statBig}>
                  <CountUp to={data.sets} style={s.statBigNum} delay={150} skip={skipped} />
                  <Text style={type.label}>sets crushed</Text>
                </Glass>
              </Animated.View>
              <View style={{ flex: 1, gap: space.sm }}>
                <Animated.View entering={enter(motion.stagger * 2)}>
                  <Glass r={radius.lg} style={s.statSmall}>
                    <Icon name="clock" size={18} color={color.accent} />
                    <Text style={s.statSmallNum}>{data.mins ? `${data.mins} min` : '—'}</Text>
                  </Glass>
                </Animated.View>
                <Animated.View entering={enter(motion.stagger * 3)}>
                  <Glass r={radius.lg} style={s.statSmall}>
                    <Icon name="flame" size={18} color={color.accent} filled />
                    <Text style={s.statSmallNum}>{trainingStreak(state, date)} day streak</Text>
                  </Glass>
                </Animated.View>
              </View>
            </View>
          </View>
        )}

        {data.prs.length > 0 && prShown > 0 && (
          <View style={[s.pad, { marginTop: space.xxl, gap: space.sm }]}>
            <Text style={type.h2}>New records</Text>
            {data.prs.slice(0, prShown).map((p) => (
              <Animated.View key={p.name} entering={reduce || skipped ? undefined : SlideInRight.springify().damping(14)}>
                <Glass r={radius.xl} style={s.prRow}>
                  <View
                    style={s.prIcon}
                    collapsable={false}
                    ref={(v) => {
                      prIconRefs.current[data.prs.indexOf(p)] = v;
                    }}
                  >
                    <Icon name="trophy" size={24} color={color.onAccent} filled />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={s.prDelta}>{p.delta}</Text>
                  </View>
                  <Text style={s.prValue}>{p.value}</Text>
                </Glass>
              </Animated.View>
            ))}
          </View>
        )}

        {(skipped || t >= tActions) && (
          <Animated.View entering={enter(300)} style={[s.pad, { marginTop: space.xxl }]}>
            <Text style={s.copy}>{copy}</Text>
            <Button size="lg" variant="solid" label="Done" onPress={() => router.dismissTo('/')} testID="complete-done" />
          </Animated.View>
        )}
      </ScrollView>
      <StatusBarShade />

      <Flash fire={flash} />
      <Burst burst={burst} x={burstAt.x} y={burstAt.y} colors={[color.accent, color.accentPressed, color.text]} />
      </View>
    </Backdrop>
  );
}

const s = themed(() => StyleSheet.create({
  pad: { paddingHorizontal: space.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipHint: { fontFamily: font.bodySemi, fontSize: size.label, color: color.subtle },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: -space.x3 },
  mChip: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, backgroundColor: color.glassSolid, borderWidth: 1, borderColor: color.glassBorder },
  mChipHot: { borderColor: color.musclePrimary },
  mChipText: { fontFamily: font.bodyBold, fontSize: size.label, color: color.text },
  kicker: { ...type.label, color: color.accentText, marginTop: space.xxl },
  megaRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  mega: { fontFamily: font.display, lineHeight: leading.giga, letterSpacing: -4, color: color.keyNum, fontVariant: ['tabular-nums'] },
  megaUnit: { fontFamily: font.display, fontSize: size.h2, color: color.muted },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  arrow: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  changeText: { flex: 1, fontFamily: font.bodyBold, fontSize: size.body, color: color.text },
  statRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xxl },
  statBig: { padding: space.xl, justifyContent: 'flex-end', minHeight: 140 },
  statBigNum: { fontFamily: font.display, fontSize: size.numXL, lineHeight: leading.numXL, color: color.accent, fontVariant: ['tabular-nums'] },
  statSmall: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg, minHeight: 66 },
  statSmallNum: { fontFamily: font.display, fontSize: size.h3, color: color.text, flexShrink: 1 },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderColor: color.accentEdge },
  prIcon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  prDelta: { fontFamily: font.bodyBold, fontSize: size.small, color: color.accentText },
  prValue: { fontFamily: font.display, fontSize: size.h2, color: color.text },
  copy: { fontFamily: font.display, fontSize: size.h2, lineHeight: leading.h2, color: color.text, marginBottom: space.lg },
  pinNote: { fontFamily: font.bodySemi, fontSize: size.small, color: color.muted, marginTop: space.xs },
}));

// One bad screen shows a recovery panel for that screen only; it never takes the app down.
export { RouteError as ErrorBoundary } from '../components/RouteError';
