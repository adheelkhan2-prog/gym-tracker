import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from '../../components/LineChart';
import { Card, Chip, SectionLabel, Screen } from '../../components/ui';
import { EXERCISES } from '../../data/exercises';
import { DAYS } from '../../data/program';
import { exerciseHistory, formatDate, todayKey, useStore } from '../../store';
import { C, R, font } from '../../theme';

type Metric = 'top' | 'e1rm';

export default function ProgressScreen() {
  const { state } = useStore();
  const unit = state.unit;

  // Exercises in program order, de-duplicated.
  const allIds = useMemo(() => [...new Set(DAYS.flatMap((d) => d.exercises.map((e) => e.exerciseId)))], []);
  const histories = useMemo(
    () => Object.fromEntries(allIds.map((id) => [id, exerciseHistory(state.logs, id)])),
    [state.logs, allIds],
  );
  const withData = allIds.filter((id) => histories[id].length > 0);
  const [picked, setPicked] = useState<string | null>(null);
  const id = picked && withData.includes(picked) ? picked : withData[0];
  const [metric, setMetric] = useState<Metric>('top');

  // Headline numbers
  const workoutDates = Object.keys(state.logs).filter((d) =>
    Object.values(state.logs[d]).some((sets) => sets.some((x) => x.done)),
  );
  const now = new Date();
  const weekAgo = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const thisWeek = workoutDates.filter((d) => d >= weekAgo).length;
  const totalSets = Object.values(state.logs).reduce(
    (n, day) => n + Object.values(day).reduce((m, sets) => m + sets.filter((x) => x.done).length, 0),
    0,
  );

  const hist = id ? histories[id] : [];
  const points = hist.map((h) => ({
    label: formatDate(h.date),
    value: Math.round(metric === 'top' ? h.topWeight : h.e1rm),
    detail: `${h.topWeight} ${unit} × ${h.topReps}`,
  }));
  const best = hist.length ? Math.max(...hist.map((h) => h.topWeight)) : 0;
  const change = hist.length > 1 ? hist[hist.length - 1].topWeight - hist[0].topWeight : 0;

  return (
    <Screen>
      <Text style={font.display}>Progress</Text>

      <View style={s.tiles}>
        <Tile value={thisWeek} label="Workouts, last 7 days" />
        <Tile value={workoutDates.length} label="Workouts total" />
        <Tile value={totalSets} label="Sets logged" />
      </View>

      {withData.length === 0 ? (
        <Card style={{ marginTop: 24, alignItems: 'center', paddingVertical: 32 }}>
          <Text style={[font.h2, { textAlign: 'center' }]}>No lifts logged yet</Text>
          <Text style={s.empty}>
            Tick off a set on the Train tab and your weights will start charting here.
          </Text>
        </Card>
      ) : (
        <>
          <SectionLabel>Exercise</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {withData.map((x) => (
              <Chip key={x} label={EXERCISES[x].name} active={x === id} onPress={() => setPicked(x)} />
            ))}
          </ScrollView>

          <Card style={{ marginTop: 16 }}>
            <View style={s.chartHead}>
              <Text style={font.label}>{metric === 'top' ? 'Heaviest set' : 'Estimated 1-rep max'}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip label="Weight" active={metric === 'top'} onPress={() => setMetric('top')} />
                <Chip label="1RM" active={metric === 'e1rm'} onPress={() => setMetric('e1rm')} />
              </View>
            </View>
            <LineChart points={points} unit={unit} />
            <View style={s.summary}>
              <Text style={s.summaryText}>
                Best <Text style={s.summaryNum}>{best} {unit}</Text>
              </Text>
              {hist.length > 1 && (
                <Text style={s.summaryText}>
                  Since first session{' '}
                  <Text style={s.summaryNum}>
                    {change >= 0 ? '+' : ''}
                    {change} {unit}
                  </Text>
                </Text>
              )}
            </View>
          </Card>

          <SectionLabel>Sessions</SectionLabel>
          <View style={{ gap: 6 }}>
            {[...hist].reverse().map((h) => (
              <View key={h.date} style={s.session}>
                <Text style={s.sessionDate}>{formatDate(h.date)}</Text>
                <Text style={[s.sessionVal, font.num]}>
                  {h.topWeight} {unit} × {h.topReps}
                </Text>
                <Text style={[s.sessionVol, font.num]}>{Math.round(h.volume).toLocaleString()} vol</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <View style={s.tile}>
      <Text style={[s.tileValue, font.num]}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 8, marginTop: 18 },
  tile: { flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: 14 },
  tileValue: { color: C.text, fontSize: 28, fontWeight: '800' },
  tileLabel: { color: C.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 },
  summaryText: { color: C.muted, fontSize: 13 },
  summaryNum: { color: C.text, fontWeight: '700' },
  session: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.sm, padding: 14 },
  sessionDate: { color: C.muted, width: 70 },
  sessionVal: { color: C.text, fontWeight: '700', flex: 1 },
  sessionVol: { color: C.faint, fontSize: 13 },
});
