import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { BodyModel, type PaintMap, type PulseMap, type Snapshot } from '../components/body/BodyModel';
import { Backdrop, Glass } from '../components/glass';
import { Icon } from '../components/icons';
import { Burst, CountUp, Flash } from '../components/motion';
import { ShareSheet } from '../components/ShareSheet';
import { Badge, Button, Progress } from '../components/ui';
import { FINISH, FINISH_PR, line } from '../copy';
import { EXERCISES } from '../data/exercises';
import { INJURY_REGIONS, MUSCLE_LABEL, type MuscleId } from '../data/muscles';
import { haptic } from '../feedback';
import { fmtKg, fromKg, round1 } from '../load';
import { bestBefore, dayById, doneSets, formatDate, prSetsOn, todayKey, trainingStreak, useStore } from '../store';
import { titleOf } from '../workout';
import { color, font, leading, motion, radius, size, space, type } from '../theme';
import { levelFor, pctChange, previousSameDay, rankFor, totalXp, volumeOn, xpOn } from '../xp';

// Choreography (ms after open). One tap anywhere jumps to the end.
const T = { muscles: 900, perMuscle: 170, afterMuscles: 250, stats: 650, prGap: 650 };

export default function CompleteScreen() {
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam ?? todayKey();
  const { state } = useStore();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const snapshotRef = useRef<Snapshot | null>(null);

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
      .filter(([m]) => !(state.injured && INJURY_REGIONS.has(m)))
      .sort((a, b) => b[1] - a[1]);
    // Volume is summed in kg, shown in your unit.
    const volume = Math.round(fromKg(volumeOn(state, date), state.unit));
    const prevDate = dayId ? previousSameDay(state, date, dayId) : null;
    const change = prevDate ? pctChange(volume, Math.round(fromKg(volumeOn(state, prevDate), state.unit))) : null;
    const prs = prSetsOn(state.logs, date).map((p) => {
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
    const xpNow = totalXp(state);
    const earned = xpOn(state, date).total;
    return { dayId, muscles, sets, volume, change, prevDate, prs, mins, xpNow, xpBefore: xpNow - earned, earned };
  }, [state, date]);

  const before = levelFor(data.xpBefore);
  const after = levelFor(data.xpNow);
  const levelUp = after.level > before.level;
  const rankBefore = rankFor(before.level);
  const rankAfter = rankFor(after.level);

  // ---------- Timeline ----------
  // One clock drives the whole sequence; haptics, flashes and bursts fire from its tick.
  const [t0] = useState(() => Date.now());
  const [t, setT] = useState(reduce ? Infinity : 0);
  const skipped = t === Infinity;
  const tStats = T.muscles + data.muscles.length * T.perMuscle + T.afterMuscles;
  const tPrs = tStats + T.stats + 500;
  const tXp = tPrs + data.prs.length * T.prGap + 200;
  const tLevel = tXp + 900;
  const tEnd = tLevel + 900;
  const litAt = (e: number) => Math.max(0, Math.min(data.muscles.length, Math.floor((e - T.muscles) / T.perMuscle) + 1));
  const prAt = (e: number) => Math.max(0, Math.min(data.prs.length, Math.floor((e - tPrs) / T.prGap) + 1));
  const [flash, setFlash] = useState(0);
  const [burst, setBurst] = useState(0);
  const [burstAt, setBurstAt] = useState({ x: 0, y: 0 });
  const [lvlAt, setLvlAt] = useState({ x: 0, y: 0 });
  type Node = React.ComponentRef<typeof View>;
  const rootRef = useRef<Node>(null);
  const prIconRefs = useRef<(Node | null)[]>([]);
  const levelRef = useRef<Node>(null);
  /** Centre of `node` in the screen root's coordinates. */
  const centreOf = (node: Node | null | undefined, done: (p: { x: number; y: number }) => void) => {
    const root = rootRef.current;
    if (!node || !root) return;
    root.measureInWindow((rx: number, ry: number) =>
      node.measureInWindow((x: number, y: number, w: number, h: number) => done({ x: x - rx + w / 2, y: y - ry + h / 2 })),
    );
  };
  const [lvlBurst, setLvlBurst] = useState(0);
  const seen = useRef({ lit: 0, prs: 0, level: false });
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
      if (levelUp && e >= tLevel && !seen.current.level) {
        seen.current.level = true;
        haptic.pr();
        requestAnimationFrame(() =>
          centreOf(levelRef.current, (at) => {
            setLvlAt(at);
            setLvlBurst(1);
          }),
        );
      }
      setT(e >= tEnd ? Infinity : e);
    }, 40);
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
    if (state.injured) for (const m of INJURY_REGIONS) p[m] = { color: color.muscleInjured };
    return p;
  }, [lit, data.muscles, state.injured]);

  const prShown = skipped ? data.prs.length : prAt(t);
  const showXp = t >= tXp;

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

  const [share, setShare] = useState<{ img: string | null } | null>(null);
  const openShare = async () => {
    const img = (await snapshotRef.current?.().catch(() => null)) ?? null;
    setShare({ img });
  };

  const copy = line(data.prs.length ? FINISH_PR : FINISH, date + data.sets);
  const xpPctBefore = levelUp ? 0 : before.progress * 100;
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
          <BodyModel
            paint={paint}
            pulses={pulses}
            height={380}
            framing="torso"
            intro
            tint={color.accent}
            snapshotRef={snapshotRef}
            describe={(m) => `${MUSCLE_LABEL[m]}${data.muscles.some(([x]) => x === m) ? ' · trained today' : ''}`}
            showHint={false}
          />
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
              <Text style={s.kicker}>Total volume</Text>
              <View style={s.megaRow}>
                <CountUp to={data.volume} duration={1100} style={[s.mega, { fontSize: data.volume >= 100000 ? size.numXL : width < 380 ? size.mega : size.giga }]} skip={skipped} />
                <Text style={s.megaUnit}>{state.unit}</Text>
              </View>
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

        {showXp && (
          <Animated.View entering={enter(0)} style={[s.pad, { marginTop: space.xxl }]}>
            <Glass strong r={radius.xxl} style={s.xpCard} glow={levelUp ? color.accent : undefined}>
              <View style={s.xpTop}>
                <View>
                  <Text style={type.label}>XP earned</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
                    <Text style={s.xpPlus}>+</Text>
                    <CountUp to={data.earned} style={s.xpNum} skip={skipped} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.rankName}>{rankAfter.name}</Text>
                  <Text style={type.small}>Level {after.level}</Text>
                </View>
              </View>
              <View style={{ marginTop: space.md }}>
                <XpFill from={xpPctBefore} to={after.progress * 100} skip={skipped} />
              </View>
              <Text style={[type.small, { marginTop: space.sm }]}>
                {after.next - data.xpNow} XP to level {after.level + 1}
              </Text>
              {levelUp && (skipped || lvlBurst > 0) && (
                <Animated.View ref={levelRef} collapsable={false} entering={reduce || skipped ? undefined : ZoomIn.springify().damping(10)} style={s.levelUp}>
                  <Icon name="star" size={22} color={color.onAccent} filled />
                  <Text style={s.levelUpText}>
                    LEVEL UP · {rankBefore.name !== rankAfter.name ? `${rankBefore.name} → ${rankAfter.name}` : `Level ${after.level}`}
                  </Text>
                </Animated.View>
              )}
            </Glass>
          </Animated.View>
        )}

        {(skipped || t >= tXp) && (
          <Animated.View entering={enter(300)} style={[s.pad, { marginTop: space.xxl }]}>
            <Text style={s.copy}>{copy}</Text>
            <View style={s.actions}>
              <View style={{ flex: 1 }}>
                <Button size="lg" icon="share" label="Share" onPress={openShare} />
              </View>
              <Button size="lg" variant="secondary" label="Done" onPress={() => router.dismissTo('/')} />
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <Flash fire={flash} />
      <Burst burst={burst} x={burstAt.x} y={burstAt.y} colors={[color.accent, color.accentSoft, color.text]} />
      <Burst burst={lvlBurst} x={lvlAt.x} y={lvlAt.y} count={48} power={1.2} colors={[color.accent, color.accentSoft, color.text, color.flash]} />
      {share && (
        <ShareSheet
          onClose={() => setShare(null)}
          data={{
            title: (dayById(state, data.dayId) ? titleOf(dayById(state, data.dayId)!) : 'Workout'),
            date: formatDate(date),
            volume: data.volume.toLocaleString(),
            unit: state.unit,
            sets: data.sets,
            minutes: data.mins,
            prs: data.prs.map((p) => ({ name: p.name, value: p.value })),
            rank: rankAfter.name,
            level: after.level,
            bodyImage: share.img,
          }}
        />
      )}
      </View>
    </Backdrop>
  );
}

/** XP bar: fills from `from`% to `to`% (and from 0 again after a level up). */
function XpFill({ from, to, skip }: { from: number; to: number; skip: boolean }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const tm = setTimeout(() => setFilled(true), 250);
    return () => clearTimeout(tm);
  }, []);
  return <Progress value={skip || filled ? to : from} height={14} />;
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: space.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipHint: { fontFamily: font.bodySemi, fontSize: size.label, color: color.subtle },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: -space.x3 },
  mChip: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, backgroundColor: color.glassSolid, borderWidth: 1, borderColor: color.glassBorder },
  mChipHot: { borderColor: color.musclePrimary },
  mChipText: { fontFamily: font.bodyBold, fontSize: size.label, color: color.text },
  kicker: { ...type.label, color: color.accentText, marginTop: space.xxl },
  megaRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  mega: { fontFamily: font.display, lineHeight: leading.giga, letterSpacing: -4, color: color.text, fontVariant: ['tabular-nums'] },
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
  prDelta: { fontFamily: font.bodyBold, fontSize: size.small, color: color.accentSoft },
  prValue: { fontFamily: font.display, fontSize: size.h2, color: color.text },
  xpCard: { padding: space.xl },
  xpTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  xpPlus: { fontFamily: font.display, fontSize: size.title, color: color.accent },
  xpNum: { fontFamily: font.display, fontSize: size.numXL, lineHeight: leading.numXL, color: color.accent, fontVariant: ['tabular-nums'] },
  rankName: { fontFamily: font.display, fontSize: size.title, color: color.text },
  levelUp: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    backgroundColor: color.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  levelUpText: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.onAccent, letterSpacing: 0.6 },
  copy: { fontFamily: font.display, fontSize: size.h2, lineHeight: leading.h2, color: color.text, marginBottom: space.lg },
  actions: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
