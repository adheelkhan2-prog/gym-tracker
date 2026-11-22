import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, Chip, Press, Screen, SectionTitle } from '../../components/ui';
import { EXERCISES } from '../../data/exercises';
import { DAYS, DEFAULT_WEEK, WEEKDAY_SHORT, pickOption } from '../../data/program';
import { haptic } from '../../feedback';
import { useStore } from '../../store';
import { color, font, size, space, touch, type } from '../../theme';

// Monday-first ordering for display.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const CYCLE: (string | null)[] = [...DAYS.map((d) => d.id), null];

const CREDITS = [
  { label: 'Z-Anatomy (CC BY-SA 4.0)', url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy' },
  { label: 'BodyParts3D, © The Database Center for Life Science', url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/' },
  { label: 'Gymmetry muscle map model', url: 'https://github.com/kalibismail/gymmetry-muscle-model' },
  { label: 'Licence: CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
];

export default function SettingsScreen() {
  const { state, update } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const slots = DAYS.flatMap((d) => d.exercises.filter((e) => e.options.length > 1).map((e) => ({ day: d, plan: e })));

  const cycleDay = (weekday: number) =>
    update((s) => {
      const week = [...s.week];
      week[weekday] = CYCLE[(CYCLE.indexOf(week[weekday]) + 1) % CYCLE.length];
      return { ...s, week };
    });

  return (
    <Screen>
      <Text style={type.display} accessibilityRole="header">
        Settings
      </Text>

      <SectionTitle>Weight unit</SectionTitle>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Pounds (lb)" active={state.unit === 'lb'} onPress={() => update((s) => ({ ...s, unit: 'lb' }))} />
        <Chip label="Kilograms (kg)" active={state.unit === 'kg'} onPress={() => update((s) => ({ ...s, unit: 'kg' }))} />
      </View>

      <SectionTitle
        right={
          <Press onPress={() => update((s) => ({ ...s, week: DEFAULT_WEEK }))} style={s.link} accessibilityRole="button">
            <Text style={s.linkText}>Reset</Text>
          </Press>
        }
      >
        Day order
      </SectionTitle>
      <Text style={[type.small, { marginBottom: space.md }]}>Tap a day to change which workout it gets.</Text>
      <Card style={{ padding: 0 }}>
        {ORDER.map((wd, i) => {
          const day = DAYS.find((d) => d.id === state.week[wd]);
          return (
            <Press
              key={wd}
              onPress={() => {
                haptic.tap();
                cycleDay(wd);
              }}
              style={[s.row, i > 0 && s.divider]}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAY_SHORT[wd]}: ${day?.name ?? 'Rest'}. Tap to change.`}
            >
              <Text style={s.wd}>{WEEKDAY_SHORT[wd]}</Text>
              <Text style={[s.dayName, !day && { color: color.subtle }]} numberOfLines={1}>
                {day?.name ?? 'Rest'}
              </Text>
              <Ionicons name="swap-horizontal" size={18} color={color.subtle} />
            </Press>
          );
        })}
      </Card>

      <SectionTitle>Exercise choices</SectionTitle>
      <View style={{ gap: space.md }}>
        {slots.map(({ day, plan }) => {
          const current = pickOption(plan, state.variants);
          return (
            <Card key={plan.slot} style={{ gap: space.sm }}>
              <Text style={type.small}>{day.name}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {plan.options.map((o) => (
                  <Chip
                    key={o}
                    label={EXERCISES[o].name}
                    active={o === current}
                    onPress={() => update((s) => ({ ...s, variants: { ...s.variants, [plan.slot]: o } }))}
                  />
                ))}
              </View>
            </Card>
          );
        })}
      </View>

      <SectionTitle>Injury mode</SectionTitle>
      <Card style={s.switchRow}>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text style={type.h3}>Legs & abs resting</Text>
          <Text style={type.small}>
            {state.injured
              ? 'No leg or ab work is planned, and they show as resting on the heat map.'
              : 'Legs and abs show on the heat map again. Ask for a leg day to be added to your program.'}
          </Text>
        </View>
        <Switch
          value={state.injured}
          onValueChange={(v) => update((s) => ({ ...s, injured: v }))}
          trackColor={{ true: color.orange, false: color.surface3 }}
          thumbColor={color.text}
          {...{ activeThumbColor: color.text }}
          accessibilityLabel="Injury mode"
        />
      </Card>

      <SectionTitle>3D model credits</SectionTitle>
      <Card style={{ gap: space.xs }}>
        <Text style={type.small}>
          The muscle model is adapted from Z-Anatomy, based on BodyParts3D, via the Gymmetry muscle map. Changes: compressed for
          mobile. Shared under the same licence.
        </Text>
        {CREDITS.map((c) => (
          <Press key={c.url} onPress={() => Linking.openURL(c.url)} style={s.credit} accessibilityRole="link">
            <Ionicons name="open-outline" size={16} color={color.lime} />
            <Text style={s.creditText}>{c.label}</Text>
          </Press>
        ))}
        <Text style={[type.small, { marginTop: space.sm }]}>Fonts: Bricolage Grotesque and Figtree (SIL Open Font License).</Text>
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Text style={[type.small, { marginBottom: space.md }]}>Everything is stored on this phone only.</Text>
      {confirmDelete ? (
        <Card style={{ gap: space.md }}>
          <Text style={type.h3}>Delete all workout history? This can’t be undone.</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" kind="ghost" onPress={() => setConfirmDelete(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Delete"
                kind="danger"
                icon="trash"
                onPress={() => {
                  update((s) => ({ ...s, logs: {}, sessions: {}, warmups: {} }));
                  setConfirmDelete(false);
                }}
              />
            </View>
          </View>
        </Card>
      ) : (
        <Button label="Delete workout history" kind="danger" icon="trash-outline" onPress={() => setConfirmDelete(true)} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, minHeight: 60 },
  divider: { borderTopWidth: 1, borderTopColor: color.line },
  wd: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.muted, width: 40 },
  dayName: { flex: 1, fontFamily: font.display, fontSize: size.body, color: color.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  link: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.sm },
  linkText: { fontFamily: font.bodyBold, fontSize: size.small, color: color.lime },
  credit: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.min },
  creditText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.small, color: color.text },
});
