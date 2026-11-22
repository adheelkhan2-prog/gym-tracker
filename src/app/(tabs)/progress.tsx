import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BodyModel, type PaintMap } from '../../components/body/BodyModel';
import { LineChart } from '../../components/LineChart';
import { Badge, Card, Chip, Screen, SectionTitle } from '../../components/ui';
import { EXERCISES } from '../../data/exercises';
import { INJURY_REGIONS, MUSCLE_LABEL, type MuscleId } from '../../data/muscles';
import { ALL_EXERCISE_IDS } from '../../data/program';
import { exerciseHistory, formatDate, trainingStreak, useStore, weeklyMuscleSets, weekSummary } from '../../store';
import { color, font, heat, radius, size, space, type } from '../../theme';

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
  const unit = state.unit;
  const week = weekSummary(state);
  const streak = trainingStreak(state);

  // ----- Muscle heat map -----
  const muscleSets = useMemo(() => weeklyMuscleSets(state), [state]);
  const paint: PaintMap = useMemo(() => {
    const p: PaintMap = {};
    for (const [m, n] of Object.entries(muscleSets) as [MuscleId, number][]) {
      const c = heatColor(n);
      if (c) p[m] = { color: c, glow: n >= heat.thresholds[3] ? 0.35 : 0.1 };
    }
    if (state.injured) for (const m of INJURY_REGIONS) p[m] = { color: color.muscleInjured };
    return p;
  }, [muscleSets, state.injured]);
  const topMuscles = (Object.entries(muscleSets) as [MuscleId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // ----- Exercise charts -----
  const histories = useMemo(
    () => Object.fromEntries(ALL_EXERCISE_IDS.map((id) => [id, exerciseHistory(state.logs, id)])),
    [state.logs],
  );
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
  const change = hist.length > 1 ? hist[hist.length - 1].top - hist[0].top : 0;

  return (
    <Screen>
      <Text style={type.display} accessibilityRole="header">
        Progress
      </Text>
      <Text style={[type.bodyMuted, { marginTop: space.xs }]}>This week so far</Text>

      <View style={s.badges}>
        <Badge
          icon="calendar"
          title={`${Math.min(week.trained, week.planned)}/${week.planned} days`}
          sub={
            week.trained > week.planned
              ? `Full week + ${week.trained - week.planned} bonus day${week.trained - week.planned > 1 ? 's' : ''}`
              : week.trained >= week.planned && week.planned > 0
                ? 'Full week done!'
                : 'Training days this week'
          }
          earned={week.planned > 0 && week.trained >= week.planned}
          tint={color.lime}
        />
        <Badge
          icon="trophy"
          title={`${week.prs} PR${week.prs === 1 ? '' : 's'}`}
          sub={week.prs >= 3 ? 'Record breaker' : 'Records this week'}
          earned={week.prs >= 3}
          tint={color.gold}
        />
      </View>
      <View style={[s.badges, { marginTop: space.sm }]}>
        <Badge
          icon="flask"
          title={`${week.supps}/${week.daysSoFar} days`}
          sub={week.supps >= week.daysSoFar && week.daysSoFar > 0 ? 'Supps on point' : 'Supplements taken'}
          earned={week.daysSoFar > 0 && week.supps >= week.daysSoFar}
          tint={color.orange}
        />
        <Badge
          icon="flame"
          title={`${streak} day${streak === 1 ? '' : 's'}`}
          sub={streak >= 5 ? 'On fire' : 'Training streak'}
          earned={streak >= 5}
          tint={color.orange}
        />
      </View>

      <SectionTitle>Muscle heat map</SectionTitle>
      {focused ? (
        <BodyModel
          paint={paint}
          height={380}
          framing="full"
          describe={(m) => {
            if (state.injured && INJURY_REGIONS.has(m)) return `${MUSCLE_LABEL[m]} · resting (injury)`;
            const n = muscleSets[m] ?? 0;
            return `${MUSCLE_LABEL[m]} · ${n % 1 ? n.toFixed(1) : n} set${n === 1 ? '' : 's'} this week`;
          }}
        />
      ) : (
        <View style={{ height: 380 }} />
      )}
      <View style={s.legend}>
        {heat.steps.map((c, i) => (
          <View key={c} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: c }]} />
            <Text style={s.legendText}>
              {heat.thresholds[i]}
              {i === heat.steps.length - 1 ? '+' : `–${heat.thresholds[i + 1] - 1}`}
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
        Sets per muscle this week. Secondary muscles count as half a set.
        {topMuscles.length ? ` Most worked: ${topMuscles.map(([m]) => MUSCLE_LABEL[m]).join(', ')}.` : ''}
      </Text>

      <SectionTitle>Lifts</SectionTitle>
      {withData.length === 0 ? (
        <Card style={s.empty}>
          <Ionicons name="trending-up" size={36} color={color.lime} />
          <Text style={[type.h2, { textAlign: 'center' }]}>Your charts start here</Text>
          <Text style={[type.bodyMuted, { textAlign: 'center' }]}>
            Tick off a set on the Today tab and every lift gets its own progress line.
          </Text>
        </Card>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ flexGrow: 0 }}>
            {withData.map((x) => (
              <Chip key={x} label={EXERCISES[x].name} active={x === id} onPress={() => setPicked(x)} />
            ))}
          </ScrollView>

          <Card style={{ marginTop: space.md }}>
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
                  <Text style={[s.strong, { color: change > 0 ? color.lime : color.text }]}>
                    {change > 0 ? '+' : ''}
                    {change} {valueUnit}
                  </Text>
                </Text>
              )}
            </View>
          </Card>

          <View style={{ gap: space.sm, marginTop: space.md }}>
            {[...hist].reverse().slice(0, 8).map((h) => (
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
  badges: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 14, height: 14, borderRadius: radius.pill },
  legendText: { fontFamily: font.bodySemi, fontSize: size.label, color: color.muted },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.x3 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm, gap: space.sm },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: space.md,
  },
  strong: { fontFamily: font.bodyBold, color: color.text },
  session: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.surface, borderRadius: radius.md, padding: space.lg, gap: space.sm },
});
