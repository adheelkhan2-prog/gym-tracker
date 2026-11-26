// Logged sets you can fix after the fact: each one editable (pin or weight, reps or seconds) or
// deletable. SetLine is one set; SetHistory lists every session of one exercise (newest first); the
// workout calendar uses SetLine for every exercise of one day.
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { EXERCISES } from '../data/exercises';
import { haptic } from '../feedback';
import { fromKg, round1 } from '../load';
import { editSet, formatDate, kgOf, num, useStore, type SetEntry } from '../store';
import { color, font, radius, size, space, themed, touch, type } from '../theme';
import { setText } from '../workout';
import { Glass } from './glass';
import { Button, IconButton } from './ui';

/** A row key that changes when the set at an index changes (e.g. after a delete above it), so an
 * open editor can never end up pointing at a different set. */
export const setKey = (i: number, st: SetEntry) => `${i}:${st.weight}:${st.u ?? ''}:${st.reps}:${st.load?.pin ?? ''}`;

/** One logged set: "2  60 kg × 8", with edit and delete. `trophy` marks a PR set. */
export function SetLine({ id, date, i, set, trophy }: { id: string; date: string; i: number; set: SetEntry; trophy?: boolean }) {
  const { state, update } = useStore();
  const ex = EXERCISES[id];
  const kind = ex?.kind ?? 'weight_reps';
  const weighted = kind === 'weight_reps' || kind === 'weight_time';
  const secs = kind === 'time' || kind === 'weight_time';
  // A set logged by pin stays a pin when edited (even one that also stored kg).
  const pin = set.load?.pin !== undefined;
  const unit = state.unit;
  const [edit, setEdit] = useState<{ w: string; r: string } | null>(null);
  const [del, setDel] = useState(false);
  const label = `set ${i + 1} on ${formatDate(date)}`;

  const save = () => {
    if (!edit) return;
    const r = num(edit.r);
    const w = num(edit.w);
    if (!r || r <= 0 || (weighted && (w === null || w < 0))) return;
    const reps = String(Math.round(r));
    const next: SetEntry = !weighted
      ? { ...set, reps, done: true }
      : pin
        ? { weight: '', u: 'kg', reps, load: { t: 'stack', pin: Math.max(1, Math.round(w!)) }, done: true }
        : { weight: String(w), u: unit, reps, done: true };
    haptic.setDone();
    update((s) => editSet(s, id, { date, i }, next));
    setEdit(null);
  };

  if (edit)
    return (
      <View style={s.editRow}>
        {weighted && (
          <TextInput
            value={edit.w}
            onChangeText={(t) => setEdit((e) => e && { ...e, w: t.replace(pin ? /[^0-9]/g : /[^0-9.,]/g, '').replace(',', '.') })}
            keyboardType={pin ? 'number-pad' : 'decimal-pad'}
            style={s.input}
            accessibilityLabel={pin ? 'Pin' : `Weight in ${unit}`}
            cursorColor={color.accent}
            autoFocus
          />
        )}
        {weighted && <Text style={type.small}>{pin ? 'pin ×' : `${unit} ×`}</Text>}
        <TextInput
          value={edit.r}
          onChangeText={(t) => setEdit((e) => e && { ...e, r: t.replace(/[^0-9]/g, '') })}
          keyboardType="number-pad"
          style={s.input}
          accessibilityLabel={secs ? 'Seconds' : 'Reps'}
          cursorColor={color.accent}
          autoFocus={!weighted}
        />
        <Text style={type.small}>{secs ? 's' : 'reps'}</Text>
        <View style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" label="Cancel" onPress={() => setEdit(null)} />
        <Button size="sm" label="Save" onPress={save} testID={`set-save-${id}-${date}-${i}`} />
      </View>
    );
  if (del)
    return (
      <View style={s.row}>
        <Text style={[type.small, { flex: 1 }]}>
          Delete set {i + 1} ({setText(set, kind, unit)})?
        </Text>
        <Button size="sm" variant="ghost" label="Keep" onPress={() => setDel(false)} />
        <Button
          size="sm"
          variant="destructive"
          label="Delete"
          onPress={() => {
            haptic.tap();
            update((s2) => editSet(s2, id, { date, i }, null));
            setDel(false);
          }}
          testID={`set-delete-yes-${id}-${date}-${i}`}
        />
      </View>
    );
  return (
    <View style={s.row}>
      <Text style={s.setNo}>{i + 1}</Text>
      <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
        {setText(set, kind, unit)}
        {trophy ? '  🏆' : ''}
      </Text>
      <IconButton
        icon="edit"
        label={`Edit ${label}`}
        onPress={() => {
          // Shown in your unit (a set logged in the other unit is converted); a pin stays a pin.
          const kg = kgOf(set);
          const w = pin ? String(set.load!.pin) : kg === null ? '' : !set.u || set.u === unit ? set.weight : round1(fromKg(kg, unit));
          setDel(false);
          setEdit({ w, r: set.reps });
        }}
      />
      <IconButton icon="trash" label={`Delete ${label}`} onPress={() => setDel(true)} />
    </View>
  );
}

/** Every logged set of one exercise, newest session first. */
export function SetHistory({ id }: { id: string }) {
  const { state } = useStore();
  const [all, setAll] = useState(false);
  const dates = Object.keys(state.logs)
    .filter((d) => state.logs[d][id]?.sets.some((x) => x.done))
    .sort()
    .reverse();
  if (!dates.length) return null;
  const shown = all ? dates : dates.slice(0, 5);
  return (
    <Glass r={radius.xl} style={s.card} testID="set-history">
      <Text style={type.label}>Your sets</Text>
      {shown.map((d) => (
        <View key={d} style={s.day}>
          <Text style={s.date}>{formatDate(d)}</Text>
          {state.logs[d][id].sets.map((st, i) => (st.done ? <SetLine key={setKey(i, st)} id={id} date={d} i={i} set={st} /> : null))}
        </View>
      ))}
      {dates.length > 5 && <Button variant="ghost" size="sm" label={all ? 'Show fewer' : `Show all ${dates.length} sessions`} onPress={() => setAll((v) => !v)} />}
    </Glass>
  );
}

const s = themed(() =>
  StyleSheet.create({
    card: { padding: space.lg, gap: space.sm },
    day: { gap: 2, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.line },
    date: { fontFamily: font.bodyBold, fontSize: size.small, color: color.muted },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.min },
    setNo: { width: 22, fontFamily: font.display, fontSize: size.body, color: color.subtle, textAlign: 'center' },
    editRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, minHeight: touch.min, paddingVertical: space.xs },
    input: {
      width: 72,
      minHeight: 44,
      borderRadius: radius.md,
      backgroundColor: color.surface2,
      color: color.text,
      textAlign: 'center',
      fontFamily: font.display,
      fontSize: size.body,
      borderWidth: 1,
      borderColor: color.accentEdge,
    },
  }),
);
