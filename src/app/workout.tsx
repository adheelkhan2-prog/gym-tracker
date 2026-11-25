import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideInRight, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExerciseMedia, HowToSteps, MuscleLegend, SwapSheet, Tips, mediaCredit, mediaFor } from '../components/ExerciseParts';
import { VideoPoolProvider } from '../components/VideoPool';
import { OwnVideoButtons } from '../components/ImportVideo';
import { Backdrop, Glass } from '../components/glass';
import { Icon } from '../components/icons';
import { Burst, Flash } from '../components/motion';
import { RestTimer } from '../components/RestRing';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { Badge, Button, IconButton, Press } from '../components/ui';
import { crumb, logCrash } from '../crash';
import { EQUIPMENT_LABEL, EXERCISES } from '../data/exercises';
import { pickOption, restFor } from '../data/program';
import { swapsFor } from '../data/swaps';
import { haptic } from '../feedback';
import { fmtKg, fromKg, loadTypeOf, loadTypesFor, round1, type LoadType } from '../load';
import { restCarry } from '../restCarry';
import { missingFor, stepOf, suggestSet, weightIn } from '../sets';
import { bestBefore, dayById, hasLoggedSets, kgOf, prMetric, todayKey, useStore, type SetEntry, type State } from '../store';
import { color, fmtClock, font, motion, radius, size, space, themed, touch, type } from '../theme';
import { setText, slotStatuses, swapSlot, titleOf, type SlotStatus } from '../workout';
import { bigJump, weeklyTarget } from '../weekly';
import { perfMark } from '../perf';

type Missing = {
  slot: string;
  i: number;
  load: boolean;
  reps: boolean;
  message: string;
};

/**
 * The workout, one exercise per page: its video (or images), this week's target, the set rows
 * (pre-filled, one tap to log) and the how-to notes, collapsible, underneath. "Next exercise" at the
 * bottom (crimson once every set is logged) and "Previous"; swiping left/right does the same. The
 * bar at the top ("Exercise 2 of 7") opens the full list to jump around. The last page has "Finish
 * workout". Rest timer, swap, PR moment and Log-set validation work on every page. The session is
 * saved before the finish screen opens, and only when sets were logged.
 */
export default function WorkoutScreen() {
  const params = useLocalSearchParams<{ day?: string }>();
  const { state, update, commit } = useStore();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const date = todayKey();
  const day = dayById(state, params.day);
  const statuses = day ? slotStatuses(state, day, date) : [];
  const total = statuses.reduce((a, x) => a + x.plan.sets, 0);
  const done = statuses.reduce((a, x) => a + Math.min(x.done, x.plan.sets), 0);

  // Open on the first exercise that still has sets to do.
  const [page, setPage] = useState(() => Math.max(0, statuses.findIndex((x) => !x.complete)));
  const [dir, setDir] = useState<1 | -1>(1);
  const [listOpen, setListOpen] = useState(false);
  // Typed-but-not-logged values per exercise survive moving between pages.
  const [drafts, setDrafts] = useState<Record<string, Record<number, SetEntry>>>({});
  const [restEnd, setRestEnd] = useState<number | null>(() => (restCarry.endsAt && restCarry.endsAt > Date.now() ? restCarry.endsAt : null));
  const [restTotal, setRestTotal] = useState(restCarry.total);
  const [restNext, setRestNext] = useState('');
  const [pr, setPr] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [swapFor, setSwapFor] = useState<SlotStatus | null>(null);
  const focused = useIsFocused();
  const [videoSheet, setVideoSheet] = useState(false);
  const [navH, setNavH] = useState(88);
  const finishing = useRef(false);
  useEffect(() => perfMark('workout-ready'), []);
  useEffect(() => {
    restCarry.endsAt = restEnd;
    restCarry.total = restTotal;
  }, [restEnd, restTotal]);

  const count = statuses.length;
  const at = Math.min(page, Math.max(0, count - 1));
  const goTo = (i: number) => {
    if (i < 0 || i >= count || i === at) return;
    haptic.tap();
    perfMark(`page-${i}`);
    setDir(i > at ? 1 : -1);
    setPage(i);
  };

  // Swipe left / right between exercises. Only a clearly sideways drag counts: anything vertical
  // fails this gesture at once, so the page scrolls even when the swipe starts on a set box.
  const dragX = useSharedValue(0);
  const swipeTo = (d: number) => goTo(at + d);
  const pan = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      'worklet';
      dragX.set(e.translationX * 0.35);
    },
    onDeactivate: (e) => {
      'worklet';
      dragX.set(withSpring(0, motion.spring));
      const go = e.translationX < -70 || e.velocityX < -700 ? 1 : e.translationX > 70 || e.velocityX > 700 ? -1 : 0;
      if (go) scheduleOnRN(swipeTo, go);
    },
    onFinalize: () => {
      'worklet';
      dragX.set(withSpring(0, motion.spring));
    },
  });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));

  if (!day || !count) {
    return (
      <Backdrop>
        <View style={[s.empty, { paddingTop: insets.top + space.x4 }]}>
          <Text style={type.title}>No workout today</Text>
          <Button variant="outline" label="Close" onPress={() => router.back()} />
        </View>
      </Backdrop>
    );
  }

  /** A set was logged on a page: rest, PR moment. */
  const onLogged = (info: { pr: string | null; rest: number; next: string; dayDone: boolean }) => {
    if (info.pr) {
      haptic.thump();
      setTimeout(() => haptic.pr(), 120);
      setFlash((n) => n + 1);
      setPr(info.pr);
      setTimeout(() => setPr(null), 2600);
    } else haptic.setDone();
    if (info.dayDone) {
      setRestEnd(null);
      return;
    }
    setRestTotal(info.rest);
    setRestNext(info.next);
    setRestEnd(Date.now() + info.rest * 1000);
  };

  // Save the finished session to disk first; only then open the celebration, so a crash there can
  // never lose the workout. With no set logged there is nothing to finish: it just closes (a day
  // is never marked Done with 0 sets). Guarded against double taps.
  const finish = async () => {
    if (finishing.current) return;
    if (!hasLoggedSets(state.logs, date)) {
      crumb('close workout: no sets logged');
      router.back();
      return;
    }
    finishing.current = true;
    haptic.pr();
    crumb('finish workout');
    // eslint-disable-next-line react-hooks/purity -- runs in the tap handler, not during render
    const atMs = Date.now();
    await commit((st) => ({
      ...st,
      sessions: {
        ...st.sessions,
        [date]: {
          ...st.sessions[date],
          dayId: st.sessions[date]?.dayId ?? day.id,
          finishedAt: atMs,
        },
      },
    })).catch((e) => logCrash('error', e, 'saving finished workout'));
    setRestEnd(null);
    router.replace({ pathname: '/complete', params: { date } });
  };

  const st = statuses[at];
  const last = at === count - 1;
  // Videos: only this exercise's and the next one's are loaded (the next is preloaded); the rest
  // stay released. Your own clips use their own player.
  // Behind History or the trim sheet (each plays a video of its own) the workout lets go of its
  // players and shows its stills, so only one video decodes at a time; they're remade on return.
  const hold = !focused || videoSheet;
  const videoOf = (i: number) => {
    const x = statuses[i];
    if (!x) return null;
    const m = mediaFor(x.exerciseId, state.userVideos);
    return m.kind === 'video' ? (m.video as number | { uri: string }) : null;
  };
  const draftKey = `${st.plan.slot}-${st.exerciseId}`;
  const anyLogged = done > 0;

  return (
    <Backdrop>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <IconButton icon="close" label="Close workout" onPress={() => router.back()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1} accessibilityRole="header">
            {titleOf(day)}
          </Text>
          <Text style={type.small} testID="workout-progress">
            {done} of {total} sets
          </Text>
        </View>
      </View>
      {/* Exercise k of n: tap to see the whole list and jump. */}
      <Press onPress={() => setListOpen(true)} style={s.stepper} accessibilityRole="button" accessibilityLabel={`Exercise ${at + 1} of ${count}. Open the exercise list`} testID="exercise-list" scaleTo={1}>
        <View style={s.stepRow}>
          <Text style={s.stepText}>
            Exercise {at + 1} of {count}
          </Text>
          <Icon name="chevronDown" size={14} color={color.muted} />
        </View>
        <View style={s.segs}>
          {statuses.map((x, i) => (
            <View key={x.plan.slot} style={[s.seg, x.complete && s.segDone, i === at && s.segOn]} />
          ))}
        </View>
      </Press>

      <VideoPoolProvider current={videoOf(at)} next={videoOf(at + 1)} hold={hold} onSheet={setVideoSheet}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ flex: 1 }, dragStyle]}>
            <Animated.View key={`${at}-${st.exerciseId}`} entering={reduce ? undefined : (dir > 0 ? SlideInRight : SlideInLeft).duration(motion.base)} style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: navH + (restEnd ? 96 : space.lg) }} keyboardShouldPersistTaps="handled">
                <ExerciseCard
                  n={at}
                  st={st}
                  state={state}
                  date={date}
                  dayId={day.id}
                  statuses={statuses}
                  update={update}
                  onLogged={onLogged}
                  onSwap={() => setSwapFor(st)}
                  drafts={drafts[draftKey] ?? {}}
                  setDrafts={(fn) => setDrafts((d) => ({ ...d, [draftKey]: fn(d[draftKey] ?? {}) }))}
                />
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </VideoPoolProvider>

      {/* Previous / Next (Finish on the last page), in thumb reach. */}
      <View style={[s.nav, { paddingBottom: insets.bottom + space.md }]} onLayout={(e) => setNavH(e.nativeEvent.layout.height)}>
        <Button variant="ghost" icon="back" label="Previous" disabled={at === 0} onPress={() => goTo(at - 1)} testID="prev-exercise" />
        <View style={{ flex: 1 }}>
          {last ? (
            <Button
              size="lg"
              variant={statuses.every((x) => x.complete) ? 'solid' : 'default'}
              label={anyLogged ? 'Finish workout' : 'Close workout'}
              iconRight="flag"
              onPress={finish}
              testID="finish-workout"
            />
          ) : (
            <Button size="lg" variant={st.complete ? 'solid' : 'default'} label="Next exercise" iconRight="arrowRight" onPress={() => goTo(at + 1)} testID="next-exercise" />
          )}
        </View>
      </View>

      {restEnd && (
        <RestTimer
          endsAt={restEnd}
          total={restTotal}
          tint={color.accent}
          nextLabel={restNext || 'Next set'}
          skipLabel="Skip"
          sound={state.restSound}
          above={navH - insets.bottom}
          onAdd={() => {
            setRestEnd((e) => (e ?? Date.now()) + 15000);
            setRestTotal((t) => t + 15);
          }}
          onSkip={() => setRestEnd(null)}
          onDone={() => setRestEnd(null)}
        />
      )}
      <Flash fire={flash} />
      <Burst burst={flash} x={width / 2} y={260} colors={[color.accent, color.accentPressed, color.text]} count={28} />
      {pr && (
        <Animated.View
          entering={reduce ? undefined : FadeIn.duration(motion.fast)}
          exiting={reduce ? undefined : FadeOut.duration(motion.base)}
          style={[s.pr, { top: insets.top + 72 }]}
          pointerEvents="none"
        >
          <Icon name="trophy" size={18} color={color.accent} filled />
          <Text style={s.prText} accessibilityLiveRegion="polite">
            New PR · {pr}
          </Text>
        </Animated.View>
      )}

      {listOpen && (
        <Sheet title="Exercises" subtitle={`${done} of ${total} sets done`} onClose={() => setListOpen(false)} testID="exercise-list-sheet">
          <View style={{ gap: space.xs }}>
            {statuses.map((x, i) => (
              <Press
                key={x.plan.slot}
                onPress={() => {
                  setListOpen(false);
                  goTo(i);
                }}
                style={[s.listRow, i === at && s.listRowOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: i === at }}
                accessibilityLabel={`${EXERCISES[x.exerciseId].name}, ${Math.min(x.done, x.plan.sets)} of ${x.plan.sets} sets`}
                testID={`jump-${i}`}
              >
                <View style={[s.listState, x.complete && s.listStateDone]}>
                  {x.complete ? <Icon name="check" size={14} color={color.onAccent} /> : <Text style={s.listIdx}>{i + 1}</Text>}
                </View>
                <Text style={[type.h3, { flex: 1 }]} numberOfLines={1}>
                  {EXERCISES[x.exerciseId].name}
                </Text>
                <Text style={s.listCount}>
                  {Math.min(x.done, x.plan.sets)}/{x.plan.sets}
                </Text>
              </Press>
            ))}
          </View>
        </Sheet>
      )}

      {swapFor && (
        <SwapSheet
          original={pickOption(swapFor.plan, state.variants)}
          current={swapFor.exerciseId}
          swaps={swapsFor(pickOption(swapFor.plan, state.variants)).filter((x) => x.id === swapFor.exerciseId || !statuses.some((o) => o !== swapFor && o.exerciseId === x.id))}
          note={
            swapFor.done > 0
              ? `Same primary muscles only. Sets you've logged stay under the exercise you did them on; the remaining ${Math.max(0, swapFor.plan.sets - swapFor.done)} continue on the new one.`
              : 'Same primary muscles only.'
          }
          onPick={(to) => {
            haptic.setDone();
            crumb(`swap ${swapFor.exerciseId} -> ${to}`);
            update((cur) => swapSlot(cur, date, swapFor.plan, to));
            setSwapFor(null);
          }}
          onReset={() => {
            update((cur) => swapSlot(cur, date, swapFor.plan, pickOption(swapFor.plan, state.variants)));
            setSwapFor(null);
          }}
          onClose={() => setSwapFor(null)}
        />
      )}
    </Backdrop>
  );
}

// ---------- One exercise ----------

function ExerciseCard({
  n,
  st,
  state,
  date,
  dayId,
  statuses,
  update,
  onLogged,
  onSwap,
  drafts,
  setDrafts,
}: {
  n: number;
  st: SlotStatus;
  state: State;
  date: string;
  dayId: string;
  statuses: SlotStatus[];
  update: (fn: (s: State) => State) => void;
  onLogged: (info: { pr: string | null; rest: number; next: string; dayDone: boolean }) => void;
  onSwap: () => void;
  drafts: Record<number, SetEntry>;
  setDrafts: (fn: (d: Record<number, SetEntry>) => Record<number, SetEntry>) => void;
}) {
  const id = st.exerciseId;
  const plan = st.plan;
  const ex = EXERCISES[id];
  const kind = ex.kind;
  const weighted = kind === 'weight_reps' || kind === 'weight_time';
  const secs = kind === 'time' || kind === 'weight_time';
  const unit = state.unit;
  // Machines and cables log by pin (or kg, switchable); everything else by weight.
  const lt = loadTypeOf(id, state.loadTypes);
  const stack = weighted && lt === 'stack';
  const log = state.logs[date]?.[id];
  const rows: SetEntry[] = log?.sets ?? [];
  const carried = log?.carried ?? 0;
  const [extra, setExtra] = useState(0);
  const [missing, setMissing] = useState<Missing | null>(null);
  const [notes, setNotes] = useState(false);
  // "That's a big jump": the set waiting for a yes before it's logged.
  const [check, setCheck] = useState<{ i: number; text: string } | null>(null);
  const target = weeklyTarget(state, id, plan, date);
  const planned = pickOption(plan, state.variants);
  const canSwap = swapsFor(planned).some((x) => x.id !== id) || id !== planned;
  // Rows: the plan's sets (minus any done on another exercise before a swap) plus any you added,
  // or more if more are logged.
  const count = Math.max(1, plan.sets - carried + extra, rows.length);
  const credit = mediaCredit(id, state.userVideos);

  /**
   * What row i shows: what you logged, else what you typed, else this week's target until a set is
   * logged today (so the rows match the "Target this week" line), then your previous set.
   */
  const valueOf = (i: number): SetEntry => {
    const r = rows[i];
    if (r?.done) return r;
    if (drafts[i]) return drafts[i];
    const loggedBefore = rows.slice(0, i).some((x) => x.done);
    if (!loggedBefore && target && target.reason !== 'first') return fromTarget(target, kind, unit, lt);
    return suggestSet(state, id, plan, date, i).set;
  };
  const setDraft = (i: number, v: SetEntry) => {
    setDrafts((d) => ({ ...d, [i]: v }));
    if (missing?.i === i) setMissing(null);
    if (check?.i === i) setCheck(null);
  };

  const write = (sets: SetEntry[]) =>
    update((s) => ({
      ...s,
      logs: {
        ...s.logs,
        [date]: {
          ...s.logs[date],
          [id]: { ...(s.logs[date]?.[id] ?? {}), sets },
        },
      },
      sessions: s.sessions[date]?.startedAt
        ? s.sessions
        : {
            ...s.sessions,
            [date]: {
              ...s.sessions[date],
              dayId: s.sessions[date]?.dayId ?? dayId,
              startedAt: Date.now(),
            },
          },
    }));

  const log1 = (i: number, confirmed = false) => {
    // Let go of the keyboard first: a focused box that turns read-only on logging would otherwise
    // hand focus (and the keyboard) to the next set's box, and swallow the next tap.
    TextInput.State?.currentlyFocusedInput?.()?.blur?.();
    Keyboard.dismiss();
    const cur = rows[i];
    if (cur?.done) {
      // Tap a logged set's check again to undo it (values stay so you can fix and re-log).
      haptic.tap();
      const sets = [...rows];
      sets[i] = { ...cur, done: false };
      setDraft(i, { ...cur, done: false });
      write(sets);
      return;
    }
    const value = valueOf(i);
    const miss = missingFor(value, id, lt);
    if (miss.message) {
      // Nothing silent: say what's missing, mark the empty box amber, small warning buzz.
      haptic.warn();
      setMissing({ slot: plan.slot, i, ...miss });
      crumb(`log set blocked: ${miss.message}`);
      return;
    }
    setMissing(null);
    // A weight far above your usual (e.g. 222 kg for a 22 kg dumbbell): ask before logging.
    const kgNow = weighted ? kgOf(value) : null;
    if (!confirmed && kgNow !== null && bigJump(state, id, kgNow)) {
      haptic.warn();
      crumb(`big jump check: ${id} ${kgNow} kg`);
      setCheck({ i, text: fmtKg(kgNow, unit) });
      return;
    }
    setCheck(null);
    const entry: SetEntry = { ...value, done: true };
    const sets = [...rows];
    while (sets.length < i) sets.push({ weight: '', reps: '', done: false });
    sets[i] = entry;
    const metric = prMetric(entry, kind);
    const best = bestBefore(state.logs, id, date);
    const bestToday = Math.max(0, ...rows.filter((r, j) => j !== i && r.done).map((r) => prMetric(r, kind) || 0));
    write(sets);
    setDrafts((d) => {
      const { [i]: _, ...rest } = d;
      void _;
      return rest;
    });
    const isPr = best > 0 && metric > best && metric > bestToday;
    const doneNow = sets.filter((r) => r.done).length + carried;
    const exDone = doneNow >= plan.sets;
    const others = statuses.filter((o) => o.plan.slot !== plan.slot);
    const dayDone = exDone && others.every((o) => o.complete);
    const nextSt = exDone ? others.find((o) => !o.complete) : undefined;
    onLogged({
      pr: isPr ? (weighted ? fmtKg(metric, unit) : `${metric}${secs ? ' s' : ' reps'}`) : null,
      rest: restFor(id, plan),
      next: exDone
        ? nextSt
          ? `Next: ${EXERCISES[nextSt.exerciseId].name}`
          : 'Last sets done'
        : // The same value the next row will show: what you typed there, else the suggestion.
          `Set ${doneNow + 1} · ${setText(drafts[i + 1] ?? suggestSet({ ...state, logs: { ...state.logs, [date]: { ...state.logs[date], [id]: { ...log, sets } } } }, id, plan, date, i + 1).set, kind, unit)}`,
      dayDone,
    });
  };

  return (
    <Glass r={radius.xl} style={s.card} testID={`exercise-${n}`}>
      <ExerciseMedia exerciseId={id} height={230} />
      <View style={s.cardHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.h2} numberOfLines={2}>
            {ex.name}
          </Text>
          <Text style={type.small}>
            {plan.sets} × {plan.target}
            {secs ? ' s' : ''} · rest {fmtClock(restFor(id, plan))} · {EQUIPMENT_LABEL[ex.equipment]}
          </Text>
        </View>
        {st.complete && <Badge label="Done" icon="check" />}
      </View>
      <View style={s.actions}>
        {canSwap && <Button size="sm" variant="outline" icon="swap" label="Swap" accessibilityLabel={`Swap ${ex.name}`} onPress={onSwap} testID={`swap-${n}`} />}
        <Button size="sm" variant="ghost" icon="chart" label="History" accessibilityLabel={`${ex.name} history`} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id } })} />
      </View>

      <OwnVideoButtons exerciseId={id} />

      {target && (
        <View style={s.target} testID={`target-${n}`}>
          <Icon name="flame" size={16} color={color.accent} />
          <Text style={s.targetText}>
            Target this week: <Text style={s.targetStrong}>{target.text}</Text>
            {target.lastText ? <Text style={type.small}> ({target.lastText})</Text> : null}
          </Text>
        </View>
      )}

      <View style={s.setsHead}>
        <Text style={[type.label, { width: 34 }]}>Set</Text>
        {weighted && (
          <View style={s.headCell}>
            {loadTypesFor(id).length > 1 ? (
              // Log by: a small Pin | kg switch, remembered per exercise.
              <View style={s.lb} accessibilityRole="radiogroup" accessibilityLabel={`Log ${ex.name} by`}>
                {(['stack', 'weight'] as LoadType[]).map((t) => (
                  <Press
                    key={t}
                    onPress={() => {
                      if (lt === t) return;
                      haptic.tap();
                      update((st2) => ({ ...st2, loadTypes: { ...st2.loadTypes, [id]: t } }));
                      setDrafts(() => ({}));
                    }}
                    style={[s.lbItem, lt === t && s.lbOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: lt === t }}
                    accessibilityLabel={t === 'stack' ? 'Machine pin' : `Weight in ${unit}`}
                    testID={`logby-${t === 'stack' ? 'pin' : 'kg'}-${n}`}
                    scaleTo={1}
                  >
                    <Text style={[s.lbText, lt === t && s.lbTextOn]}>{t === 'stack' ? 'Pin' : unit}</Text>
                  </Press>
                ))}
              </View>
            ) : (
              <Text style={type.label}>{unit}</Text>
            )}
          </View>
        )}
        <Text style={[type.label, s.headCell]}>{secs ? 'Sec' : 'Reps'}</Text>
        <View style={{ width: touch.primary }} />
      </View>
      {Array.from({ length: count }, (_, i) => (
        <SetRow
          key={i}
          i={i}
          slotN={n}
          label={carried + i + 1}
          value={valueOf(i)}
          logged={!!rows[i]?.done}
          weighted={weighted}
          secs={secs}
          stack={stack}
          dumbbell={ex.equipment === 'dumbbell'}
          unit={unit}
          warn={missing?.i === i ? missing : null}
          onChange={(v) => setDraft(i, v)}
          onLog={() => log1(i)}
          exName={ex.name}
          check={check?.i === i ? check.text : null}
          onConfirm={() => log1(i, true)}
          onFix={() => setCheck(null)}
        />
      ))}
      <Press onPress={() => setExtra((x) => x + 1)} style={s.addSet} accessibilityRole="button" accessibilityLabel={`Add a set to ${ex.name}`}>
        <Icon name="plus" size={16} color={color.muted} />
        <Text style={s.addSetText}>Add set</Text>
      </Press>

      <Press
        onPress={() => setNotes((v) => !v)}
        style={s.notesHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: notes }}
        accessibilityLabel={`How to, muscles and tips for ${ex.name}`}
        testID={`notes-${n}`}
      >
        <Text style={[type.h3, { flex: 1 }]}>How to, muscles & tips</Text>
        <Icon name={notes ? 'chevronUp' : 'chevronDown'} size={18} color={color.muted} />
      </Press>
      {notes && (
        <View style={{ gap: space.md }}>
          <HowToSteps ex={ex} />
          <View>
            <Text style={type.label}>Muscles worked</Text>
            <MuscleLegend ex={ex} />
          </View>
          <View>
            <Text style={type.label}>Tips</Text>
            <Tips ex={ex} />
          </View>
          {credit ? <Text style={s.credit}>{credit}</Text> : null}
        </View>
      )}
    </Glass>
  );
}

/** This week's target as a set to log. */
function fromTarget(t: NonNullable<ReturnType<typeof weeklyTarget>>, kind: string, unit: State['unit'], lt: LoadType): SetEntry {
  const reps = String(t.reps);
  if (kind === 'reps' || kind === 'time') return { weight: '', reps, done: false };
  if (lt === 'stack') return t.pin !== undefined ? { weight: '', u: 'kg', reps, load: { t: 'stack', pin: t.pin }, done: false } : { weight: '', reps, done: false };
  if (t.kg === null) return { weight: '', reps, u: unit, done: false };
  return { weight: round1(fromKg(t.kg, unit)), u: unit, reps, done: false };
}

const tidy = (n: number) => String(Math.round(n * 100) / 100);

// ---------- One set row ----------

function SetRow({
  i,
  slotN,
  label,
  value,
  logged,
  weighted,
  secs,
  stack,
  dumbbell,
  unit,
  warn,
  onChange,
  onLog,
  exName,
  check,
  onConfirm,
  onFix,
}: {
  i: number;
  slotN: number;
  label: number;
  value: SetEntry;
  logged: boolean;
  weighted: boolean;
  secs: boolean;
  /** Logged by machine pin (else by weight). */
  stack: boolean;
  dumbbell: boolean;
  unit: State['unit'];
  warn: Missing | null;
  onChange: (v: SetEntry) => void;
  onLog: () => void;
  exName: string;
  /** Set when this set's weight looks like a typo ("222 kg"): ask before logging. */
  check: string | null;
  onConfirm: () => void;
  onFix: () => void;
}) {
  // The newest value, so a held − / + keeps counting from where the last repeat left off.
  const cur = useRef(value);
  useEffect(() => {
    cur.current = value;
  }, [value]);
  const set = (v: SetEntry) => {
    cur.current = v;
    onChange(v);
  };
  const w = weighted && value.weight !== '' ? weightIn(value, unit) : null;
  // Typed in your unit: show exactly what was typed (so "62." stays while you type 62.5). Only a
  // set stored in the other unit is converted for display.
  // A set shows its own load, whatever the switch says: "Pin 7" on a kg row, "60 kg" on a pin row.
  const pinNow = value.load?.pin;
  const kgText = w === null ? '' : !value.u || value.u === unit ? value.weight : round1(w);
  const shownWeight = stack
    ? pinNow !== undefined
      ? String(pinNow)
      : value.weight !== ''
        ? `${round1(weightIn(value, unit) ?? 0)} ${unit}`
        : ''
    : kgText || (pinNow !== undefined ? `Pin ${pinNow}` : '');
  const stepLoad = (dir: 1 | -1) => {
    const v = cur.current;
    if (stack) {
      const pin = v.load?.pin;
      const next = pin === undefined ? 1 : Math.max(1, pin + dir);
      set({ ...v, weight: '', u: 'kg', load: { t: 'stack', pin: next } });
      return;
    }
    const now = v.weight === '' ? null : (weightIn(v, unit) ?? 0);
    const base = now ?? 0;
    const next = base + dir * stepOf('weight', unit, dumbbell, base, dir);
    // Stepping down to nothing leaves the box empty (never a silent 0 kg set).
    set({ ...v, weight: next > 0 ? tidy(next) : '', u: unit, load: undefined });
  };
  const stepReps = (dir: 1 | -1) => {
    const v = cur.current;
    const now = v.reps === '' ? 0 : Number(v.reps) || 0;
    set({ ...v, reps: String(Math.max(0, now + dir * stepOf(secs ? 'secs' : 'reps', unit, dumbbell, now, dir))) });
  };
  return (
    <View>
      <View style={[s.row, logged && s.rowDone]}>
        <Text style={s.setNo}>{label}</Text>
        {weighted && (
          <Stepper
            onStep={stepLoad}
            disabled={logged}
            name={`${stack ? 'pin' : `weight in ${unit}`} for set ${label} of ${exName}`}
            testID={`weight-${slotN}-${i}`}
            warn={!!(warn?.load || check)}
          >
            <NumBox
              value={shownWeight}
              editable={!logged}
              onChangeText={(t) => {
                if (stack) {
                  const pin = parseInt(t.replace(/[^0-9]/g, ''), 10);
                  set(Number.isFinite(pin) ? { ...cur.current, weight: '', u: 'kg', load: { t: 'stack', pin } } : { ...cur.current, weight: '', load: undefined });
                } else set({ ...cur.current, weight: t.replace(/[^0-9.,]/g, '').replace(',', '.'), u: unit, load: undefined });
              }}
              placeholder="—"
              placeholderTextColor={color.subtle}
              keyboardType={stack ? 'number-pad' : 'decimal-pad'}
              style={s.num}
              accessibilityLabel={`Set ${label} ${stack ? 'pin' : `weight in ${unit}`} for ${exName}`}
              testID={`weight-${slotN}-${i}`}
            />
          </Stepper>
        )}
        <Stepper onStep={stepReps} disabled={logged} name={`${secs ? 'seconds' : 'reps'} for set ${label} of ${exName}`} testID={`reps-${slotN}-${i}`} warn={!!warn?.reps}>
          <NumBox
            value={value.reps}
            editable={!logged}
            onChangeText={(t) => set({ ...cur.current, reps: t.replace(/[^0-9]/g, '') })}
            placeholder="—"
            placeholderTextColor={color.subtle}
            keyboardType="number-pad"
            style={s.num}
            accessibilityLabel={`Set ${label} ${secs ? 'seconds' : 'reps'} for ${exName}`}
            testID={`reps-${slotN}-${i}`}
          />
        </Stepper>
        <Press
          onPress={onLog}
          style={[s.check, logged && s.checkDone]}
          accessibilityRole="button"
          accessibilityState={{ checked: logged }}
          accessibilityLabel={logged ? `Set ${label} of ${exName} logged. Tap to undo` : `Log set ${label} of ${exName}`}
          testID={`log-${slotN}-${i}`}
        >
          <Icon name="check" size={22} color={logged ? color.onAccent : color.text} />
        </Press>
      </View>
      {warn && (
        <View style={s.missing} accessibilityLiveRegion="polite">
          <Icon name="alert" size={14} color={color.warn} />
          <Text style={s.missingText}>{warn.message}</Text>
        </View>
      )}
      {check && (
        <View style={s.jump} accessibilityLiveRegion="polite" testID={`big-jump-${slotN}-${i}`}>
          <View style={s.jumpHead}>
            <Icon name="alert" size={16} color={color.warn} />
            <Text style={s.jumpText}>That’s a big jump, is {check} right?</Text>
          </View>
          <Button size="sm" variant="ghost" label="Fix it" onPress={onFix} />
          <Button size="sm" variant="outline" label="Yes, log it" onPress={onConfirm} testID={`big-jump-yes-${slotN}-${i}`} />
        </View>
      )}
    </View>
  );
}

/**
 * A number box in a set row. At rest it is a plain tappable box, not a text field: Android text
 * fields claim any touch that starts on them, so a swipe starting on the set rows wouldn't scroll
 * the workout. Tapping it swaps in the real text field, focused, with its text selected.
 */
function NumBox({
  value,
  editable,
  onChangeText,
  placeholder,
  placeholderTextColor,
  keyboardType,
  style,
  accessibilityLabel,
  testID,
}: {
  value: string;
  editable: boolean;
  onChangeText: (t: string) => void;
  placeholder: string;
  placeholderTextColor: string;
  keyboardType: 'number-pad' | 'decimal-pad';
  style: React.ComponentProps<typeof TextInput>['style'];
  accessibilityLabel: string;
  testID: string;
}) {
  const [editing, setEditing] = useState(false);
  // While editing, the field starts empty with the old value as its placeholder, so what you type
  // replaces it. (Selecting the old text on focus isn't reliable on Android: the cursor could land
  // after it and "2" typed over "22" became "222".) Leaving without typing keeps the old value.
  const [text, setText] = useState('');
  if (editing && editable) {
    return (
      <TextInput
        autoFocus
        value={text}
        onChangeText={(t) => {
          setText(t);
          onChangeText(t);
        }}
        onBlur={() => setEditing(false)}
        onSubmitEditing={() => setEditing(false)}
        placeholder={value || placeholder}
        placeholderTextColor={placeholderTextColor}
        keyboardType={keyboardType}
        // The phone's default (teal) cursor and handle looked like a stray "+": use the accent.
        cursorColor={color.accent}
        selectionColor={color.accentGlow}
        selectionHandleColor={color.accent}
        style={style}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      />
    );
  }
  const flat = StyleSheet.flatten(style) as TextStyle;
  return (
    <Pressable
      onPress={
        editable
          ? () => {
              setText('');
              setEditing(true);
            }
          : undefined
      }
      disabled={!editable}
      style={[style as StyleProp<ViewStyle>, s.box]}
      accessibilityRole={editable ? 'button' : 'text'}
      accessibilityLabel={`${accessibilityLabel}: ${value || 'empty'}`}
      accessibilityHint={editable ? 'Double tap to type a new number' : undefined}
      testID={testID}
    >
      <Text style={[s.boxText, { fontFamily: flat.fontFamily, fontSize: flat.fontSize }, !value && { color: placeholderTextColor }]} numberOfLines={1}>
        {value || placeholder}
      </Text>
    </Pressable>
  );
}

const s = themed(() =>
  StyleSheet.create({
    empty: { flex: 1, alignItems: 'center', gap: space.lg, padding: space.xl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.lg,
      paddingBottom: space.sm,
    },
    title: { ...type.title },
    card: { padding: space.lg, gap: space.md },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    stepper: { marginHorizontal: space.lg, paddingVertical: space.xs, gap: 6 },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    stepText: { fontFamily: font.bodyBold, fontSize: size.label, color: color.muted, letterSpacing: 0.3 },
    segs: { flexDirection: 'row', gap: 4 },
    seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.surface3 },
    segDone: { backgroundColor: color.accentEdge },
    segOn: { backgroundColor: color.accent },
    nav: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingTop: space.md,
      backgroundColor: color.bg,
      borderTopWidth: 1,
      borderTopColor: color.line,
    },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.md, borderRadius: radius.lg },
    listRowOn: { backgroundColor: color.accentDim, borderWidth: 1, borderColor: color.accentEdge },
    listState: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: color.glassBorder, alignItems: 'center', justifyContent: 'center' },
    listStateDone: { backgroundColor: color.accent, borderColor: color.accent },
    listIdx: { fontFamily: font.bodyBold, fontSize: size.tiny, color: color.subtle },
    listCount: { fontFamily: font.bodySemi, fontSize: size.small, color: color.subtle, fontVariant: ['tabular-nums'] },
    jump: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.xs,
      marginLeft: 34 + space.sm,
      marginTop: space.xs,
      padding: space.sm,
      borderRadius: radius.md,
      backgroundColor: color.warnDim,
      borderWidth: 1,
      borderColor: color.warnEdge,
    },
    jumpHead: { flexBasis: '100%', flexDirection: 'row', alignItems: 'center', gap: space.xs },
    jumpText: { flex: 1, fontFamily: font.bodyBold, fontSize: size.small, color: color.text },
    target: {
      flexDirection: 'row',
      gap: space.sm,
      alignItems: 'flex-start',
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: color.accentDim,
      borderWidth: 1,
      borderColor: color.accentEdge,
    },
    targetText: {
      flex: 1,
      fontFamily: font.bodySemi,
      fontSize: size.small,
      lineHeight: 20,
      color: color.text,
    },
    targetStrong: { fontFamily: font.bodyBlack, color: color.accentText },
    headCell: { flex: 1, alignItems: 'center' },
    lb: { flexDirection: 'row', borderRadius: radius.pill, backgroundColor: color.surface2, padding: 2, borderWidth: 1, borderColor: color.glassBorder },
    lbItem: { minHeight: 28, minWidth: 40, paddingHorizontal: space.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    lbOn: { backgroundColor: color.accent },
    lbText: { fontFamily: font.bodyBold, fontSize: size.tiny, color: color.muted, letterSpacing: 0.3 },
    lbTextOn: { color: color.onAccent },
    num: { minHeight: touch.min, color: color.text, textAlign: 'center', fontFamily: font.display, fontSize: size.h3, paddingHorizontal: 0 },
    setsHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      marginTop: space.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.xs,
      borderRadius: radius.md,
    },
    rowDone: { opacity: 0.85 },
    setNo: {
      width: 34,
      fontFamily: font.display,
      fontSize: size.h3,
      color: color.muted,
      textAlign: 'center',
    },
    input: {
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
      width: 0,
      minHeight: touch.min,
      borderRadius: radius.md,
      backgroundColor: color.surface2,
      color: color.text,
      textAlign: 'center',
      fontFamily: font.display,
      fontSize: size.h3,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    box: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
    boxText: { color: color.text, textAlign: 'center' },
    inputWarn: { borderColor: color.warnEdge, backgroundColor: color.warnDim },
    check: {
      width: touch.primary,
      height: touch.min,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.surface3,
    },
    checkDone: { backgroundColor: color.accent },
    missing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      marginLeft: 34 + space.sm,
      marginTop: 2,
    },
    missingText: {
      fontFamily: font.bodyBold,
      fontSize: size.small,
      color: color.warn,
    },
    addSet: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      alignSelf: 'flex-start',
      minHeight: touch.min,
      paddingHorizontal: space.sm,
    },
    addSetText: {
      fontFamily: font.bodySemi,
      fontSize: size.small,
      color: color.muted,
    },
    notesHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      minHeight: touch.min,
      borderTopWidth: 1,
      borderTopColor: color.line,
      paddingTop: space.sm,
    },
    credit: { ...type.small, fontSize: size.tiny, color: color.subtle },
    pr: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      backgroundColor: color.glassSolid,
      borderWidth: 1,
      borderColor: color.accentEdge,
    },
    prText: {
      fontFamily: font.bodyBlack,
      fontSize: size.body,
      color: color.text,
    },
  }),
);

// One bad screen shows a recovery panel for that screen only; it never takes the app down.
export { RouteError as ErrorBoundary } from '../components/RouteError';
