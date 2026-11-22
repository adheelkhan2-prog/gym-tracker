import { useIsFocused } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { BodyModel, type PaintMap } from '../../components/body/BodyModel';
import { Glass } from '../../components/glass';
import { Icon } from '../../components/icons';
import { LineChart } from '../../components/LineChart';
import { CountUp } from '../../components/motion';
import { Chip, Progress, Screen, SectionTitle } from '../../components/ui';
import { EXERCISES } from '../../data/exercises';
import { INJURY_REGIONS, MUSCLE_LABEL, type MuscleId } from '../../data/muscles';
import { ALL_EXERCISE_IDS } from '../../data/program';
import { addDays, exerciseHistory, formatDate, todayKey, useStore, weekKeys, weeklyMuscleSets, weekSummary } from '../../store';
import { color, font, heat, leading, motion, radius, size, space, type } from '../../theme';
import { RANKS, levelFor, pctChange, rankFor, totalXp, volumeOn } from '../../xp';

type Metric = 'top' | 'e1rm';

const heatColor = (n: number) => {
  let c: string | null = null;
  heat.thresholds.forEach((t, i) => {
    if (n >= t) c = heat.steps[i];
  });
  return c;
};

export default function ProgressScreen() {
  const { state } = useStore();
  const focused = useIsFocused();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const unit = state.unit;
  const today = todayKey();
  const week = weekSummary(state);
  const thisWeek = weekKeys(today);
  const lastWeek = weekKeys(addDays(today, -7));
  const vol = thisWeek.reduce((n, d) => n + volumeOn(state, d), 0);
  const volLast = lastWeek.reduce((n, d) => n + volumeOn(state, d), 0);
  const change = pctChange(vol, volLast);
  const lvl = levelFor(totalXp(state));
  const rank = rankFor(lvl.level);

  // ----- Muscle heat map -----
  const muscleSets = useMemo(() => weeklyMuscleSets(state), [state]);
  const paint: PaintMap = useMemo(() => {
    const p: PaintMap = {};
    for (const [m, n] of Object.entries(muscleSets) as [MuscleId, number][]) {
      const c = heatColor(n);
      if (c) p[m] = { color: c, glow: n >= heat.thresholds[3] ? 0.25 : 0.05 };
    }
    if (state.injured) for (const m of INJURY_REGIONS) p[m] = { color: color.muscleInjured };
    return p;
  }, [muscleSets, state.injured]);
  const topMuscles = (Object.entries(muscleSets) as [MuscleId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // ----- Exercise charts -----
  const histories = useMemo(() => Object.fromEntries(ALL_EXERCISE_IDS.map((id) => [id, exerciseHistory(state.logs, id)])), [state.logs]);
  const withData = ALL_EXERCISE_IDS.filter((id) => histories[id].length > 0);
  const [picked, setPicked] = useState<string | null>(null);
  const id = picked && withData.includes(picked) ? picked : withData[0];
  const [metric, setMetric] = useState<Metric>('top');
  const kind = id ? EXERCISES[id].kind : 'weight_reps';
  const hist = id ? histories[id] : [];
  const showE1rm = metric === 'e1rm' && kind === 'weight_reps';
  const valueUnit = kind === 'reps' ? 'reps' : unit;
  const points = hist.map((h) => ({
    label: formatDate(h.date),
    value: Math.round(showE1rm ? h.e1rm : h.top),
    detail: kind === 'reps' ? `${h.topReps} reps` : `${h.top} ${unit} × ${h.topReps}${kind === 'weight_time' ? ' s' : ''}`,
  }));
  const best = hist.length ? Math.max(...hist.map((h) => h.top)) : 0;
  const delta = hist.length > 1 ? hist[hist.length - 1].top - hist[0].top : 0;
  const enter = (i: number) => (reduce ? undefined : FadeInDown.delay(i * motion.stagger).springify().damping(16));
  const up = (change ?? 0) >= 0;

  return (
    <Screen padBottom={140}>
      {/* Hero: one huge number */}
      <Animated.View entering={enter(0)}>
        <Text style={s.kicker}>Volume this week</Text>
        <View style={s.megaRow}>
          <CountUp to={vol} style={[s.mega, { fontSize: vol >= 100000 ? size.numXL : width < 380 ? size.mega : size.giga }]} />
          <Text style={s.megaUnit}>{unit}</Text>
        </View>
        {change !== null && (
          <View style={s.changeRow}>
            <View style={[s.arrow, { backgroundColor: up ? color.lime : color.pink }]}>
              <Icon name={up ? 'arrowUp' : 'arrowDown'} size={16} color={color.ink} />
            </View>
            <Text style={s.changeText}>
              <Text style={{ color: up ? color.lime : color.pink }}>
                {up ? '+' : ''}
                {change}%
              </Text>{' '}
              vs last week
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Rank card overlaps the hero's edge */}
      <Animated.View entering={enter(1)} style={s.rankWrap}>
        <Glass strong r={radius.xxl} style={s.rankCard} glow={color.lime}>
          <View style={s.rankTop}>
            <View>
              <Text style={type.label}>Rank</Text>
              <Text style={s.rankName}>{rank.name}</Text>
            </View>
            <View style={s.levelBubble}>
              <Text style={s.levelText}>L{lvl.level}</Text>
            </View>
          </View>
          <View style={{ marginTop: space.md }}>
            <Progress value={lvl.progress * 100} height={12} />
          </View>
          <Text style={[type.small, { marginTop: space.sm }]}>
            {lvl.into} / {lvl.span} XP · {lvl.next - lvl.floor - lvl.into} to level {lvl.level + 1}
          </Text>
          <View style={s.ladder}>
            {RANKS.map((r) => {
              const on = r.name === rank.name;
              const past = lvl.level >= r.from;
              return (
                <View key={r.name} style={[s.rung, past && s.rungPast, on && s.rungOn]}>
                  <Text style={[s.rungText, (past || on) && { color: on ? color.ink : color.lime }]}>{r.name}</Text>
                </View>
              );
            })}
          </View>
        </Glass>
      </Animated.View>

      {/* Week ticker: no equal tiles */}
      <Animated.View entering={enter(2)} style={s.ticker}>
        <Text style={s.tick}>
          <Text style={s.tickNum}>{Math.min(week.trained, week.planned)}</Text>/{week.planned} days
          {week.trained > week.planned ? ` +${week.trained - week.planned} bonus` : ''}
        </Text>
        <View style={s.tickDot} />
        <Text style={s.tick}>
          <Text style={[s.tickNum, { color: color.pink }]}>{week.prs}</Text> PRs
        </Text>
        <View style={s.tickDot} />
        <Text style={s.tick}>
          <Text style={s.tickNum}>{week.supps}</Text>/{week.daysSoFar} supps
        </Text>
      </Animated.View>

      <SectionTitle>Muscle heat map</SectionTitle>
      <Glass strong r={radius.xxl} style={{ overflow: 'hidden' }}>
        {focused ? (
          <BodyModel
            paint={paint}
            height={420}
            framing="full"
            describe={(m) => {
              if (state.injured && INJURY_REGIONS.has(m)) return `${MUSCLE_LABEL[m]} · resting (injury)`;
              const n = muscleSets[m] ?? 0;
              return `${MUSCLE_LABEL[m]} · ${n % 1 ? n.toFixed(1) : n} set${n === 1 ? '' : 's'} this week`;
            }}
          />
        ) : (
          <View style={{ height: 420 }} />
        )}
      </Glass>
      <View style={s.legend}>
        {heat.steps.map((c, i) => (
          <View key={c} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: c }]} />
            <Text style={s.legendText}>
              {heat.thresholds[i]}
              {i === heat.steps.length - 1 ? '+' : `–${heat.thresholds[i + 1] - 1}`} sets
            </Text>
          </View>
        ))}
        {state.injured && (
          <View style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: color.muscleInjured }]} />
            <Text style={s.legendText}>Legs & abs: resting (injury)</Text>
          </View>
        )}
      </View>
      <Text style={[type.small, { marginTop: space.sm }]}>
        Deeper red = more sets this week. Secondary muscles count as half a set.
        {topMuscles.length ? ` Most worked: ${topMuscles.map(([m]) => MUSCLE_LABEL[m]).join(', ')}.` : ''}
      </Text>

      <SectionTitle>Lifts</SectionTitle>
      {withData.length === 0 ? (
        <Glass r={radius.xl} style={s.empty}>
          <Icon name="chart" size={36} color={color.lime} />
          <Text style={[type.h2, { textAlign: 'center' }]}>Your charts start here</Text>
          <Text style={[type.bodyMuted, { textAlign: 'center' }]}>Tick off a set and every lift gets its own progress line.</Text>
        </Glass>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ flexGrow: 0 }}>
            {withData.map((x) => (
              <Chip key={x} label={EXERCISES[x].name} active={x === id} onPress={() => setPicked(x)} />
            ))}
          </ScrollView>

          <Glass r={radius.xxl} style={s.chartCard}>
            <View style={s.chartHead}>
              <Text style={type.label}>{showE1rm ? 'Estimated 1-rep max' : kind === 'reps' ? 'Best set' : 'Heaviest set'}</Text>
              {kind === 'weight_reps' && (
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <Chip label="Weight" active={metric === 'top'} onPress={() => setMetric('top')} />
                  <Chip label="1RM" active={metric === 'e1rm'} onPress={() => setMetric('e1rm')} />
                </View>
              )}
            </View>
            <LineChart points={points} unit={valueUnit} />
            <View style={s.summary}>
              <Text style={type.small}>
                Best <Text style={s.strong}>{best} {valueUnit}</Text>
              </Text>
              {hist.length > 1 && (
                <Text style={type.small}>
                  Since first{' '}
                  <Text style={[s.strong, { color: delta > 0 ? color.lime : color.text }]}>
                    {delta > 0 ? '+' : ''}
                    {delta} {valueUnit}
                  </Text>
                </Text>
              )}
            </View>
          </Glass>

          <View style={{ gap: space.sm, marginTop: space.md }}>
            {[...hist].reverse().slice(0, 6).map((h) => (
              <View key={h.date} style={s.session}>
                <Text style={[type.small, { width: 64 }]}>{formatDate(h.date)}</Text>
                <Text style={[type.num, { flex: 1, fontSize: size.body }]}>
                  {kind === 'reps' ? `${h.topReps} reps` : `${h.top} ${unit} × ${h.topReps}${kind === 'weight_time' ? ' s' : ''}`}
                </Text>
                <Text style={[type.small, { fontVariant: ['tabular-nums'] }]}>
                  {kind === 'weight_time' ? `${h.seconds} s total` : `${Math.round(h.volume).toLocaleString()} ${kind === 'reps' ? 'reps' : 'vol'}`}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  kicker: { ...type.label, color: color.lime },
  megaRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  mega: { fontFamily: font.display, lineHeight: leading.giga, letterSpacing: -4, color: color.text, fontVariant: ['tabular-nums'] },
  megaUnit: { fontFamily: font.display, fontSize: size.h2, color: color.muted },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  arrow: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  changeText: { fontFamily: font.bodyBold, fontSize: size.body, color: color.text },
  rankWrap: { marginTop: space.xl, marginLeft: space.x4 },
  rankCard: { padding: space.xl },
  rankTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rankName: { fontFamily: font.display, fontSize: size.hero, lineHeight: leading.hero, color: color.text },
  levelBubble: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: color.lime, alignItems: 'center', justifyContent: 'center' },
  levelText: { fontFamily: font.display, fontSize: size.h2, color: color.ink },
  ladder: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md },
  rung: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xs, borderWidth: 1, borderColor: color.glassBorder },
  rungPast: { borderColor: color.limeGlow },
  rungOn: { backgroundColor: color.lime, borderColor: color.lime },
  rungText: { fontFamily: font.bodyBlack, fontSize: size.tiny, color: color.subtle },
  ticker: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  tick: { fontFamily: font.bodyBold, fontSize: size.small, color: color.muted },
  tickNum: { fontFamily: font.display, fontSize: size.h2, color: color.lime },
  tickDot: { width: 4, height: 4, borderRadius: radius.pill, backgroundColor: color.subtle },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 14, height: 14, borderRadius: radius.pill },
  legendText: { fontFamily: font.bodySemi, fontSize: size.label, color: color.muted },
  empty: { alignItems: 'center', gap: space.sm, padding: space.x3 },
  chartCard: { marginTop: space.md, padding: space.xl },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm, gap: space.sm },
  summary: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm, borderTopWidth: 1, borderTopColor: color.line, paddingTop: space.md },
  strong: { fontFamily: font.bodyBold, color: color.text },
  session: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.glassSolid,
    borderWidth: 1,
    borderColor: color.glassBorder,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
});
