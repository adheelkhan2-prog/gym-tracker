import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop, Glass } from '../components/glass';
import { Icon, type IconName } from '../components/icons';
import { LibrarySheet } from '../components/ProgramParts';
import { Button, IconButton, Press } from '../components/ui';
import { EXERCISES } from '../data/exercises';
import { PROGRAMS, type Program } from '../data/programs';
import { type PlannedExercise, type WorkoutDay } from '../data/program';
import { haptic } from '../feedback';
import { useStore } from '../store';
import { color, fmtClock, font, leading, radius, size, space, touch, type } from '../theme';

const RESTS: (number | undefined)[] = [undefined, 60, 90, 120, 180];
const uid = () => Math.random().toString(36).slice(2, 8);

const move = <T,>(xs: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= xs.length) return xs;
  const out = [...xs];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

function Tiny({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled} style={[s.tiny, disabled && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={16} color={color.muted} />
    </Press>
  );
}

type Picking = { day: number; replace?: number } | null;

export default function BuilderScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { state, update } = useStore();
  const existing = state.customPrograms.find((p) => p.id === id);
  const [draft, setDraft] = useState<Program>(
    () =>
      existing ?? {
        id: `custom-${uid()}`,
        name: 'My split',
        focus: '',
        blurb: 'Built by you.',
        custom: true,
        days: [{ id: `cd-${uid()}`, name: 'Day 1', focus: '', exercises: [] }],
        week: [null, null, null, null, null, null, null],
      },
  );
  const [picking, setPicking] = useState<Picking>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setDays = (fn: (d: WorkoutDay[]) => WorkoutDay[]) => setDraft((p) => ({ ...p, days: fn(p.days) }));
  const setDay = (i: number, fn: (d: WorkoutDay) => WorkoutDay) => setDays((ds) => ds.map((d, j) => (j === i ? fn(d) : d)));
  const setEx = (di: number, ei: number, patch: Partial<PlannedExercise>) =>
    setDay(di, (d) => ({ ...d, exercises: d.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) }));

  const pick = (exId: string) => {
    if (!picking) return;
    haptic.tap();
    const { day, replace } = picking;
    // A replaced exercise gets a fresh slot so an old swap or variant choice for the slot can't override it.
    if (replace !== undefined) setDay(day, (d) => ({ ...d, exercises: d.exercises.map((e, j) => (j === replace ? { ...e, slot: `${d.id}-${uid()}`, options: [exId] } : e)) }));
    else
      setDay(day, (d) => ({
        ...d,
        exercises: [...d.exercises, { slot: `${d.id}-${uid()}`, options: [exId], sets: 3, target: EXERCISES[exId].kind === 'time' ? '30-60' : '8-12' }],
      }));
    setPicking(null);
  };

  const valid = draft.name.trim().length > 0 && draft.days.length > 0 && draft.days.every((d) => d.exercises.length > 0);

  const save = () => {
    // Keep weekday choices for days that still exist; give new days the first free weekdays from Monday.
    const ids = draft.days.map((d) => d.id);
    const fit = (base: (string | null)[]) => {
      const week = base.map((w) => (w && ids.includes(w) ? w : null));
      for (const d of draft.days) {
        if (week.includes(d.id)) continue;
        const free = [1, 2, 3, 4, 5, 6, 0].find((wd) => week[wd] === null);
        if (free !== undefined) week[free] = d.id;
      }
      return week;
    };
    const p: Program = { ...draft, name: draft.name.trim(), week: fit(draft.week), focus: `${draft.days.length} day${draft.days.length === 1 ? '' : 's'}: ${draft.days.map((d) => d.name).join(', ')}` };
    haptic.setDone();
    update((st) => {
      const others = st.customPrograms.filter((x) => x.id !== p.id);
      // The active split keeps the weekday mapping you chose; a booked switch is cleaned up the same way.
      return {
        ...st,
        customPrograms: [...others, p],
        week: st.programId === p.id ? fit(st.week) : st.week,
        pending: st.pending?.programId === p.id ? { ...st.pending, week: fit(st.pending.week) } : st.pending,
      };
    });
    router.back();
  };

  const remove = () => {
    update((st) => ({
      ...st,
      customPrograms: st.customPrograms.filter((x) => x.id !== draft.id),
      ...(st.programId === draft.id ? { programId: PROGRAMS[0].id, week: PROGRAMS[0].week } : {}),
      pending: st.pending?.programId === draft.id ? null : st.pending,
    }));
    router.back();
  };

  return (
    <Backdrop>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.x5 }}>
        <View style={s.header}>
          <IconButton icon="back" label="Back without saving" onPress={() => router.back()} />
          <Button size="sm" label="Save" icon="check" disabled={!valid} onPress={save} />
        </View>
        <View style={s.pad}>
          <Text style={s.title} accessibilityRole="header">
            {existing ? 'Edit split' : 'Build a split'}
          </Text>
          <TextInput
            value={draft.name}
            onChangeText={(t) => setDraft((p) => ({ ...p, name: t }))}
            style={s.nameInput}
            placeholder="Split name"
            placeholderTextColor={color.subtle}
            accessibilityLabel="Split name"
          />
          {!valid && <Text style={[type.small, { marginTop: space.xs }]}>Give every day at least one exercise to save.</Text>}

          {draft.days.map((d, di) => (
            <Glass key={d.id} r={radius.xxl} style={s.day}>
              <View style={s.dayHead}>
                <TextInput
                  value={d.name}
                  onChangeText={(t) => setDay(di, (x) => ({ ...x, name: t }))}
                  style={s.dayName}
                  accessibilityLabel={`Day ${di + 1} name`}
                  placeholder={`Day ${di + 1}`}
                  placeholderTextColor={color.subtle}
                />
                <Tiny icon="arrowUp" label={`Move ${d.name} up`} disabled={di === 0} onPress={() => setDays((ds) => move(ds, di, -1))} />
                <Tiny icon="arrowDown" label={`Move ${d.name} down`} disabled={di === draft.days.length - 1} onPress={() => setDays((ds) => move(ds, di, 1))} />
                <Tiny icon="trash" label={`Remove ${d.name}`} disabled={draft.days.length === 1} onPress={() => setDays((ds) => ds.filter((_, j) => j !== di))} />
              </View>

              {d.exercises.map((e, ei) => {
                const ex = EXERCISES[e.options[0]];
                return (
                  <View key={e.slot} style={s.exRow}>
                    <View style={s.exTop}>
                      <Press onPress={() => setPicking({ day: di, replace: ei })} style={s.exName} accessibilityRole="button" accessibilityLabel={`${ex.name}. Tap to swap`}>
                        <Text style={s.exNameText} numberOfLines={1}>
                          {ex.name}
                        </Text>
                        <Icon name="swap" size={14} color={color.subtle} />
                      </Press>
                      <Tiny icon="arrowUp" label={`Move ${ex.name} up`} disabled={ei === 0} onPress={() => setDay(di, (x) => ({ ...x, exercises: move(x.exercises, ei, -1) }))} />
                      <Tiny icon="arrowDown" label={`Move ${ex.name} down`} disabled={ei === d.exercises.length - 1} onPress={() => setDay(di, (x) => ({ ...x, exercises: move(x.exercises, ei, 1) }))} />
                      <Tiny icon="close" label={`Remove ${ex.name}`} onPress={() => setDay(di, (x) => ({ ...x, exercises: x.exercises.filter((_, j) => j !== ei) }))} />
                    </View>
                    <View style={s.exBottom}>
                      <View style={s.stepper}>
                        <Tiny icon="minus" label="Fewer sets" disabled={e.sets <= 1} onPress={() => setEx(di, ei, { sets: e.sets - 1 })} />
                        <Text style={s.stepVal}>{e.sets}</Text>
                        <Tiny icon="plus" label="More sets" disabled={e.sets >= 10} onPress={() => setEx(di, ei, { sets: e.sets + 1 })} />
                        <Text style={s.stepUnit}>sets</Text>
                      </View>
                      <TextInput
                        value={e.target}
                        onChangeText={(t) => setEx(di, ei, { target: t.replace(/[^0-9a-z-]/gi, '').slice(0, 7) })}
                        style={s.target}
                        accessibilityLabel={`${ex.name} target ${ex.kind === 'time' || ex.kind === 'weight_time' ? 'seconds' : 'reps'}`}
                      />
                      <Text style={s.stepUnit}>{ex.kind === 'time' || ex.kind === 'weight_time' ? 's' : 'reps'}</Text>
                      <Press
                        onPress={() => setEx(di, ei, { rest: RESTS[(RESTS.indexOf(e.rest) + 1) % RESTS.length] })}
                        style={s.rest}
                        accessibilityRole="button"
                        accessibilityLabel={`Rest ${e.rest ? fmtClock(e.rest) : 'automatic'}. Tap to change`}
                      >
                        <Icon name="timer" size={14} color={color.accent} />
                        <Text style={s.restText}>{e.rest ? fmtClock(e.rest) : 'Auto'}</Text>
                      </Press>
                    </View>
                  </View>
                );
              })}
              <Button size="sm" variant="secondary" icon="plus" label="Add exercise" onPress={() => setPicking({ day: di })} />
            </Glass>
          ))}

          {draft.days.length < 7 && (
            <View style={{ marginTop: space.lg }}>
              <Button
                variant="outline"
                icon="plus"
                label="Add day"
                onPress={() => setDays((ds) => [...ds, { id: `cd-${uid()}`, name: `Day ${ds.length + 1}`, focus: '', exercises: [] }])}
              />
            </View>
          )}
          <Text style={[type.small, { marginTop: space.md }]}>
            Rest “Auto” uses 2 min on heavy compounds and 90 s on everything else. Pick weekdays when you switch to this split.
          </Text>

          {existing && (
            <View style={{ marginTop: space.xxl }}>
              {confirmDelete ? (
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button variant="secondary" label="Keep it" onPress={() => setConfirmDelete(false)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button variant="destructive" icon="trash" label="Delete split" onPress={remove} />
                  </View>
                </View>
              ) : (
                <Button variant="ghost" icon="trash" label="Delete this split (logs stay)" onPress={() => setConfirmDelete(true)} />
              )}
            </View>
          )}
        </View>
      </ScrollView>
      {picking && (
        <LibrarySheet
          title={picking.replace !== undefined ? 'Swap exercise' : 'Add exercise'}
          injured={state.injured}
          onPick={pick}
          onClose={() => setPicking(null)}
        />
      )}
    </Backdrop>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  pad: { paddingHorizontal: space.lg },
  title: { fontFamily: font.display, fontSize: size.display, lineHeight: leading.display, letterSpacing: -1.2, color: color.text, marginTop: space.md },
  nameInput: {
    marginTop: space.md,
    minHeight: touch.primary,
    borderRadius: radius.lg,
    backgroundColor: color.glassSolid,
    borderWidth: 1,
    borderColor: color.glassBorder,
    paddingHorizontal: space.lg,
    color: color.text,
    fontFamily: font.display,
    fontSize: size.h2,
  },
  day: { marginTop: space.lg, padding: space.lg, gap: space.sm },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dayName: { flex: 1, minWidth: 0, minHeight: touch.min, color: color.accent, fontFamily: font.display, fontSize: size.h2 },
  tiny: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  exRow: { backgroundColor: color.surface2, borderRadius: radius.lg, padding: space.sm, gap: space.xs },
  exTop: { flexDirection: 'row', alignItems: 'center' },
  exName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touch.min, paddingHorizontal: space.xs, borderRadius: radius.sm },
  exNameText: { flexShrink: 1, fontFamily: font.bodyBlack, fontSize: size.small, color: color.text },
  exBottom: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepVal: { fontFamily: font.display, fontSize: size.h3, color: color.text, minWidth: 20, textAlign: 'center' },
  stepUnit: { fontFamily: font.bodyBold, fontSize: size.label, color: color.muted, marginRight: space.xs },
  target: { width: 72, minHeight: 40, borderRadius: radius.sm, backgroundColor: color.surface3, color: color.text, textAlign: 'center', fontFamily: font.display, fontSize: size.body },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: color.accentDim, marginLeft: 'auto' },
  restText: { fontFamily: font.bodyBlack, fontSize: size.label, color: color.accentText },
});
