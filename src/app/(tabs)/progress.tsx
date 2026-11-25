import { router, useIsFocused } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { BodyModel, type PaintMap } from '../../components/body/BodyModel';
import { Glass } from '../../components/glass';
import { Icon } from '../../components/icons';
import { LineChart } from '../../components/LineChart';
import { WeeklyTracker } from '../../components/WeeklyTracker';
import { DaySheet, WorkoutCalendar } from '../../components/WorkoutCalendar';
import { CountUp } from '../../components/motion';
import { Chip, IconButton, Press, Screen, SectionTitle } from '../../components/ui';
import { EXERCISES, EXERCISE_LIST } from '../../data/exercises';
import { MUSCLE_LABEL, type MuscleId } from '../../data/muscles';
import { fromKg, round1 } from '../../load';
import { activeProgram, addDays, exerciseHistory, formatDate, todayKey, useStore, weekKeys, weeklyMuscleSets, weekSummary } from '../../store';
import { bottomClearance, color, font, heat, leading, motion, radius, size, space, themed, type } from '../../theme';
import { pctChange, volumeOn } from '../../totals';
import { exerciseFor, visiblePlans } from '../../workout';
import { WEEKDAY_SHORT } from '../../data/program';

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
  // Volume is summed in kg and shown in your unit.
  const vol = Math.round(
    fromKg(
      thisWeek.reduce((n, d) => n + volumeOn(state, d), 0),
      unit,
    ),
  );
  const volLast = Math.round(
    fromKg(
      lastWeek.reduce((n, d) => n + volumeOn(state, d), 0),
      unit,
    ),
  );
  const change = pctChange(vol, volLast);

  // ----- Muscle heat map -----
  const muscleSets = useMemo(() => weeklyMuscleSets(state), [state]);
  const paint: PaintMap = useMemo(() => {
    const p: PaintMap = {};
    for (const [m, n] of Object.entries(muscleSets) as [MuscleId, number][]) {
      const c = heatColor(n);
      if (c) p[m] = { color: c, glow: n >= heat.thresholds[3] ? 0.25 : 0.05 };
    }
    return p;
  }, [muscleSets]);
  const topMuscles = (Object.entries(muscleSets) as [MuscleId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // ----- Lifts -----
  // Every exercise has its own history, so swaps chart separately from the original.
  const histories = useMemo(() => Object.fromEntries(EXERCISE_LIST.map((e) => [e.id, exerciseHistory(state.logs, e.id, state.machines[e.id])])), [state.logs, state.machines]);
  const program = activeProgram(state);
  // Your current plan, grouped by day (the exercise you actually do in each slot, after swaps).
  const planDays = program.days.filter((d) => d.exercises.length).map((d) => ({ day: d, ids: [...new Set(visiblePlans(state, d).map((p) => exerciseFor(state, p)))] }));
  const inPlan = new Set(planDays.flatMap((d) => d.ids));
  // "Mon · Chest, Biceps & Shoulders" for weekday plans; the day's own name for rotations.
  const dayLabel = (d: (typeof planDays)[number]['day']) => {
    const wd = state.week.findIndex((x) => x === d.id);
    return wd >= 0 && !program.rotation ? `${WEEKDAY_SHORT[wd]} · ${d.name}` : d.name;
  };
  const withData = EXERCISE_LIST.map((e) => e.id).filter((x) => histories[x].length > 0);
  const [query, setQuery] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  // Search: anything in your history or your plan.
  const found = q ? [...new Set([...withData, ...inPlan])].filter((x) => EXERCISES[x].name.toLowerCase().includes(q)) : [];
  const [picked, setPicked] = useState<string | null>(null);
  const id = picked && EXERCISES[picked] ? picked : (planDays.flatMap((d) => d.ids).find((x) => histories[x].length) ?? withData[0] ?? null);
  const [metric, setMetric] = useState<Metric>('top');
  const kind = id ? EXERCISES[id].kind : 'weight_reps';
  const all = id ? histories[id] : [];
  // Charted in kg (shown in your unit) when known; a machine that was only logged by pin is charted by pin.
  const byPin = all.length > 0 && all.every((h) => h.top === 0 && h.pin !== undefined);
  const hist = byPin ? all : all.filter((h) => h.top > 0);
  const weightedKind = kind === 'weight_reps' || kind === 'weight_time';
  const showE1rm = metric === 'e1rm' && kind === 'weight_reps' && !byPin;
  const valueUnit = byPin ? 'pin' : kind === 'reps' ? 'reps' : kind === 'time' ? 's' : unit;
  const val = (h: (typeof hist)[number]) => (byPin ? h.pin! : weightedKind ? Number(round1(fromKg(showE1rm ? h.e1rm : h.top, unit))) : h.top);
  /** "60 kg × 8", "Pin 7 × 12", "15 reps", "45 s", "40 kg × 35 s": always in your unit. */
  const setLine = (h: (typeof hist)[number], k = kind) =>
    h.pin !== undefined && h.top === 0
      ? `Pin ${h.pin} × ${h.topReps}`
      : k === 'reps'
        ? `${h.topReps} reps`
        : k === 'time'
          ? `${h.topReps} s`
          : `${round1(fromKg(h.top, unit))} ${unit} × ${h.topReps}${k === 'weight_time' ? ' s' : ''}`;
  const points = hist.map((h) => ({ label: formatDate(h.date), value: val(h), detail: setLine(h) }));
  const best = hist.length ? Math.max(...hist.map(val)) : 0;
  const delta = hist.length > 1 ? Number(round1(val(hist[hist.length - 1]) - val(hist[0]))) : 0;
  /** A lift's row: its latest best set, or "No sets yet". */
  const lastLine = (x: string) => {
    const h = histories[x];
    return h.length ? `${setLine(h[h.length - 1], EXERCISES[x].kind)} · ${formatDate(h[h.length - 1].date)}` : 'No sets yet';
  };
  const liftRow = (x: string, i: number) => (
    <Press
      key={x}
      onPress={() => setPicked(x)}
      style={[s.liftRow, i > 0 && s.liftLine, x === id && s.liftOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: x === id }}
      accessibilityLabel={`${EXERCISES[x].name}: ${lastLine(x)}. Show chart`}
      testID={`lift-${x}`}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.h3, x === id && { color: color.accentText }]} numberOfLines={1}>
          {EXERCISES[x].name}
        </Text>
        <Text style={[type.small, !histories[x].length && { color: color.subtle }]} numberOfLines={1}>
          {lastLine(x)}
        </Text>
      </View>
      <Icon name="chart" size={18} color={x === id ? color.accent : color.subtle} />
    </Press>
  );
  const enter = (i: number) =>
    reduce
      ? undefined
      : FadeInDown.delay(i * motion.stagger)
          .springify()
          .damping(16);
  const up = (change ?? 0) >= 0;

  return (
    <View style={{ flex: 1 }}>
      <Screen padBottom={bottomClearance.tabs}>
        {/* Workout calendar: every day you trained, tap one for its session. */}
        <WorkoutCalendar onOpenDay={setDay} />
        <View style={{ height: space.x4 }} />
        {/* Hero: one huge number */}
        <Animated.View entering={enter(0)}>
          <Text style={s.kicker}>Volume this week</Text>
          <View style={s.megaRow}>
            <CountUp to={vol} style={[s.mega, { fontSize: vol >= 100000 ? size.numXL : width < 380 ? size.mega : size.giga }]} />
            <Text style={s.megaUnit}>{unit}</Text>
          </View>
          {change !== null && (
            <View style={s.changeRow}>
              <View style={[s.arrow, { backgroundColor: up ? color.accent : color.surface3 }]}>
                <Icon name={up ? 'arrowUp' : 'arrowDown'} size={16} color={color.onAccent} />
              </View>
              <Text style={s.changeText}>
                <Text style={{ color: up ? color.accent : color.muted }}>
                  {up ? '+' : ''}
                  {change}%
                </Text>{' '}
                vs last week
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Week ticker: no equal tiles */}
        <Animated.View entering={enter(2)} style={s.ticker}>
          <Text style={s.tick}>
            <Text style={s.tickNum}>{Math.min(week.trained, week.planned)}</Text>/{week.planned} days
            {week.trained > week.planned ? ` +${week.trained - week.planned} bonus` : ''}
          </Text>
          <View style={s.tickDot} />
          <Text style={s.tick}>
            <Text style={[s.tickNum, { color: color.accent }]}>{week.prs}</Text> PRs
          </Text>
          <View style={s.tickDot} />
          <Text style={s.tick}>
            <Text style={s.tickNum}>{week.supps}</Text>/{week.daysSoFar} supps
          </Text>
        </Animated.View>

        {/* Weekly PRs, stalled lifts, this week vs last week */}
        <WeeklyTracker today={todayKey()} />

        <SectionTitle>Muscle heat map</SectionTitle>
        <Glass strong r={radius.xxl} style={{ overflow: 'hidden' }}>
          {focused ? (
            <BodyModel
              paint={paint}
              height={420}
              framing="full"
              describe={(m) => {
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
        </View>
        <Text style={[type.small, { marginTop: space.sm }]}>
          Deeper red = more sets this week. Secondary muscles count as half a set.
          {topMuscles.length ? ` Most worked: ${topMuscles.map(([m]) => MUSCLE_LABEL[m]).join(', ')}.` : ''}
        </Text>

        <SectionTitle>Lifts</SectionTitle>
        <View style={s.search}>
          <Icon name="search" size={18} color={color.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your lifts"
            placeholderTextColor={color.subtle}
            style={s.searchInput}
            accessibilityLabel="Search your lifts"
            returnKeyType="search"
            testID="lift-search"
          />
          {query ? <IconButton icon="close" label="Clear search" onPress={() => setQuery('')} /> : null}
        </View>

        {/* The selected lift: a chart once there are two sessions, a stat card after the first. */}
        {id && (
          <Glass r={radius.xxl} style={s.chartCard} testID="lift-chart">
            <View style={s.chartHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type.h3} numberOfLines={1}>
                  {EXERCISES[id].name}
                </Text>
                <Text style={type.label}>
                  {hist.length < 2 ? 'Progress' : byPin ? 'Heaviest pin' : showE1rm ? 'Estimated 1-rep max' : kind === 'reps' || kind === 'time' ? 'Best set' : 'Heaviest set'}
                </Text>
              </View>
              {kind === 'weight_reps' && !byPin && hist.length > 1 && (
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <Chip label="Weight" active={metric === 'top'} onPress={() => setMetric('top')} />
                  <Chip label="1RM" active={metric === 'e1rm'} onPress={() => setMetric('e1rm')} />
                </View>
              )}
            </View>
            {hist.length === 0 ? (
              <Text style={[type.bodyMuted, { marginTop: space.sm }]}>No sets yet. Log it in a workout and your first session shows here.</Text>
            ) : hist.length === 1 ? (
              <View style={s.first} testID="lift-first-session">
                <Text style={type.label}>First session · {formatDate(hist[0].date)}</Text>
                <Text style={s.firstBig}>{setLine(hist[0])}</Text>
                <Text style={type.small}>Log it again next week to see your trend.</Text>
              </View>
            ) : (
              <>
                <LineChart points={points} unit={valueUnit} />
                <View style={s.summary}>
                  <Text style={type.small}>
                    Best{' '}
                    <Text style={s.strong}>
                      {best} {valueUnit}
                    </Text>
                  </Text>
                  <Text style={type.small}>
                    Since first{' '}
                    <Text style={[s.strong, { color: delta > 0 ? color.accent : color.text }]}>
                      {delta > 0 ? '+' : ''}
                      {delta} {valueUnit}
                    </Text>
                  </Text>
                </View>
              </>
            )}
            <Press
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id } })}
              style={s.details}
              accessibilityRole="button"
              accessibilityLabel={`${EXERCISES[id].name}: history, edit or delete sets`}
            >
              <Text style={s.detailsText}>History · edit or delete sets</Text>
              <Icon name="next" size={14} color={color.accentText} />
            </Press>
          </Glass>
        )}

        {q ? (
          <Glass r={radius.xl} style={s.liftCard}>
            {found.length ? found.map(liftRow) : <Text style={[type.small, { padding: space.lg }]}>No lift matches “{query.trim()}”.</Text>}
          </Glass>
        ) : (
          <>
            {planDays.map(({ day, ids }) => (
              <View key={day.id} style={{ marginTop: space.lg }}>
                <Text style={[type.label, { marginBottom: space.sm }]}>{dayLabel(day)}</Text>
                <Glass r={radius.xl} style={s.liftCard}>
                  {ids.map(liftRow)}
                </Glass>
              </View>
            ))}
            {/* Lifts you've logged that aren't in your current plan (an older plan, a swap). */}
            {withData.some((x) => !inPlan.has(x)) && (
              <View style={{ marginTop: space.lg }}>
                <Text style={[type.label, { marginBottom: space.sm }]}>Other lifts you’ve logged</Text>
                <Glass r={radius.xl} style={s.liftCard}>
                  {withData.filter((x) => !inPlan.has(x)).map(liftRow)}
                </Glass>
              </View>
            )}
          </>
        )}
      </Screen>
      {day && <DaySheet date={day} onClose={() => setDay(null)} />}
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    kicker: { ...type.label, color: color.accentText },
    megaRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
    mega: { fontFamily: font.display, lineHeight: leading.giga, letterSpacing: -4, color: color.text, fontVariant: ['tabular-nums'] },
    megaUnit: { fontFamily: font.display, fontSize: size.h2, color: color.muted },
    changeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    arrow: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    changeText: { fontFamily: font.bodyBold, fontSize: size.body, color: color.text },
    ticker: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
    tick: { fontFamily: font.bodyBold, fontSize: size.small, color: color.muted },
    tickNum: { fontFamily: font.display, fontSize: size.h2, color: color.accent },
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
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingLeft: space.lg,
      borderRadius: radius.pill,
      backgroundColor: color.surface2,
      borderWidth: 1,
      borderColor: color.glassBorder,
    },
    searchInput: { flex: 1, minHeight: 48, fontFamily: font.bodySemi, fontSize: size.body, color: color.text },
    liftCard: { paddingVertical: space.xs },
    liftRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.lg, borderRadius: radius.lg },
    liftLine: { borderTopWidth: 1, borderTopColor: color.line, borderRadius: 0 },
    liftOn: { backgroundColor: color.accentDim },
    first: { marginTop: space.md, gap: space.xs, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.surface2 },
    firstBig: { fontFamily: font.display, fontSize: size.title, lineHeight: leading.title, color: color.text },
    details: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 44, marginTop: space.sm },
    detailsText: { fontFamily: font.bodyBold, fontSize: size.small, color: color.accentText },
  }),
);

// One bad screen shows a recovery panel for that screen only; it never takes the app down.
export { RouteError as ErrorBoundary } from '../../components/RouteError';
