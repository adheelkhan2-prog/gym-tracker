import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BodyModel, type PaintMap } from '../../components/body/BodyModel';
import { ExerciseMedia, HowToSteps, MuscleLegend, SwapSheet, Tips, mediaCredit } from '../../components/ExerciseParts';
import { Backdrop, Glass } from '../../components/glass';
import { Icon, type IconName } from '../../components/icons';
import { LineChart } from '../../components/LineChart';
import { OwnVideoButtons } from '../../components/RecordVideo';
import { Button, IconButton, Press } from '../../components/ui';
import { crumb } from '../../crash';
import { EQUIPMENT_LABEL, EXERCISES } from '../../data/exercises';
import { MUSCLE_LABEL } from '../../data/muscles';
import { pickOption, restFor, type PlannedExercise } from '../../data/program';
import { swapsFor } from '../../data/swaps';
import { haptic } from '../../feedback';
import { activeProgram, dateFromKey, dayById, todayKey, useStore } from '../../store';
import { color, fmtClock, font, leading, radius, size, space, themed, type } from '../../theme';
import { exerciseFor, swapSlot } from '../../workout';
import { bestText, chartValue, compareWeeks, weeklySeries, weeklyTarget, type Trend } from '../../weekly';

type Tab = 'howto' | 'muscles';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (key: string) => {
  const d = dateFromKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const TREND_ICON: Record<Trend, IconName> = { up: 'arrowUp', down: 'arrowDown', same: 'minus', new: 'star' };

/**
 * One exercise: its video (or your own), this week's target, this week vs last week, the weekly
 * history chart, and how-to / muscles / tips. Logging happens on the workout screen. Opened from a
 * workout day (with a slot) it can also swap the exercise for that day.
 */
export default function ExerciseScreen() {
  const params = useLocalSearchParams<{ id: string; day?: string; slot?: string }>();
  const { state, update } = useStore();
  const insets = useSafeAreaInsets();
  const date = todayKey();
  const day = dayById(state, params.day);
  const plan: PlannedExercise | undefined =
    day?.exercises.find((e) => e.slot === params.slot) ?? activeProgram(state).days.flatMap((d) => d.exercises).find((e) => e.options.includes(params.id));
  const slotPlan = day?.exercises.find((e) => e.slot === params.slot);
  const id = slotPlan ? exerciseFor(state, slotPlan) : params.id;
  const ex = EXERCISES[id];
  const [tab, setTab] = useState<Tab>('howto');
  const [swapOpen, setSwapOpen] = useState(false);

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
        <View style={[s.pad, { paddingTop: insets.top + space.x4, gap: space.lg }]}>
          <Text style={type.title}>Exercise not found</Text>
          <Button variant="outline" label="Back" onPress={() => router.back()} />
        </View>
      </Backdrop>
    );
  }

  const kind = ex.kind;
  const unit = state.unit;
  const cmp = compareWeeks(state, id, date);
  const target = weeklyTarget(state, id, plan, date);
  const series = weeklySeries(state, id, 12, date).filter((p) => p.best);
  const chartUnit = kind === 'weight_reps' ? `${unit} e1RM` : kind === 'weight_time' ? unit : kind === 'time' ? 's' : 'reps';
  const points = series.map((p) => ({ label: short(p.week), value: chartValue(p.best!, kind, unit), detail: `Week of ${short(p.week)}: ${bestText(p.best!, kind, unit)}` }));
  const original = slotPlan ? pickOption(slotPlan, state.variants) : id;
  const swaps = slotPlan ? swapsFor(original) : [];
  const credit = mediaCredit(id, state.userVideos);

  return (
    <Backdrop>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.x5 }}>
        <View style={[s.pad, s.header]}>
          <IconButton icon="back" label="Back" onPress={() => router.back()} />
        </View>
        <View style={s.pad}>
          <Text style={s.title} accessibilityRole="header">
            {ex.name}
          </Text>
          <Text style={[type.small, { marginTop: space.xs }]}>
            {plan ? `${plan.sets} × ${plan.target}${kind === 'time' || kind === 'weight_time' ? ' s' : ''} · rest ${fmtClock(restFor(id, plan))} · ` : ''}
            {EQUIPMENT_LABEL[ex.equipment]}
          </Text>
          {slotPlan && (swaps.length > 0 || id !== original) && (
            <View style={{ flexDirection: 'row', marginTop: space.md }}>
              <Button size="sm" variant="outline" icon="swap" label="Swap" accessibilityLabel={`Swap ${ex.name}`} onPress={() => setSwapOpen(true)} />
            </View>
          )}
        </View>

        <View style={[s.pad, { marginTop: space.lg, gap: space.sm }]}>
          <ExerciseMedia exerciseId={id} />
          <OwnVideoButtons exerciseId={id} />
          {credit ? <Text style={s.credit}>{credit}</Text> : null}
        </View>

        {/* This week */}
        <View style={[s.pad, { marginTop: space.xl, gap: space.md }]}>
          {target && (
            <Glass r={radius.xl} style={s.card}>
              <View style={s.rowTop}>
                <Icon name="flame" size={20} color={color.accent} />
                <Text style={type.label}>Target this week</Text>
              </View>
              <Text style={s.big}>{target.text}</Text>
              <Text style={type.small}>
                {target.reason === 'first'
                  ? 'First time: pick a weight you can lift for the reps with good form.'
                  : target.reason === 'weight'
                    ? `You hit the top of the range, so add the smallest step (${target.lastText}).`
                    : `Add a rep before adding weight (${target.lastText}).`}
              </Text>
            </Glass>
          )}
          <Glass r={radius.xl} style={s.card}>
            <Text style={type.label}>This week vs last week</Text>
            {cmp.thisWeek ? (
              <View style={s.cmpRow}>
                <View style={[s.trend, cmp.trend === 'down' && s.trendDown]}>
                  <Icon name={TREND_ICON[cmp.trend ?? 'same']} size={20} color={cmp.trend === 'down' ? color.warn : color.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{bestText(cmp.thisWeek, kind, unit)}</Text>
                  <Text style={type.small}>
                    {cmp.lastWeek ? `Last week ${bestText(cmp.lastWeek, kind, unit)} · ` : ''}
                    {cmp.change}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={type.small}>{cmp.lastWeek ? `Not done yet this week. Last week: ${bestText(cmp.lastWeek, kind, unit)}.` : 'No sets logged yet.'}</Text>
            )}
          </Glass>
          <Glass r={radius.xl} style={s.card}>
            <Text style={type.label}>Best set per week</Text>
            {points.length > 0 ? (
              <LineChart points={points} unit={chartUnit} height={200} />
            ) : (
              <Text style={type.small}>Your weekly best appears here after your first session.</Text>
            )}
            {kind === 'weight_reps' && points.length > 0 && <Text style={s.credit}>Estimated one-rep max of each week’s best set (Epley).</Text>}
          </Glass>
        </View>

        {/* How to / Muscles */}
        <View style={[s.pad, { marginTop: space.xl }]}>
          <View style={s.tabs} accessibilityRole="tablist">
            {(['howto', 'muscles'] as const).map((t) => (
              <Press key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
                <Icon name={t === 'howto' ? 'info' : 'body'} size={18} color={tab === t ? color.accentText : color.muted} />
                <Text style={[s.tabText, tab === t && { color: color.accentText }]}>{t === 'howto' ? 'How to' : 'Muscles'}</Text>
              </Press>
            ))}
          </View>
          {tab === 'howto' ? (
            <View style={{ gap: space.md, marginTop: space.sm }}>
              <HowToSteps ex={ex} />
              <Text style={[type.label, { marginTop: space.md }]}>Tips</Text>
              <Tips ex={ex} />
            </View>
          ) : (
            <View style={{ marginTop: space.md }}>
              <Glass r={radius.xl} style={{ overflow: 'hidden' }}>
                <BodyModel paint={paint} height={320} tint={color.accent} describe={(m) => `${MUSCLE_LABEL[m]}${ex.primary.includes(m) ? ' · primary' : ex.secondary.includes(m) ? ' · secondary' : ''}`} />
              </Glass>
              <MuscleLegend ex={ex} />
            </View>
          )}
        </View>
      </ScrollView>

      {swapOpen && slotPlan && (
        <SwapSheet
          original={original}
          current={id}
          swaps={swaps}
          note="Same primary muscles only."
          onPick={(to) => {
            haptic.setDone();
            crumb(`swap ${id} -> ${to}`);
            update((cur) => swapSlot(cur, date, slotPlan, to));
            setSwapOpen(false);
            router.setParams({ id: to });
          }}
          onReset={() => {
            update((cur) => swapSlot(cur, date, slotPlan, original));
            setSwapOpen(false);
            router.setParams({ id: original });
          }}
          onClose={() => setSwapOpen(false)}
        />
      )}
    </Backdrop>
  );
}

const s = themed(() =>
  StyleSheet.create({
    pad: { paddingHorizontal: space.lg },
    header: { flexDirection: 'row', alignItems: 'center' },
    title: { fontFamily: font.display, fontSize: size.display, lineHeight: leading.display, letterSpacing: -0.8, color: color.text, marginTop: space.md },
    credit: { ...type.small, fontSize: size.tiny, color: color.subtle },
    card: { padding: space.lg, gap: space.sm },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    big: { fontFamily: font.display, fontSize: size.title, lineHeight: leading.title, color: color.accentText },
    cmpRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    trend: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accentDim },
    trendDown: { backgroundColor: color.warnDim },
    tabs: { flexDirection: 'row', gap: space.sm, padding: space.xs, borderRadius: radius.pill, backgroundColor: color.surface2 },
    tab: { flex: 1, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: radius.pill },
    tabOn: { backgroundColor: color.accentDim, borderWidth: 1, borderColor: color.accentEdge },
    tabText: { fontFamily: font.bodyBold, fontSize: size.body, color: color.muted },
  }),
);

// One bad screen shows a recovery panel for that screen only; it never takes the app down.
export { RouteError as ErrorBoundary } from '../../components/RouteError';
