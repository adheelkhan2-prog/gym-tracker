// The workout calendar (top of Progress): a month of days, swipe left/right to change month, a
// Today button. Trained days get a crimson dot (filled = finished, outline = partial), days with
// every supplement taken a small second marker, today a ring. Tap a day for its session.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { MONTH_NAMES, addMonths, dayMark, daySession, monthGrid, monthSummary } from '../calendar';
import { EXERCISES } from '../data/exercises';
import { haptic } from '../feedback';
import { fmtKg, fromKg } from '../load';
import { allTaken, dateFromKey, formatDate, todayKey, useStore } from '../store';
import { pinSetsText } from '../totals';
import { color, font, radius, size, space, themed, touch, type } from '../theme';
import { Glass } from './glass';
import { Icon } from './icons';
import { SetLine, setKey } from './SetHistory';
import { Sheet } from './Sheet';
import { Button, IconButton, Press } from './ui';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WorkoutCalendar({ onOpenDay }: { onOpenDay: (date: string) => void }) {
  const { state } = useStore();
  const today = todayKey();
  const now = dateFromKey(today);
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  // Only this month's dates are looked at (the React compiler memoises these).
  const grid = monthGrid(ym.y, ym.m);
  const summary = monthSummary(state, ym.y, ym.m, today);
  const isThisMonth = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const go = (n: number) => {
    haptic.tap();
    setYm((v) => addMonths(v, n));
  };
  // Swipe left: next month; right: previous. Vertical drags fail it, so the page still scrolls.
  const pan = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-12, 12],
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX < -60 || e.velocityX < -600) scheduleOnRN(go, 1);
      else if (e.translationX > 60 || e.velocityX > 600) scheduleOnRN(go, -1);
    },
  });

  return (
    <View testID="workout-calendar">
      <GestureDetector gesture={pan}>
        <Glass r={radius.xxl} style={s.card}>
          <View style={s.head}>
            <IconButton icon="back" label="Previous month" onPress={() => go(-1)} />
            <Text style={s.month} accessibilityRole="header" accessibilityLiveRegion="polite">
              {MONTH_NAMES[ym.m]} {ym.y}
            </Text>
            <IconButton icon="next" label="Next month" onPress={() => go(1)} />
            {!isThisMonth && (
              <Button
                size="sm"
                variant="outline"
                label="Today"
                onPress={() => {
                  haptic.tap();
                  setYm({ y: now.getFullYear(), m: now.getMonth() });
                }}
                testID="calendar-today"
              />
            )}
          </View>
          <View style={s.week}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={s.wd}>
                {w}
              </Text>
            ))}
          </View>
          {grid.map((row, r) => (
            <View key={r} style={s.week}>
              {row.map((d, c) => {
                if (!d) return <View key={c} style={s.cell} />;
                const mark = dayMark(state, d);
                const supps = state.supplements.length > 0 && allTaken(state, d);
                const isToday = d === today;
                const future = d > today;
                return (
                  <Press
                    key={d}
                    onPress={() => {
                      haptic.tap();
                      onOpenDay(d);
                    }}
                    style={[s.cell, isToday && s.today]}
                    scaleTo={0.94}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDate(d)}${isToday ? ', today' : ''}${mark === 'done' ? ', workout finished' : mark === 'partial' ? ', workout partly done' : ''}${supps ? ', supplements taken' : ''}`}
                    testID={`cal-${d}`}
                  >
                    <Text style={[s.num, future && { color: color.subtle }, isToday && { color: color.accentText }]}>{dateFromKey(d).getDate()}</Text>
                    <View style={s.marks}>
                      <View style={[s.dot, mark === 'done' && s.dotDone, mark === 'partial' && s.dotPartial]} />
                      {supps && <View style={s.supp} />}
                    </View>
                  </Press>
                );
              })}
            </View>
          ))}
          <View style={s.legend}>
            <View style={[s.dot, s.dotDone]} />
            <Text style={s.legendText}>Finished</Text>
            <View style={[s.dot, s.dotPartial]} />
            <Text style={s.legendText}>Partial</Text>
            <View style={s.supp} />
            <Text style={s.legendText}>Supplements</Text>
          </View>
        </Glass>
      </GestureDetector>
      <View style={s.summary} testID="calendar-summary">
        <Stat label="Workouts" value={String(summary.workouts)} />
        <Stat label="Volume" value={fmtKg(summary.volume, state.unit)} />
        <Stat label="PRs" value={String(summary.prs)} />
        <Stat label="Best streak" value={`${summary.longestStreak} d`} />
      </View>
      {summary.pinSets > 0 && (
        <Text style={s.pinNote} testID="calendar-pin-sets">
          {pinSetsText(summary.pinSets)} by machine pin this month, not in the kg volume
        </Text>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Glass r={radius.lg} style={s.stat}>
      <Text style={s.statNum} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </Glass>
  );
}

/** A day from the calendar: the workout, every exercise with its sets (editable), PRs, time, volume. */
export function DaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { state } = useStore();
  const ses = daySession(state, date);
  const d = dateFromKey(date);
  const when = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <Sheet title={ses.title ?? when} subtitle={ses.title ? when : undefined} onClose={onClose} testID="day-sheet">
      {ses.exercises.length === 0 ? (
        <View style={s.emptyDay}>
          <Icon name="moon" size={24} color={color.muted} />
          <Text style={type.bodyMuted}>No sets logged this day.{ses.supps ? ' Supplements all taken.' : ''}</Text>
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          <View style={s.facts}>
            <Fact icon="flag" text={ses.finished ? 'Finished' : 'Partial'} />
            {ses.minutes !== null && <Fact icon="clock" text={`${ses.minutes} min`} />}
            {ses.volume > 0 && <Fact icon="chart" text={`${Math.round(fromKg(ses.volume, state.unit)).toLocaleString()} ${state.unit}`} />}
            {ses.pinSets > 0 && <Fact icon="chart" text={`${ses.pinSets} pin set${ses.pinSets === 1 ? '' : 's'}`} />}
            {ses.prs > 0 && <Fact icon="trophy" text={`${ses.prs} PR${ses.prs > 1 ? 's' : ''}`} />}
            {ses.supps && <Fact icon="flask" text="Supps taken" />}
          </View>
          {ses.exercises.map((e) => (
            <View key={e.id} style={s.ex}>
              <Text style={type.h3}>{EXERCISES[e.id].name}</Text>
              {e.sets.map((x) => (
                <SetLine key={setKey(x.i, x.set)} id={e.id} date={date} i={x.i} set={x.set} trophy={x.pr} />
              ))}
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

function Fact({ icon, text }: { icon: 'flag' | 'clock' | 'chart' | 'trophy' | 'flask'; text: string }) {
  return (
    <View style={s.fact}>
      <Icon name={icon} size={14} color={icon === 'trophy' ? color.accent : color.muted} filled={icon === 'trophy'} />
      <Text style={s.factText}>{text}</Text>
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    card: { padding: space.md, gap: 2 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: space.sm },
    month: { flex: 1, textAlign: 'center', fontFamily: font.display, fontSize: size.h3, color: color.text },
    week: { flexDirection: 'row' },
    wd: { flex: 1, textAlign: 'center', fontFamily: font.bodyBold, fontSize: size.tiny, color: color.subtle, paddingVertical: space.xs },
    cell: { flex: 1, minHeight: touch.min, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, gap: 3 },
    today: { borderWidth: 1.5, borderColor: color.accent },
    num: { fontFamily: font.bodySemi, fontSize: size.small, color: color.text, fontVariant: ['tabular-nums'] },
    marks: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 7 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    dotDone: { backgroundColor: color.accent },
    dotPartial: { borderWidth: 1.5, borderColor: color.accent },
    supp: { width: 5, height: 5, borderRadius: 1, backgroundColor: color.muted },
    legend: { flexDirection: 'row', alignItems: 'center', gap: space.xs, justifyContent: 'center', marginTop: space.sm },
    legendText: { fontFamily: font.bodySemi, fontSize: size.tiny, color: color.muted, marginRight: space.sm },
    pinNote: { fontFamily: font.bodySemi, fontSize: size.small, color: color.muted, marginTop: space.xs },
    summary: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
    stat: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.sm, alignItems: 'center' },
    statNum: { fontFamily: font.display, fontSize: size.h3, color: color.text, fontVariant: ['tabular-nums'] },
    statLabel: { fontFamily: font.bodySemi, fontSize: size.tiny, color: color.muted, textAlign: 'center' },
    emptyDay: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    fact: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: color.surface2 },
    factText: { fontFamily: font.bodySemi, fontSize: size.small, color: color.text },
    ex: { gap: 2, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.line },
  }),
);
