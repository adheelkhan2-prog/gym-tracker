import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Glass } from '../../components/glass';
import { Icon } from '../../components/icons';
import { CountUp, Pulse } from '../../components/motion';
import { SwipeDeck, type DeckItem } from '../../components/SwipeDeck';
import { Badge, Button, Flame, Press, Ring, Screen } from '../../components/ui';
import { GREETING, REST_DAY, line } from '../../copy';
import { EXERCISES } from '../../data/exercises';
import { MUSCLE_LABEL } from '../../data/muscles';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../../data/program';
import { haptic } from '../../feedback';
import {
  activeProgram,
  allTaken,
  applyPending,
  dateFromKey,
  dayById,
  dayHasWork,
  easingIn,
  formatDate,
  num,
  prMetric,
  previousSession,
  programById,
  todayKey,
  trainedOn,
  trainingStreak,
  useStore,
  weekKeys,
} from '../../store';
import { color, font, leading, motion, radius, size, space, touch, type } from '../../theme';
import { WARMUP, dayProgress, setText, subtitleOf, titleOf } from '../../workout';
import { levelFor, rankFor, totalXp } from '../../xp';

export default function TodayScreen() {
  const { state, update } = useStore();
  const reduce = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const now = new Date();
  const date = todayKey(now);
  const scheduled = state.week[now.getDay()];
  const [picked, setPicked] = useState<string | null>(null);
  // A switch booked for "next Monday" kicks in when that day arrives.
  useEffect(() => update((s) => applyPending(s, date)), [date, update]);
  // Picked day, else the workout already started today, else the scheduled one.
  const chosen = dayById(state, picked ?? state.sessions[date]?.dayId ?? scheduled);
  // With injury mode on, a day of only leg/ab work becomes a rest day instead of an empty workout.
  const hiddenDay = chosen && !dayHasWork(state, chosen.id) ? chosen : undefined;
  const day = hiddenDay ? undefined : chosen;
  const program = activeProgram(state);
  const pending = state.pending ? programById(state, state.pending.programId) : undefined;
  const progress = day ? dayProgress(state, day, date) : null;
  const started = !!progress && progress.done > 0;
  const finished = !!state.sessions[date]?.finishedAt;
  const lvl = levelFor(totalXp(state));
  const rank = rankFor(lvl.level);
  // The deck opens on the next unfinished exercise; swiping moves it within the current day.
  const nextIdx = progress ? Math.max(0, progress.statuses.findIndex((x) => !x.complete)) : 0;
  const [deck, setDeck] = useState<{ day?: string; i: number }>({ i: 0 });
  const deckIndex = deck.day === day?.id ? deck.i : nextIdx;
  const setDeckIndex = (i: number) => setDeck({ day: day?.id, i });

  const items: DeckItem[] = !day || !progress
    ? []
    : progress.statuses.map((st, i) => {
      const ex = EXERCISES[st.exerciseId];
      const prev = previousSession(state.logs, st.exerciseId, date);
      const top = prev?.sets.reduce((a, b) => {
        const dw = prMetric(b, ex.kind) - prMetric(a, ex.kind);
        return dw > 0 || (dw === 0 && (num(b.reps) ?? 0) > (num(a.reps) ?? 0)) ? b : a;
      });
      const unit = ex.kind === 'weight_time' || ex.kind === 'time' ? ' s' : ex.kind === 'reps' ? ' reps' : '';
      const paint: DeckItem['paint'] = {};
      for (const m of ex.secondary) paint[m] = { color: color.muscleSecondary };
      for (const m of ex.primary) paint[m] = { color: color.musclePrimary, glow: 0.15 };
      return {
        key: st.plan.slot,
        index: i,
        total: progress.statuses.length,
        name: ex.name,
        target: `${st.plan.sets} × ${st.plan.target}${unit}`,
        last: top ? `Last ${setText(top, ex.kind, state.unit, state.gym)}` : 'First time: set the bar',
        status: st.skipped ? 'skipped' : st.complete ? 'done' : st.done > 0 ? 'partial' : 'todo',
        progress: `${st.done}/${st.plan.sets}`,
        paint,
        muscles: ex.primary.map((m) => MUSCLE_LABEL[m]).join(' · '),
      };
    });

  // ----- Card → exercise expand transition (hand-built shared element) -----
  const deckRef = useRef<React.ComponentRef<typeof View>>(null);
  const [expand, setExpand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const ex = useSharedValue(0);
  const expandStyle = useAnimatedStyle(() => {
    if (!expand) return { opacity: 0 };
    const p = ex.value;
    return {
      opacity: 1,
      left: expand.x * (1 - p),
      top: expand.y * (1 - p),
      width: expand.w + (width - expand.w) * p,
      height: expand.h + (height - expand.h) * p,
      borderRadius: radius.xxl * (1 - p),
    };
  });
  const open = (exerciseId: string, slot: string) =>
    router.push({ pathname: '/exercise/[id]', params: { id: exerciseId, day: day!.id, slot } });

  const startCard = (item: DeckItem) => {
    const st = progress!.statuses[item.index];
    const go = () => {
      open(st.exerciseId, st.plan.slot);
      // Clear the expanding panel once the exercise screen is on top.
      setTimeout(() => {
        setExpand(null);
        ex.set(0);
      }, 450);
    };
    if (reduce || !deckRef.current) return go();
    deckRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
      setExpand({ x, y, w, h: h - space.x3 });
      ex.set(0);
      ex.set(withSpring(1, motion.swipe, (fin) => fin && scheduleOnRN(go)));
    });
  };

  const finish = () => {
    const at = Date.now();
    update((s) => ({
      ...s,
      sessions: { ...s.sessions, [date]: { ...s.sessions[date], dayId: s.sessions[date]?.dayId ?? day!.id, finishedAt: at } },
    }));
    router.push({ pathname: '/complete', params: { date } });
  };

  const nextTraining = (() => {
    for (let i = 1; i <= 7; i++) {
      const id = state.week[(now.getDay() + i) % 7];
      if (id && dayHasWork(state, id)) return { when: i === 1 ? 'tomorrow' : `on ${WEEKDAY_LONG[(now.getDay() + i) % 7]}`, id };
    }
    return null;
  })();

  const warmDone = !!state.warmups[date];
  const suppsDone = allTaken(state, date);
  // Battle pass: one tile per weekday that has a workout in your day order (Mon-first).
  const pass = weekKeys(date)
    .map((d) => ({ d, wd: new Date(d.replace(/-/g, '/')).getDay() }))
    .filter((x) => dayHasWork(state, state.week[x.wd]))
    .map((x) => ({ ...x, id: state.week[x.wd]! }));
  const ringSize = Math.min(150, width * 0.36);

  return (
    <View style={{ flex: 1 }}>
      <Screen padBottom={140}>
        {/* Header: rotating line, rank, streaks */}
        <View style={s.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.date}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            <Text style={s.greet} numberOfLines={2}>
              {line(day ? GREETING : REST_DAY, date)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: space.xs }}>
            <Flame count={trainingStreak(state)} label="training" />
            <View style={s.rank} accessibilityLabel={`Level ${lvl.level}, ${rank.name}`}>
              <Icon name="bolt" size={14} color={color.lime} filled />
              <Text style={s.rankText}>
                {rank.name} · L{lvl.level}
              </Text>
            </View>
          </View>
        </View>

        {/* Hero: day name huge, ring breaking out of the card's corner */}
        {day && progress ? (
          <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(16)} style={{ marginTop: space.xxl }}>
            <Glass strong glow={color.lime} r={radius.xxl} style={s.hero}>
              <Text style={s.dayTag}>{WEEKDAY_SHORT[state.week.indexOf(day.id)] ?? ''}</Text>
              <Text style={s.dayTitle} numberOfLines={2} adjustsFontSizeToFit>
                {titleOf(day)}
              </Text>
              <Text style={s.focus} numberOfLines={2}>
                {subtitleOf(day)}
              </Text>
              <View style={{ marginTop: space.xl, alignSelf: 'flex-start' }}>
                {finished ? (
                  <Badge label="Workout complete" icon="check" />
                ) : (
                  <Button
                    label={progress.allDone ? 'Finish workout' : started ? 'Continue' : 'Start workout'}
                    iconRight="arrowRight"
                    onPress={() => (progress.allDone ? finish() : progress.next && open(progress.next.exerciseId, progress.next.plan.slot))}
                  />
                )}
              </View>
            </Glass>
            <View style={[s.ringWrap, { width: ringSize, height: ringSize }]} pointerEvents="none">
              <Ring progress={progress.total ? progress.done / progress.total : 0} size={ringSize} stroke={12}>
                <CountUp to={progress.done} style={s.ringNum} />
                <Text style={s.ringOf}>of {progress.total} sets</Text>
              </Ring>
            </View>
          </Animated.View>
        ) : (
          <Glass strong r={radius.xxl} style={[s.hero, { marginTop: space.xxl }]}>
            <Icon name="moon" size={36} color={color.lime} filled />
            <Text style={s.dayTitle}>Rest Day</Text>
            <Text style={s.focus}>
              {hiddenDay
                ? `${hiddenDay.name} is resting while injury mode is on.`
                : nextTraining
                  ? `${titleOf(dayById(state, nextTraining.id)!)} is ${nextTraining.when}.`
                  : 'Recover and refuel.'}
            </Text>
          </Glass>
        )}

        {/* Program chip: what you're running and the way to change it */}
        <Press onPress={() => router.push('/programs')} style={s.program} accessibilityRole="button" accessibilityLabel={`Program: ${program.name}. Change program`}>
          <Icon name="layers" size={18} color={color.lime} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.programName} numberOfLines={1}>
              {program.name}
            </Text>
            {pending && state.pending && (
              <Text style={s.programPending} numberOfLines={1}>
                Switching to {pending.name} on {WEEKDAY_SHORT[dateFromKey(state.pending.from).getDay()]} {formatDate(state.pending.from)}
              </Text>
            )}
          </View>
          <Text style={s.programChange}>Programs</Text>
          <Icon name="next" size={16} color={color.muted} />
        </Press>

        {easingIn(state, date) && (
          <Glass style={s.ease} r={radius.xl} glow={color.lime}>
            <View style={s.warmHead}>
              <Icon name="bandage" size={24} color={color.lime} />
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>Welcome back. Ease in.</Text>
                <Text style={type.small}>
                  For your first 2 weeks, start leg and ab work at about half your old weights and stop 3–4 reps short of failure. Add load only when it feels easy.
                </Text>
              </View>
            </View>
            <View style={{ alignSelf: 'flex-end' }}>
              <Button size="sm" variant="ghost" label="Got it" onPress={() => update((st) => ({ ...st, easeInDismissed: true }))} />
            </View>
          </Glass>
        )}

        {/* Battle pass: training days fill in as you complete them */}
        <View style={s.passHead}>
          <Text style={type.h2}>This week</Text>
          <Text style={s.passCount}>
            {pass.filter((x) => trainedOn(state, x.d)).length}/{pass.length}
          </Text>
        </View>
        <View style={s.pass}>
          {pass.map(({ d, wd, id }, i) => {
            const done = trainedOn(state, d);
            const isToday = d === date;
            const tile = (
              <Press
                key={d}
                onPress={() => setPicked(id)}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAY_SHORT[wd]}: ${done ? 'done' : isToday ? 'today' : 'not done'}`}
                style={[s.passTile, done && s.passDone, isToday && !done && s.passToday, id === day?.id && s.passSel]}
              >
                {done ? <Icon name="check" size={22} color={color.ink} /> : <Text style={[s.passNum, isToday && { color: color.lime }]}>{i + 1}</Text>}
                <Text style={[s.passDay, done && { color: color.ink }]}>{WEEKDAY_SHORT[wd]}</Text>
              </Press>
            );
            return isToday && !done ? (
              <Pulse key={d} scale={1.06}>
                {tile}
              </Pulse>
            ) : (
              tile
            );
          })}
        </View>

        {!suppsDone && (
          <Press onPress={() => router.navigate('/supplements')} style={s.nudge} accessibilityRole="button" glow={color.pink}>
            <Icon name="flask" size={20} color={color.pink} filled />
            <Text style={s.nudgeText} numberOfLines={1}>
              {state.supplements.filter((x) => !state.taken[date]?.[x]).join(' + ')} not taken yet
            </Text>
            <Press
              onPress={() => {
                haptic.setDone();
                update((st) => ({ ...st, taken: { ...st.taken, [date]: Object.fromEntries(st.supplements.map((x) => [x, true])) } }));
              }}
              style={s.nudgeBtn}
              accessibilityRole="button"
              accessibilityLabel="Mark supplements taken"
            >
              <Text style={s.nudgeBtnText}>Taken</Text>
            </Press>
          </Press>
        )}

        {day && progress && (
          <>
            <Glass style={s.warm} r={radius.xl}>
              <View style={s.warmHead}>
                <Icon name={warmDone ? 'checkCircle' : 'flame'} size={26} color={color.lime} filled={warmDone} />
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>5-minute warm-up</Text>
                  <Text style={type.small}>{warmDone ? 'Joints are ready. Go get it.' : 'Shoulders, elbows and wrists first.'}</Text>
                </View>
                <Button
                  size="sm"
                  variant={warmDone ? 'secondary' : 'default'}
                  label={warmDone ? 'Undo' : 'Done'}
                  accessibilityLabel="Warm-up done"
                  onPress={() => update((st) => ({ ...st, warmups: { ...st.warmups, [date]: !warmDone } }))}
                />
              </View>
              {!warmDone &&
                WARMUP.map((w) => (
                  <View key={w.text} style={s.warmRow}>
                    <View style={s.warmDot} />
                    <Text style={[type.small, { flex: 1, color: color.text }]}>{w.text}</Text>
                  </View>
                ))}
            </Glass>

            {day.pressNote && (
              <Glass style={s.note} r={radius.lg}>
                <Icon name="alert" size={22} color={color.pink} />
                <Text style={[type.small, { flex: 1, color: color.text }]}>{day.pressNote}</Text>
              </Glass>
            )}

            <View style={s.passHead}>
              <Text style={type.h2}>Swipe to train</Text>
              <Text style={type.small}>→ start · ← next</Text>
            </View>
            <View ref={deckRef} collapsable={false}>
              <SwipeDeck items={items} index={deckIndex} onIndex={setDeckIndex} onStart={startCard} />
            </View>
            <View style={s.deckBtns}>
              <Button variant="secondary" icon="next" label="Next" onPress={() => setDeckIndex((deckIndex + 1) % items.length)} />
              <View style={{ flex: 1 }}>
                <Button label={`Start ${items[deckIndex]?.name ?? ''}`} iconRight="arrowRight" onPress={() => items[deckIndex] && startCard(items[deckIndex])} />
              </View>
            </View>

            {started && !finished && !progress.allDone && (
              <View style={{ marginTop: space.lg }}>
                <Button variant="ghost" icon="flag" label="Finish early" onPress={finish} />
              </View>
            )}
          </>
        )}
      </Screen>
      {expand && <Animated.View pointerEvents="none" style={[s.expand, expandStyle]} />}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  date: { ...type.label, color: color.lime },
  greet: { fontFamily: font.display, fontSize: size.h2, lineHeight: leading.h2, color: color.text, marginTop: space.xs },
  rank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.limeDim,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  rankText: { fontFamily: font.bodyBlack, fontSize: size.label, color: color.lime },
  hero: { padding: space.xxl, paddingTop: space.x4, minHeight: 260 },
  dayTag: { ...type.label, color: color.lime },
  dayTitle: { fontFamily: font.display, fontSize: size.numXL, lineHeight: leading.numXL, letterSpacing: -2, color: color.text, marginTop: space.xs, maxWidth: '62%' },
  focus: { ...type.bodyMuted, marginTop: space.sm, maxWidth: '62%' },
  ringWrap: { position: 'absolute', right: -space.sm, top: -space.xxl },
  ringNum: { fontFamily: font.display, fontSize: size.hero, color: color.text, fontVariant: ['tabular-nums'] },
  ringOf: { fontFamily: font.bodyBold, fontSize: size.tiny, color: color.muted },
  passHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.x4, marginBottom: space.md },
  passCount: { fontFamily: font.display, fontSize: size.h2, color: color.lime },
  pass: { flexDirection: 'row', gap: space.sm },
  passTile: {
    flex: 1,
    aspectRatio: 0.8,
    minHeight: touch.min,
    borderRadius: radius.lg,
    backgroundColor: color.glassSolid,
    borderWidth: 1,
    borderColor: color.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  passDone: { backgroundColor: color.lime, borderColor: color.lime },
  passToday: { borderColor: color.lime, borderWidth: 2 },
  passSel: { borderColor: color.text, borderWidth: 2 },
  passNum: { fontFamily: font.display, fontSize: size.h2, color: color.text },
  passDay: { fontFamily: font.bodyBlack, fontSize: size.tiny, color: color.muted },
  nudge: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.pinkDim,
    borderWidth: 1,
    borderColor: color.pinkGlow,
    borderRadius: radius.xl,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    minHeight: 64,
  },
  nudgeText: { flex: 1, fontFamily: font.bodyBold, fontSize: size.small, color: color.text },
  nudgeBtn: { backgroundColor: color.pink, borderRadius: radius.pill, paddingHorizontal: space.xl, minHeight: touch.min, justifyContent: 'center' },
  nudgeBtnText: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.ink },
  warm: { marginTop: space.lg, padding: space.lg, gap: space.sm },
  warmHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  warmRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.sm, minHeight: 26 },
  warmDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: color.lime },
  note: { marginTop: space.md, flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.lg },
  deckBtns: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  program: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.primary,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.glassSolid,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  programName: { fontFamily: font.bodyBold, fontSize: size.small, color: color.text },
  programPending: { fontFamily: font.bodyBold, fontSize: size.tiny, color: color.lime, marginTop: 2 },
  programChange: { fontFamily: font.bodyBlack, fontSize: size.label, color: color.lime },
  ease: { marginTop: space.md, padding: space.lg, gap: space.sm },
  expand: { position: 'absolute', backgroundColor: color.bgRaised, borderWidth: 1, borderColor: color.glassBorder },
});

