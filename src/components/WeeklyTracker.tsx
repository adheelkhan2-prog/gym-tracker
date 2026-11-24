// "This week": the weekly PR board, lifts that have stalled for 2+ weeks (with what to try), and every
// exercise you did this week against last week (best set, arrow, change). Tap one for its weekly chart.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { EXERCISES } from '../data/exercises';
import { activeProgram, useStore } from '../store';
import { color, font, radius, size, space, themed, type } from '../theme';
import { bestText, stalledLifts, weekBoard, weeklyPRs, type Trend } from '../weekly';
import { Glass } from './glass';
import { Icon, type IconName } from './icons';
import { Press, SectionTitle } from './ui';

const TREND: Record<Trend, { icon: IconName; word: string }> = {
  up: { icon: 'arrowUp', word: 'up' },
  down: { icon: 'arrowDown', word: 'down' },
  same: { icon: 'minus', word: 'same' },
  new: { icon: 'star', word: 'new' },
};

const open = (id: string) => router.push({ pathname: '/exercise/[id]', params: { id } });

export function WeeklyTracker({ today }: { today: string }) {
  const { state } = useStore();
  const unit = state.unit;
  const plans = activeProgram(state).days.flatMap((d) => d.exercises);
  const prs = weeklyPRs(state, today);
  const stalled = stalledLifts(state, today, plans);
  const board = weekBoard(state, today);

  return (
    <View testID="weekly-tracker">
      <SectionTitle>This week’s PRs</SectionTitle>
      <Glass r={radius.xl} style={s.card}>
        {prs.length === 0 ? (
          <Text style={type.small}>No PRs yet this week. Beat last week’s best set on any lift and it shows up here.</Text>
        ) : (
          prs.map((p) => (
            <Press key={p.exerciseId} onPress={() => open(p.exerciseId)} style={s.row} accessibilityRole="button" accessibilityLabel={`PR: ${EXERCISES[p.exerciseId].name}, ${bestText(p.best, EXERCISES[p.exerciseId].kind, unit)}`}>
              <View style={s.prBadge}>
                <Icon name="trophy" size={16} color={color.accent} filled />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>
                  {EXERCISES[p.exerciseId].name}
                </Text>
                <Text style={type.small}>{bestText(p.best, EXERCISES[p.exerciseId].kind, unit)}</Text>
              </View>
            </Press>
          ))
        )}
      </Glass>

      {stalled.length > 0 && (
        <>
          <SectionTitle>Stalled</SectionTitle>
          <Glass r={radius.xl} style={s.card}>
            {stalled.map((x) => (
              <Press key={x.exerciseId} onPress={() => open(x.exerciseId)} style={s.stall} accessibilityRole="button">
                <View style={s.rowTop}>
                  <Icon name="alert" size={16} color={color.warn} />
                  <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>
                    {EXERCISES[x.exerciseId].name}
                  </Text>
                  <Text style={s.weeks}>{x.weeks} wk</Text>
                </View>
                <Text style={type.small}>
                  Best lately {bestText(x.last, EXERCISES[x.exerciseId].kind, unit)}. {x.suggestion}
                </Text>
              </Press>
            ))}
          </Glass>
        </>
      )}

      <SectionTitle>This week vs last week</SectionTitle>
      <Glass r={radius.xl} style={s.card}>
        {board.length === 0 ? (
          <Text style={type.small}>Log a workout and each exercise’s best set this week shows here next to last week’s.</Text>
        ) : (
          board.map((r) => {
            const kind = EXERCISES[r.exerciseId].kind;
            const t = TREND[r.trend ?? 'same'];
            const down = r.trend === 'down';
            return (
              <Press
                key={r.exerciseId}
                onPress={() => open(r.exerciseId)}
                style={s.row}
                accessibilityRole="button"
                accessibilityLabel={`${EXERCISES[r.exerciseId].name}: ${bestText(r.thisWeek!, kind, unit)}, ${t.word} from last week, ${r.change}`}
                testID={`week-row-${r.exerciseId}`}
              >
                <View style={[s.arrow, down && s.arrowDown]}>
                  <Icon name={t.icon} size={16} color={down ? color.warn : color.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.name} numberOfLines={1}>
                    {EXERCISES[r.exerciseId].name}
                  </Text>
                  <Text style={type.small} numberOfLines={1}>
                    {bestText(r.thisWeek!, kind, unit)}
                    {r.lastWeek ? ` · last week ${bestText(r.lastWeek, kind, unit)}` : ''}
                  </Text>
                </View>
                <Text style={[s.change, down && { color: color.warn }]} numberOfLines={1}>
                  {r.change}
                </Text>
              </Press>
            );
          })
        )}
      </Glass>
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    card: { padding: space.md, gap: space.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.xs, borderRadius: radius.md },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    stall: { gap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.md },
    name: { fontFamily: font.bodyBold, fontSize: size.body, color: color.text },
    prBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accentDim },
    arrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accentDim },
    arrowDown: { backgroundColor: color.warnDim },
    change: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.accentText, maxWidth: 110, textAlign: 'right' },
    weeks: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.warn },
  }),
);
