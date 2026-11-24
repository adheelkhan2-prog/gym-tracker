import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ExerciseMedia,
  HowToSteps,
  MachineSheet,
  MuscleLegend,
  SwapSheet,
  Tips,
  mediaCredit,
} from "../components/ExerciseParts";
import { OwnVideoButtons } from "../components/RecordVideo";
import { Backdrop, Glass } from "../components/glass";
import { Icon } from "../components/icons";
import { Burst, Flash } from "../components/motion";
import { RestTimer } from "../components/RestRing";
import { Badge, Button, Chip, IconButton, Press } from "../components/ui";
import { crumb, logCrash } from "../crash";
import { EQUIPMENT_LABEL, EXERCISES } from "../data/exercises";
import { pickOption, restFor } from "../data/program";
import { swapsFor } from "../data/swaps";
import { haptic } from "../feedback";
import {
  fmtKg,
  fromKg,
  loadTypeOf,
  loadTypesFor,
  round1,
  weightFromLoad,
} from "../load";
import { restCarry } from "../restCarry";
import { missingFor, suggestSet, weightIn } from "../sets";
import {
  bestBefore,
  dayById,
  prMetric,
  todayKey,
  useStore,
  type SetEntry,
  type State,
} from "../store";
import {
  color,
  fmtClock,
  font,
  motion,
  radius,
  size,
  space,
  themed,
  touch,
  type,
} from "../theme";
import {
  setText,
  slotStatuses,
  swapSlot,
  titleOf,
  type SlotStatus,
} from "../workout";
import { weeklyTarget } from "../weekly";

type Missing = {
  slot: string;
  i: number;
  load: boolean;
  reps: boolean;
  message: string;
};

/**
 * The workout: every exercise of the day in one scrolling list. Each card shows the video (or the
 * images), this week's progressive-overload target, the set rows (pre-filled from last time, one tap
 * to log) and the how-to notes, collapsible, under it. Rest timer, swap, PR moment and Log-set
 * validation work as before. The session is saved before the finish screen opens.
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
  const allDone = statuses.length > 0 && statuses.every((x) => x.complete);

  const [restEnd, setRestEnd] = useState<number | null>(() =>
    restCarry.endsAt && restCarry.endsAt > Date.now() ? restCarry.endsAt : null,
  );
  const [playing, setPlaying] = useState(0);
  const [viewH, setViewH] = useState(600);
  const cardY = useRef<({ y: number; h: number } | undefined)[]>([]);
  const [restTotal, setRestTotal] = useState(restCarry.total);
  const [restNext, setRestNext] = useState("");
  const [pr, setPr] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [swapFor, setSwapFor] = useState<SlotStatus | null>(null);
  const finishing = useRef(false);
  useEffect(() => {
    restCarry.endsAt = restEnd;
    restCarry.total = restTotal;
  }, [restEnd, restTotal]);

  if (!day) {
    return (
      <Backdrop>
        <View style={[s.empty, { paddingTop: insets.top + space.x4 }]}>
          <Text style={type.title}>No workout today</Text>
          <Button
            variant="outline"
            label="Close"
            onPress={() => router.back()}
          />
        </View>
      </Backdrop>
    );
  }

  /** A set was logged on a card: rest, PR moment. */
  const onLogged = (info: {
    pr: string | null;
    rest: number;
    next: string;
    dayDone: boolean;
  }) => {
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
  // never lose the workout. Guarded against double taps.
  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    haptic.pr();
    crumb("finish workout");
    // eslint-disable-next-line react-hooks/purity -- runs in the tap handler, not during render
    const at = Date.now();
    await commit((st) => ({
      ...st,
      sessions: {
        ...st.sessions,
        [date]: {
          ...st.sessions[date],
          dayId: st.sessions[date]?.dayId ?? day.id,
          finishedAt: at,
        },
      },
    })).catch((e) => logCrash("error", e, "saving finished workout"));
    setRestEnd(null);
    router.replace({ pathname: "/complete", params: { date } });
  };

  return (
    <Backdrop>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <IconButton
          icon="close"
          label="Close workout"
          onPress={() => router.back()}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1} accessibilityRole="header">
            {titleOf(day)}
          </Text>
          <Text style={type.small} testID="workout-progress">
            {done} of {total} sets
          </Text>
        </View>
      </View>
      <View style={s.track}>
        <View
          style={[
            s.trackFill,
            { width: `${total ? (done / total) * 100 : 0}%` },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + (restEnd ? 200 : 120),
          gap: space.lg,
        }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={100}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        onScroll={(e) => {
          // Only the card in the middle of the screen plays its video.
          const mid = e.nativeEvent.contentOffset.y + viewH / 2;
          const i = cardY.current.findIndex(
            (c) => c && mid >= c.y && mid < c.y + c.h,
          );
          if (i >= 0 && i !== playing) setPlaying(i);
        }}
      >
        {statuses.map((st, k) => (
          <View
            key={`${st.plan.slot}-${st.exerciseId}`}
            onLayout={(e) =>
              (cardY.current[k] = {
                y: e.nativeEvent.layout.y,
                h: e.nativeEvent.layout.height,
              })
            }
          >
            <ExerciseCard
              // Keyed by the exercise too: a swap starts the card fresh (no typed values carried over).
              key={`${st.plan.slot}-${st.exerciseId}`}
              n={k}
              st={st}
              state={state}
              date={date}
              dayId={day.id}
              statuses={statuses}
              update={update}
              onLogged={onLogged}
              onSwap={() => setSwapFor(st)}
              active={k === playing}
            />
          </View>
        ))}
        <Button
          size="lg"
          variant={allDone ? "solid" : "outline"}
          label={
            allDone
              ? "Finish workout"
              : `Finish workout · ${done} of ${total} sets`
          }
          iconRight="flag"
          onPress={finish}
          testID="finish-workout"
        />
      </ScrollView>

      {restEnd && (
        <RestTimer
          endsAt={restEnd}
          total={restTotal}
          tint={color.accent}
          nextLabel={restNext || "Next set"}
          skipLabel="Skip"
          sound={state.restSound}
          onAdd={() => {
            setRestEnd((e) => (e ?? Date.now()) + 15000);
            setRestTotal((t) => t + 15);
          }}
          onSkip={() => setRestEnd(null)}
          onDone={() => setRestEnd(null)}
        />
      )}
      <Flash fire={flash} />
      <Burst
        burst={flash}
        x={width / 2}
        y={260}
        colors={[color.accent, color.accentPressed, color.text]}
        count={28}
      />
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

      {swapFor && (
        <SwapSheet
          original={pickOption(swapFor.plan, state.variants)}
          current={swapFor.exerciseId}
          swaps={swapsFor(pickOption(swapFor.plan, state.variants)).filter(
            (x) =>
              x.id === swapFor.exerciseId ||
              !statuses.some((o) => o !== swapFor && o.exerciseId === x.id),
          )}
          note={
            swapFor.done > 0
              ? `Same primary muscles only. Sets you've logged stay under the exercise you did them on; the remaining ${Math.max(0, swapFor.plan.sets - swapFor.done)} continue on the new one.`
              : "Same primary muscles only."
          }
          onPick={(to) => {
            haptic.setDone();
            crumb(`swap ${swapFor.exerciseId} -> ${to}`);
            update((cur) => swapSlot(cur, date, swapFor.plan, to));
            setSwapFor(null);
          }}
          onReset={() => {
            update((cur) =>
              swapSlot(
                cur,
                date,
                swapFor.plan,
                pickOption(swapFor.plan, state.variants),
              ),
            );
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
  active,
}: {
  n: number;
  st: SlotStatus;
  state: State;
  date: string;
  dayId: string;
  statuses: SlotStatus[];
  update: (fn: (s: State) => State) => void;
  onLogged: (info: {
    pr: string | null;
    rest: number;
    next: string;
    dayDone: boolean;
  }) => void;
  onSwap: () => void;
  active: boolean;
}) {
  const id = st.exerciseId;
  const plan = st.plan;
  const ex = EXERCISES[id];
  const kind = ex.kind;
  const weighted = kind === "weight_reps" || kind === "weight_time";
  const secs = kind === "time" || kind === "weight_time";
  const unit = state.unit;
  const lt = loadTypeOf(id, state.loadTypes);
  const machine = state.machines[id];
  const log = state.logs[date]?.[id];
  const rows: SetEntry[] = log?.sets ?? [];
  const carried = log?.carried ?? 0;
  const [drafts, setDrafts] = useState<Record<number, SetEntry>>({});
  const [extra, setExtra] = useState(0);
  const [missing, setMissing] = useState<Missing | null>(null);
  const [notes, setNotes] = useState(false);
  const [machineOpen, setMachineOpen] = useState(false);
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
    if (!loggedBefore && target && target.reason !== "first")
      return fromTarget(target, kind, unit, machine, lt);
    return suggestSet(state, id, plan, date, i).set;
  };
  const setDraft = (i: number, v: SetEntry) => {
    setDrafts((d) => ({ ...d, [i]: v }));
    if (missing?.i === i) setMissing(null);
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

  const log1 = (i: number) => {
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
    const entry: SetEntry = { ...value, done: true };
    const sets = [...rows];
    while (sets.length < i) sets.push({ weight: "", reps: "", done: false });
    sets[i] = entry;
    const metric = prMetric(entry, kind);
    const best = bestBefore(state.logs, id, date);
    const bestToday = Math.max(
      0,
      ...rows
        .filter((r, j) => j !== i && r.done)
        .map((r) => prMetric(r, kind) || 0),
    );
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
      pr: isPr
        ? weighted
          ? fmtKg(metric, unit)
          : `${metric}${secs ? " s" : " reps"}`
        : null,
      rest: restFor(id, plan),
      next: exDone
        ? nextSt
          ? `Next: ${EXERCISES[nextSt.exerciseId].name}`
          : "Last sets done"
        : `Set ${doneNow + 1} · ${setText(suggestSet({ ...state, logs: { ...state.logs, [date]: { ...state.logs[date], [id]: { ...log, sets } } } }, id, plan, date, i + 1).set, kind, unit)}`,
      dayDone,
    });
  };

  return (
    <Glass r={radius.xl} style={s.card} testID={`exercise-${n}`}>
      <ExerciseMedia exerciseId={id} height={230} active={active} />
      <View style={s.cardHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.h2} numberOfLines={2}>
            {ex.name}
          </Text>
          <Text style={type.small}>
            {plan.sets} × {plan.target}
            {secs ? " s" : ""} · rest {fmtClock(restFor(id, plan))} ·{" "}
            {EQUIPMENT_LABEL[ex.equipment]}
          </Text>
        </View>
        {st.complete && <Badge label="Done" icon="check" />}
      </View>
      <View style={s.actions}>
        {canSwap && (
          <Button
            size="sm"
            variant="outline"
            icon="swap"
            label="Swap"
            accessibilityLabel={`Swap ${ex.name}`}
            onPress={onSwap}
            testID={`swap-${n}`}
          />
        )}
        <Button
          size="sm"
          variant="ghost"
          icon="chart"
          label="History"
          accessibilityLabel={`${ex.name} history`}
          onPress={() =>
            router.push({ pathname: "/exercise/[id]", params: { id } })
          }
        />
      </View>

      <OwnVideoButtons exerciseId={id} />

      {/* Machine and cable lifts: log by pin or by weight; kg per plate turns pins into kg. */}
      {weighted && loadTypesFor(id).length > 1 && (
        <View style={s.loadRow}>
          <Text style={type.label}>Log by</Text>
          {loadTypesFor(id).map((t) => (
            <Chip
              key={t}
              label={t === "stack" ? "Machine pin" : `Weight (${unit})`}
              active={lt === t}
              onPress={() =>
                update((st2) => ({
                  ...st2,
                  loadTypes: { ...st2.loadTypes, [id]: t },
                }))
              }
            />
          ))}
          {lt === "stack" && (
            <Press
              onPress={() => setMachineOpen(true)}
              style={s.gear}
              accessibilityRole="button"
              accessibilityLabel={`Machine settings for ${ex.name}`}
            >
              <Icon name="sliders" size={14} color={color.muted} />
              <Text style={s.gearText}>
                {machine?.perPlate
                  ? `${round1(machine.perPlate)} kg / plate`
                  : "Set kg per plate"}
              </Text>
            </Press>
          )}
        </View>
      )}
      {machineOpen && (
        <MachineSheet
          name={ex.name}
          setup={machine ?? {}}
          onClose={() => setMachineOpen(false)}
          onSave={(m) => {
            update((st2) => ({
              ...st2,
              machines: { ...st2.machines, [id]: m },
            }));
            setMachineOpen(false);
          }}
        />
      )}

      {target && (
        <View style={s.target} testID={`target-${n}`}>
          <Icon name="flame" size={16} color={color.accent} />
          <Text style={s.targetText}>
            Target this week: <Text style={s.targetStrong}>{target.text}</Text>
            {target.lastText ? (
              <Text style={type.small}> ({target.lastText})</Text>
            ) : null}
          </Text>
        </View>
      )}

      <View style={s.setsHead}>
        <Text style={[type.label, { width: 34 }]}>Set</Text>
        {weighted && (
          <Text style={[type.label, { flex: 1 }]}>
            {lt === "stack" ? "Pin" : unit}
          </Text>
        )}
        <Text style={[type.label, { flex: 1 }]}>{secs ? "Sec" : "Reps"}</Text>
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
          stack={lt === "stack"}
          unit={unit}
          warn={missing?.i === i ? missing : null}
          onChange={(v) => setDraft(i, v)}
          onLog={() => log1(i)}
          machine={machine}
          exName={ex.name}
        />
      ))}
      <Press
        onPress={() => setExtra((x) => x + 1)}
        style={s.addSet}
        accessibilityRole="button"
        accessibilityLabel={`Add a set to ${ex.name}`}
      >
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
        <Icon name="info" size={18} color={color.muted} />
        <Text style={[type.h3, { flex: 1 }]}>How to, muscles & tips</Text>
        <Icon
          name={notes ? "chevronUp" : "chevronDown"}
          size={18}
          color={color.muted}
        />
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
function fromTarget(
  t: NonNullable<ReturnType<typeof weeklyTarget>>,
  kind: string,
  unit: State["unit"],
  machine: State["machines"][string] | undefined,
  lt: string,
): SetEntry {
  const reps = String(t.reps);
  if (kind === "reps" || kind === "time")
    return { weight: "", reps, done: false };
  if (lt === "stack")
    return t.pin !== undefined
      ? {
          ...weightFromLoad({ t: "stack", pin: t.pin }, machine),
          reps,
          done: false,
        }
      : { weight: "", reps, done: false };
  if (t.kg === null) return { weight: "", reps, u: unit, done: false };
  return { weight: round1(fromKg(t.kg, unit)), u: unit, reps, done: false };
}

// ---------- One set row ----------

function SetRow({
  i,
  slotN,
  label,
  value,
  logged,
  weighted,
  stack,
  unit,
  warn,
  onChange,
  onLog,
  machine,
  exName,
}: {
  i: number;
  slotN: number;
  label: number;
  value: SetEntry;
  logged: boolean;
  weighted: boolean;
  stack: boolean;
  unit: State["unit"];
  warn: Missing | null;
  onChange: (v: SetEntry) => void;
  onLog: () => void;
  machine: State["machines"][string] | undefined;
  exName: string;
}) {
  const w = weighted && value.weight !== "" ? weightIn(value, unit) : null;
  const shownWeight = stack
    ? value.load?.pin !== undefined
      ? String(value.load.pin)
      : ""
    : w === null
      ? ""
      : round1(w);
  return (
    <View>
      <View style={[s.row, logged && s.rowDone]}>
        <Text style={s.setNo}>{label}</Text>
        {weighted && (
          <TextInput
            value={shownWeight}
            editable={!logged}
            onChangeText={(t) => {
              const clean = t.replace(/[^0-9.,]/g, "").replace(",", ".");
              if (stack) {
                const pin = parseInt(clean, 10);
                onChange(
                  Number.isFinite(pin)
                    ? {
                        ...value,
                        ...weightFromLoad({ t: "stack", pin }, machine),
                      }
                    : { ...value, weight: "", load: undefined },
                );
              } else
                onChange({ ...value, weight: clean, u: unit, load: undefined });
            }}
            placeholder={stack ? "Pin ?" : "—"}
            placeholderTextColor={color.subtle}
            keyboardType={stack ? "number-pad" : "decimal-pad"}
            selectTextOnFocus
            style={[s.input, warn?.load && s.inputWarn]}
            accessibilityLabel={`Set ${label} ${stack ? "pin" : `weight in ${unit}`} for ${exName}`}
            testID={`weight-${slotN}-${i}`}
          />
        )}
        <TextInput
          value={value.reps}
          editable={!logged}
          onChangeText={(t) =>
            onChange({ ...value, reps: t.replace(/[^0-9]/g, "") })
          }
          placeholder="—"
          placeholderTextColor={color.subtle}
          keyboardType="number-pad"
          selectTextOnFocus
          style={[s.input, warn?.reps && s.inputWarn]}
          accessibilityLabel={`Set ${label} reps for ${exName}`}
          testID={`reps-${slotN}-${i}`}
        />
        <Press
          onPress={onLog}
          style={[s.check, logged && s.checkDone]}
          accessibilityRole="button"
          accessibilityState={{ checked: logged }}
          accessibilityLabel={
            logged
              ? `Set ${label} of ${exName} logged. Tap to undo`
              : `Log set ${label} of ${exName}`
          }
          testID={`log-${slotN}-${i}`}
        >
          <Icon
            name="check"
            size={22}
            color={logged ? color.onAccent : color.text}
          />
        </Press>
      </View>
      {warn && (
        <View style={s.missing} accessibilityLiveRegion="polite">
          <Icon name="alert" size={14} color={color.warn} />
          <Text style={s.missingText}>{warn.message}</Text>
        </View>
      )}
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    empty: { flex: 1, alignItems: "center", gap: space.lg, padding: space.xl },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      paddingHorizontal: space.lg,
      paddingBottom: space.sm,
    },
    title: { ...type.title },
    track: {
      height: 3,
      marginHorizontal: space.lg,
      borderRadius: 2,
      backgroundColor: color.inkTrack,
      overflow: "hidden",
    },
    trackFill: { height: "100%", backgroundColor: color.accent },
    card: { padding: space.lg, gap: space.md },
    cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
    loadRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: space.sm,
    },
    gear: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minHeight: touch.min,
      paddingHorizontal: space.sm,
    },
    gearText: {
      fontFamily: font.bodySemi,
      fontSize: size.small,
      color: color.muted,
    },
    target: {
      flexDirection: "row",
      gap: space.sm,
      alignItems: "flex-start",
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
    setsHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginTop: space.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
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
      textAlign: "center",
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
      textAlign: "center",
      fontFamily: font.display,
      fontSize: size.h3,
      borderWidth: 1,
      borderColor: "transparent",
    },
    inputWarn: { borderColor: color.warnEdge, backgroundColor: color.warnDim },
    check: {
      width: touch.primary,
      height: touch.min,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color.surface3,
    },
    checkDone: { backgroundColor: color.accent },
    missing: {
      flexDirection: "row",
      alignItems: "center",
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
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
      alignSelf: "flex-start",
      minHeight: touch.min,
      paddingHorizontal: space.sm,
    },
    addSetText: {
      fontFamily: font.bodySemi,
      fontSize: size.small,
      color: color.muted,
    },
    notesHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      minHeight: touch.min,
      borderTopWidth: 1,
      borderTopColor: color.line,
      paddingTop: space.sm,
    },
    credit: { ...type.small, fontSize: size.tiny, color: color.subtle },
    pr: {
      position: "absolute",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
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
export { RouteError as ErrorBoundary } from "../components/RouteError";
