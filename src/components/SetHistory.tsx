// Every set you've logged for one exercise, newest session first, each one editable (weight, reps
// or seconds) or deletable. Fixes typos like 222 kg for 22 kg after the fact.
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

type Ref = { date: string; i: number };

export function SetHistory({ id }: { id: string }) {
  const { state, update } = useStore();
  const ex = EXERCISES[id];
  const kind = ex.kind;
  const weighted = kind === 'weight_reps' || kind === 'weight_time';
  const secs = kind === 'time' || kind === 'weight_time';
  const unit = state.unit;
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<(Ref & { w: string; r: string }) | null>(null);
  const [deleting, setDeleting] = useState<Ref | null>(null);
  const dates = Object.keys(state.logs)
    .filter((d) => state.logs[d][id]?.sets.some((x) => x.done))
    .sort()
    .reverse();
  if (!dates.length) return null;
  const shown = all ? dates : dates.slice(0, 5);
  const same = (a: Ref | null, d: string, i: number) => !!a && a.date === d && a.i === i;

  const save = () => {
    if (!editing) return;
    const r = num(editing.r);
    const w = num(editing.w);
    if (!r || r <= 0 || (weighted && (w === null || w < 0))) return;
    const prev = state.logs[editing.date][id].sets[editing.i];
    const next: SetEntry = weighted
      ? { weight: String(w), u: unit, reps: String(Math.round(r)), done: true }
      : { ...prev, reps: String(Math.round(r)), done: true };
    haptic.setDone();
    update((s) => editSet(s, id, editing, next));
    setEditing(null);
  };

  return (
    <Glass r={radius.xl} style={s.card} testID="set-history">
      <Text style={type.label}>Your sets</Text>
      {shown.map((d) => (
        <View key={d} style={s.day}>
          <Text style={s.date}>{formatDate(d)}</Text>
          {state.logs[d][id].sets.map((st, i) =>
            !st.done ? null : same(editing, d, i) ? (
              <View key={i} style={s.editRow}>
                {weighted && (
                  <TextInput
                    value={editing!.w}
                    onChangeText={(t) => setEditing((e) => e && { ...e, w: t.replace(/[^0-9.,]/g, '').replace(',', '.') })}
                    keyboardType="decimal-pad"
                    style={s.input}
                    accessibilityLabel={`Weight in ${unit}`}
                    autoFocus
                  />
                )}
                {weighted && <Text style={type.small}>{unit} ×</Text>}
                <TextInput
                  value={editing!.r}
                  onChangeText={(t) => setEditing((e) => e && { ...e, r: t.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                  style={s.input}
                  accessibilityLabel={secs ? 'Seconds' : 'Reps'}
                  autoFocus={!weighted}
                />
                <Text style={type.small}>{secs ? 's' : 'reps'}</Text>
                <View style={{ flex: 1 }} />
                <Button size="sm" variant="ghost" label="Cancel" onPress={() => setEditing(null)} />
                <Button size="sm" label="Save" onPress={save} testID={`set-save-${d}-${i}`} />
              </View>
            ) : same(deleting, d, i) ? (
              <View key={i} style={s.row}>
                <Text style={[type.small, { flex: 1 }]}>Delete set {i + 1} ({setText(st, kind, unit)})?</Text>
                <Button size="sm" variant="ghost" label="Keep" onPress={() => setDeleting(null)} />
                <Button
                  size="sm"
                  variant="destructive"
                  label="Delete"
                  onPress={() => {
                    haptic.tap();
                    update((s2) => editSet(s2, id, { date: d, i }, null));
                    setDeleting(null);
                  }}
                  testID={`set-delete-yes-${d}-${i}`}
                />
              </View>
            ) : (
              <View key={i} style={s.row}>
                <Text style={s.setNo}>{i + 1}</Text>
                <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                  {setText(st, kind, unit)}
                </Text>
                <IconButton
                  icon="edit"
                  label={`Edit set ${i + 1} on ${formatDate(d)}`}
                  onPress={() => {
                    setDeleting(null);
                    // Shown in your unit (a set logged in the other unit is converted).
                    const kg = kgOf(st);
                    const inUnit = kg === null ? '' : !st.u || st.u === unit ? st.weight : round1(fromKg(kg, unit));
                    setEditing({ date: d, i, w: inUnit, r: st.reps });
                  }}
                />
                <IconButton
                  icon="trash"
                  label={`Delete set ${i + 1} on ${formatDate(d)}`}
                  onPress={() => {
                    setEditing(null);
                    setDeleting({ date: d, i });
                  }}
                />
              </View>
            ),
          )}
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
