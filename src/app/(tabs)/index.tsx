import { router } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Glass } from '../../components/glass';
import { RestSetupSheet, restSetupDone, restSetupStatus } from '../../components/RestSetup';
import { Icon } from '../../components/icons';
import { CountUp } from '../../components/motion';
import { Button, Flame, Press, Ring, Screen } from '../../components/ui';
import { GREETING, REST_DAY, line } from '../../copy';
import { crumb, logCrash } from '../../crash';
import { EXERCISES } from '../../data/exercises';
import { MUSCLE_LABEL } from '../../data/muscles';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../../data/program';
import { haptic } from '../../feedback';
import {
  activeProgram,
  addDays,
  allTaken,
  applyPending,
  dateFromKey,
  dayById,
  dayHasWork,
  finishedOn,
  formatDate,
  programById,
  todayKey,
  trainedOn,
  trainingStreak,
  useStore,
  weekKeys,
} from '../../store';
import { bottomClearance, color, currentScheme, floating, font, leading, motion, radius, size, space, themed, touch, type } from '../../theme';
import { WARMUP, dayProgress, nextInRotation, subtitleOf, titleOf, todayDayId } from '../../workout';
import { perfMark } from '../../perf';

export default function TodayScreen() {
  const { state, update, commit, saveBlocked } = useStore();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  // Real heights, measured: the tab bar (incl. gesture-bar inset) and the floating main button.
  const tabBar = useContext(BottomTabBarHeightContext);
  const [ctaH, setCtaH] = useState<number>(floating.action);
  const now = new Date();
  const date = todayKey(now);
  const weekday = now.getDay();
  // A day tapped in the week strip: shown as a preview, with a clear way back to today.
  const [picked, setPicked] = useState<{ id: string; wd: number; d: string } | null>(null);
  useEffect(() => perfMark('today-ready'), []);
  // First launch (Android): ask once to keep the rest timer on time (battery optimisation, exact
  // alarms). Only shown when something is actually missing; always reachable again in Settings.
  const [restSetup, setRestSetup] = useState(false);
  useEffect(() => {
    if (state.restSetupAsked) return;
    let live = true;
    restSetupStatus()
      .then((st) => {
        if (!live) return;
        update((s) => ({ ...s, restSetupAsked: true }));
        if (!restSetupDone(st)) setRestSetup(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A switch booked for "next Monday" kicks in when that day arrives.
  useEffect(() => update((s) => applyPending(s, date)), [date, update]);
  const which = todayDayId(state, date, weekday, picked?.id);
  const chosen = dayById(state, which.id);
  // A day with no exercises (e.g. emptied in the plan builder) shows as a rest day.
  const hiddenDay = chosen && !dayHasWork(state, chosen.id) ? chosen : undefined;
  const day = hiddenDay ? undefined : chosen;
  const program = activeProgram(state);
  const pending = state.pending ? programById(state, state.pending.programId) : undefined;
  // The date being looked at: today, or the tapped day (a past day shows what you did that day).
  const viewDate = picked?.d ?? date;
  const progress = day ? dayProgress(state, day, viewDate) : null;
  const started = !!progress && progress.done > 0;
  // Done only when the workout was finished with sets logged (never "Done" with 0 sets).
  const finished = finishedOn(state, viewDate);

  const openExercise = (exerciseId: string, slot: string) =>
    router.push({ pathname: '/exercise/[id]', params: { id: exerciseId, day: day!.id, slot } });
  const openWorkout = () => {
    perfMark('tap-start');
    haptic.tap();
    router.push({ pathname: '/workout', params: { day: day!.id } });
  };

  // Save the finished session to disk first; only then open the celebration, so a crash there
  // can never lose the workout.
  const [finishing, setFinishing] = useState(false);
  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    crumb('finish workout (Today)');
    const at = Date.now();
    await commit((s) => ({
      ...s,
      sessions: { ...s.sessions, [date]: { ...s.sessions[date], dayId: s.sessions[date]?.dayId ?? day!.id, finishedAt: at } },
    })).catch((e) => logCrash('error', e, 'saving finished workout'));
    setFinishing(false);
    router.push({ pathname: '/complete', params: { date } });
  };

  const nextTraining = (() => {
    if (program.rotation) {
      // After today's session (or today, if not trained yet), the next day in the rotation.
      const id = trainedOn(state, date) ? nextInRotation(state, addDays(date, 1)) : which.scheduled;
      return id && dayById(state, id) ? { when: trainedOn(state, date) ? 'next' : 'up today', id } : null;
    }
    for (let i = 1; i <= 7; i++) {
      const id = state.week[(weekday + i) % 7];
      if (id && dayHasWork(state, id)) return { when: i === 1 ? 'tomorrow' : `on ${WEEKDAY_LONG[(weekday + i) % 7]}`, id };
    }
    return null;
  })();

  const warmDone = !!state.warmups[date];
  const suppsDone = allTaken(state, date);
  // One tile per weekday that has a workout in your day order (Mon-first).
  // Rotating plans have no weekdays: every day of the week gets a tile, showing the day you trained
  // on it (or today's next day); the count is out of the rotation's length.
  const pass = program.rotation
    ? weekKeys(date)
        .map((d) => ({ d, wd: dateFromKey(d).getDay(), id: (trainedOn(state, d) ? state.sessions[d]?.dayId : d === date ? which.scheduled : null) ?? '' }))
    : weekKeys(date)
        .map((d) => ({ d, wd: dateFromKey(d).getDay() }))
        // Your training weekdays, plus any other day you trained on (it counts too).
        .filter((x) => dayHasWork(state, state.week[x.wd]) || trainedOn(state, x.d))
        .map((x) => ({ ...x, id: (dayHasWork(state, state.week[x.wd]) ? state.week[x.wd] : state.sessions[x.d]?.dayId) ?? '' }));
  const passDone = pass.filter((x) => trainedOn(state, x.d)).length;
  // One pass through the plan is the goal; training more never reads "6 of 5".
  const scheduledCount = program.rotation ? Math.min(7, program.days.length) : pass.filter((x) => dayHasWork(state, state.week[x.wd])).length;
  const passPlanned = Math.max(passDone, scheduledCount);
  const shownWd = picked ? picked.wd : weekday;
  const mins = progress ? Math.round(progress.total * 2.6) : 0;
  // Looking at another day (a preview, or a past day in the strip): the button only ever trains that
  // day today; it never finishes or continues a past date.
  const trainToday = which.preview || viewDate !== date;
  // Today's card always has a way in: Start, Continue, Finish, or Train again once truly done.
  const cta = trainToday ? 'Train' : finished ? 'Train again' : progress?.allDone ? 'Finish workout' : started ? 'Continue' : 'Start workout';

  return (
    <View style={{ flex: 1 }}>
      <Screen padBottom={cta && day ? floating.gap + ctaH + bottomClearance.tabs : bottomClearance.tabs}>
        {/* Header: date, a quiet line, streak and level */}
        <View style={s.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.date} accessibilityLiveRegion="polite">
              {longDate(viewDate)}
            </Text>
            <Text style={s.greet} numberOfLines={2}>
              {line(day ? GREETING : REST_DAY, date)}
            </Text>
          </View>
          <Flame count={trainingStreak(state)} label="training" />
        </View>

        {which.preview && (
          <View style={s.preview} accessibilityLiveRegion="polite">
            <Icon name="calendar" size={18} color={color.muted} />
            <Text style={s.previewText} numberOfLines={1}>
              Previewing {WEEKDAY_LONG[shownWd]}
            </Text>
            <Button size="sm" variant="outline" label="Back to today" onPress={() => setPicked(null)} />
          </View>
        )}

        {/* Hero: the day, lit from above; the ring sits inside the card */}
        {day && progress ? (
          <Animated.View entering={reduce ? undefined : FadeIn.duration(motion.base)} style={{ marginTop: which.preview ? space.md : space.x4 }}>
            <Glass strong r={radius.xxl} style={s.hero}>
              <View style={s.heroRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.dayTag}>
                    {which.preview ? WEEKDAY_SHORT[shownWd] : `Today · ${WEEKDAY_SHORT[weekday]}`}
                  </Text>
                  <Text style={s.dayTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {titleOf(day)}
                  </Text>
                  <Text style={s.focus} numberOfLines={2}>
                    {subtitleOf(day)}
                  </Text>
                </View>
                <Ring progress={progress.total ? progress.done / progress.total : 0} size={RING} stroke={currentScheme() === 'light' ? 8 : 4} track={color.ringTrack}>
                  <CountUp to={progress.done} style={[s.ringNum, progress.done > 0 && { color: color.accent }]} />
                  <Text style={s.ringOf}>of {progress.total}</Text>
                </Ring>
              </View>
              <View style={s.heroMeta}>
                <Text style={s.metaText}>{progress.statuses.length} exercises</Text>
                <View style={s.metaDot} />
                <Text style={s.metaText}>~{mins} min</Text>
                {finished && (
                  <>
                    <View style={s.metaDot} />
                    <Text style={[s.metaText, { color: color.accentText }]}>Done</Text>
                  </>
                )}
              </View>
              {which.swappedDay && !which.preview && (
                <Text style={[type.small, { marginTop: space.sm }]}>You started this workout today instead of the scheduled one.</Text>
              )}
            </Glass>
          </Animated.View>
        ) : (
          <Glass strong r={radius.xxl} style={[s.hero, { marginTop: space.x4 }]}>
            <Icon name="moon" size={28} color={color.muted} />
            <Text style={[s.dayTitle, { marginTop: space.md }]}>Rest day</Text>
            <Text style={s.focus}>
              {nextTraining
                  ? `${titleOf(dayById(state, nextTraining.id)!)} is ${nextTraining.when}.`
                  : 'Recover and refuel.'}
            </Text>
          </Glass>
        )}


        {/* The week: done days get a thin crimson check, today a thin crimson edge */}
        <View style={s.sectionHead}>
          <Text style={type.label}>This week</Text>
          <Text style={s.sectionCount}>
            {passDone} of {passPlanned}
          </Text>
        </View>
        <View style={s.pass}>
          {pass.map(({ d, wd, id }) => {
            const done = trainedOn(state, d);
            const isToday = d === date;
            const sel = wd === shownWd;
            return (
              <Press
                key={d}
                disabled={!id}
                onPress={() => {
                  if (!id) return;
                  haptic.tap();
                  setPicked(isToday ? null : { id, wd, d });
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`${WEEKDAY_LONG[wd]}${isToday ? ', today' : ''}${done ? ', done' : ''}${sel ? ', selected' : ''}`}
                style={[s.passTile, sel && s.passSel]}
              >
                <Text style={[s.passDay, sel && s.passDaySel]}>{WEEKDAY_SHORT[wd]}</Text>
                {/* ✓ for a trained day (solid crimson in light mode), a dot for today. */}
                {done ? (
                  <View style={[s.passDone, !sel && { backgroundColor: color.doneBg }]}>
                    <Icon name="check" size={16} color={sel ? color.selCheck : color.doneFg} />
                  </View>
                ) : (
                  <View style={[s.passDot, isToday && s.passDotToday, sel && isToday && { backgroundColor: color.selFg }]} />
                )}
              </Press>
            );
          })}
        </View>

        {saveBlocked && (
          <Glass style={[s.card, s.row]} r={radius.xl} testID="save-blocked">
            <Icon name="alert" size={20} color={color.warn} />
            <Text style={[s.rowText, { flex: 1 }]}>
              Your saved workouts couldn’t be read just now, so nothing is being saved. Still trying; if this stays, close and reopen the app.
            </Text>
          </Glass>
        )}

        {!!state.restoreNote?.dates.length && (
          <Glass style={[s.card, s.row]} r={radius.xl} testID="restore-note">
            <Icon name="check" size={20} color={color.accent} />
            <Text style={[s.rowText, { flex: 1 }]}>
              Brought back {state.restoreNote.dates.length === 1 ? 'a workout' : `${state.restoreNote.dates.length} workouts`} from an older copy on this phone:{' '}
              {state.restoreNote.dates.map((d) => `${WEEKDAY_SHORT[dateFromKey(d).getDay()]} ${formatDate(d)}`).join(', ')}
            </Text>
            <Button size="sm" variant="ghost" label="OK" accessibilityLabel="Dismiss the restored workouts note" onPress={() => update((st) => ({ ...st, restoreNote: null }))} />
          </Glass>
        )}

        {state.supplements.length > 0 && !suppsDone && (
          <Glass style={[s.card, s.row]} r={radius.xl}>
            <Icon name="flask" size={20} color={color.muted} />
            <Text style={[s.rowText, { flex: 1 }]} numberOfLines={2}>
              {state.supplements.filter((x) => !state.taken[date]?.[x]).join(' + ')} not taken yet
            </Text>
            <Button
              size="sm"
              label="Taken"
              accessibilityLabel="Mark supplements taken"
              onPress={() => {
                haptic.setDone();
                update((st) => ({ ...st, taken: { ...st.taken, [date]: Object.fromEntries(st.supplements.map((x) => [x, true])) } }));
              }}
            />
          </Glass>
        )}

        {day && progress && (
          <>
            {!which.preview && (
              <Glass style={s.card} r={radius.xl}>
                <View style={s.row}>
                  <Icon name={warmDone ? 'checkCircle' : 'flame'} size={22} color={warmDone ? color.accent : color.muted} filled={warmDone} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={type.h3}>5-minute warm-up</Text>
                    <Text style={type.small}>{warmDone ? 'Joints are ready.' : 'Shoulders, elbows and wrists first.'}</Text>
                  </View>
                  <Button
                    size="sm"
                    variant={warmDone ? 'ghost' : 'outline'}
                    label={warmDone ? 'Undo' : 'Done'}
                    accessibilityLabel="Warm-up done"
                    onPress={() => update((st) => ({ ...st, warmups: { ...st.warmups, [date]: !warmDone } }))}
                  />
                </View>
                {!warmDone &&
                  WARMUP.map((w) => (
                    <View key={w.text} style={s.warmRow}>
                      <View style={s.warmDot} />
                      <Text style={[type.small, { flex: 1 }]}>{w.text}</Text>
                    </View>
                  ))}
              </Glass>
            )}

            {day.pressNote && (
              <View style={[s.row, s.note]}>
                <Icon name="alert" size={20} color={color.muted} />
                <Text style={[type.small, { flex: 1 }]}>{day.pressNote}</Text>
              </View>
            )}

            <View style={s.sectionHead}>
              <Text style={type.label}>Exercises</Text>
              <Text style={s.sectionCount}>
                {progress.statuses.filter((x) => x.complete).length} of {progress.statuses.length}
              </Text>
            </View>
            <Glass r={radius.xl} style={s.list}>
              {progress.statuses.map((st, i) => {
                const ex = EXERCISES[st.exerciseId];
                const unit = ex.kind === 'weight_time' || ex.kind === 'time' ? ' s' : '';
                return (
                  <Press
                    key={st.plan.slot}
                    onPress={() => openExercise(st.exerciseId, st.plan.slot)}
                    style={[s.exRow, i > 0 && s.exRowLine]}
                    accessibilityRole="button"
                    accessibilityLabel={`${ex.name} details, ${st.done} of ${st.plan.sets} sets`}
                  >
                    <View style={[s.exState, st.complete && s.exStateDone]}>
                      {st.complete ? <Icon name="check" size={14} color={color.accent} /> : <Text style={s.exIdx}>{i + 1}</Text>}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.exName, st.complete && { color: color.muted }]} numberOfLines={1}>
                        {ex.name}
                      </Text>
                      <Text style={type.small} numberOfLines={1}>
                        {st.plan.sets} × {st.plan.target}
                        {unit} · {ex.primary.map((m) => MUSCLE_LABEL[m]).slice(0, 2).join(', ')}
                      </Text>
                    </View>
                    <Text style={s.exCount}>
                      {st.done}/{st.plan.sets}
                    </Text>
                  </Press>
                );
              })}
            </Glass>

            {started && !finished && !progress.allDone && !which.preview && (
              <View style={{ marginTop: space.lg }}>
                <Button variant="ghost" icon="flag" label="Finish early" onPress={finish} />
              </View>
            )}
          </>
        )}

        {/* Program: what you're running, and the way to change it */}
        <Press onPress={() => router.push('/programs')} style={s.program} accessibilityRole="button" accessibilityLabel={`Program: ${program.name}. Change program`}>
          <Icon name="layers" size={18} color={color.muted} />
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
          <Icon name="next" size={16} color={color.subtle} />
        </Press>
      </Screen>

      {/* The main action, in thumb reach above the tab bar */}
      {day && progress && cta && (
        <View
          style={[s.ctaBar, { bottom: (tabBar || insets.bottom + floating.tabBar) + floating.gap }]}
          pointerEvents="box-none"
          onLayout={(e) => setCtaH(e.nativeEvent.layout.height)}
        >
          <LinearGradient colors={[color.fadeFrom, color.bg, color.bg]} locations={[0, 0.4, 1]} style={s.ctaFade} pointerEvents="none" />
          <View style={{ zIndex: 1, position: 'relative' }}>
            <Button size="lg" label={trainToday ? `Train ${titleOf(day)} today` : cta} iconRight="arrowRight" onPress={!trainToday && !finished && progress.allDone ? finish : openWorkout} />
          </View>
        </View>
      )}
      {restSetup && <RestSetupSheet onClose={() => setRestSetup(false)} />}
    </View>
  );
}

const RING = 84;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Tuesday, 24 Nov" */
const longDate = (key: string) => {
  const d = dateFromKey(key);
  return `${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

const s = themed(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  date: { ...type.label },
  greet: { fontFamily: font.displayBold, fontSize: size.h3, lineHeight: 24, color: color.muted, marginTop: space.sm },
  preview: {
    marginTop: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.glassBorder,
    backgroundColor: color.surface,
  },
  previewText: { flex: 1, fontFamily: font.bodyBold, fontSize: size.small, color: color.text },
  hero: { padding: space.xxl },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  dayTag: { ...type.label },
  dayTitle: { fontFamily: font.display, fontSize: size.display, lineHeight: leading.display, letterSpacing: -0.6, color: color.text, marginTop: space.sm },
  focus: { ...type.bodyMuted, marginTop: space.xs },
  ringNum: { fontFamily: font.display, fontSize: size.h2, color: color.keyNum, fontVariant: ['tabular-nums'] },
  ringOf: { fontFamily: font.bodyBold, fontSize: size.tiny, color: color.subtle },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: color.line },
  metaText: { fontFamily: font.bodySemi, fontSize: size.small, color: color.muted },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: color.subtle },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.x4, marginBottom: space.md },
  sectionCount: { fontFamily: font.bodySemi, fontSize: size.small, color: color.countFg, fontVariant: ['tabular-nums'] },
  pass: { flexDirection: 'row', gap: space.sm },
  passTile: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  passSel: { borderColor: color.selEdge, borderWidth: 2, backgroundColor: color.selBg },
  passDaySel: { color: color.selFg },
  passDone: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  passDotToday: { backgroundColor: color.accent },
  passDay: { fontFamily: font.bodyBold, fontSize: size.label, color: color.subtle, letterSpacing: 0.4 },
  passDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.surface3 },
  card: { marginTop: space.lg, padding: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { fontFamily: font.bodySemi, fontSize: size.small, color: color.text },
  warmRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.xxl + space.sm, minHeight: 24 },
  warmDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.subtle },
  note: { marginTop: space.lg, paddingHorizontal: space.xs },
  list: { paddingVertical: space.xs },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.lg, borderRadius: radius.lg },
  exRowLine: { borderTopWidth: 1, borderTopColor: color.line, borderRadius: 0 },
  exState: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: color.glassBorder, alignItems: 'center', justifyContent: 'center' },
  exStateDone: { borderColor: color.accentEdge },
  exIdx: { fontFamily: font.bodyBold, fontSize: size.tiny, color: color.subtle },
  exName: { fontFamily: font.bodyBold, fontSize: size.body, color: color.text },
  exCount: { fontFamily: font.bodySemi, fontSize: size.small, color: color.subtle, fontVariant: ['tabular-nums'] },
  program: {
    marginTop: space.x4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.primary,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  programName: { fontFamily: font.bodyBold, fontSize: size.small, color: color.text },
  programPending: { fontFamily: font.bodyBold, fontSize: size.tiny, color: color.accentText, marginTop: 2 },
  programChange: { fontFamily: font.bodyBold, fontSize: size.label, color: color.muted },
  ctaBar: { position: 'absolute', left: space.lg, right: space.lg },
  ctaFade: { position: 'absolute', left: -space.lg, right: -space.lg, top: -space.x4, bottom: -(floating.tabBar + floating.gap) },
}));

// One bad screen shows a recovery panel for that screen only; it never takes the app down.
export { RouteError as ErrorBoundary } from '../../components/RouteError';
