import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Glass } from '../../components/glass';
import { Icon, type IconName } from '../../components/icons';
import { Button, Chip, Press, Screen, SectionTitle, Switch } from '../../components/ui';
import { EXERCISES } from '../../data/exercises';
import { DAYS, DEFAULT_WEEK, WEEKDAY_SHORT, pickOption } from '../../data/program';
import { useStore } from '../../store';
import { color, dayTitle, font, leading, radius, size, space, touch, type } from '../../theme';

// Monday-first ordering for display.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const CYCLE: (string | null)[] = [...DAYS.map((d) => d.id), null];

const CREDITS = [
  { label: 'Z-Anatomy (CC BY-SA 4.0)', url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy' },
  { label: 'BodyParts3D, © The Database Center for Life Science', url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/' },
  { label: 'Gymmetry muscle map model', url: 'https://github.com/kalibismail/gymmetry-muscle-model' },
  { label: 'Licence: CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
];

function Toggle({ icon, title, sub, checked, onChange }: { icon: IconName; title: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.toggle}>
      <View style={s.toggleIcon}>
        <Icon name={icon} size={20} color={checked ? color.lime : color.muted} filled={checked} />
      </View>
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text style={type.h3}>{title}</Text>
        <Text style={type.small}>{sub}</Text>
      </View>
      <Switch checked={checked} onCheckedChange={onChange} label={title} />
    </View>
  );
}

export default function SettingsScreen() {
  const { state, update } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const slots = DAYS.flatMap((d) => d.exercises.filter((e) => e.options.length > 1).map((e) => ({ day: d, plan: e })));

  const cycleDay = (weekday: number) =>
    update((st) => {
      const week = [...st.week];
      week[weekday] = CYCLE[(CYCLE.indexOf(week[weekday]) + 1) % CYCLE.length];
      return { ...st, week };
    });

  return (
    <Screen padBottom={140}>
      <Text style={s.title} accessibilityRole="header">
        Settings
      </Text>

      <SectionTitle>Weight unit</SectionTitle>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Pounds (lb)" active={state.unit === 'lb'} onPress={() => update((st) => ({ ...st, unit: 'lb' }))} />
        <Chip label="Kilograms (kg)" active={state.unit === 'kg'} onPress={() => update((st) => ({ ...st, unit: 'kg' }))} />
      </View>

      <SectionTitle>Feel</SectionTitle>
      <Glass r={radius.xxl}>
        <Toggle
          icon="sound"
          title="Rest timer sound"
          sub="A short beep when rest ends (haptics always on)."
          checked={state.restSound}
          onChange={(v) => update((st) => ({ ...st, restSound: v }))}
        />
        <View style={s.divider} />
        <Toggle
          icon="layers"
          title="Frosted glass"
          sub="Real blur on Android 12+. Turn off for extra speed on older phones."
          checked={state.blur}
          onChange={(v) => update((st) => ({ ...st, blur: v }))}
        />
        <View style={s.divider} />
        <Toggle
          icon="bandage"
          title="Injury mode"
          sub={state.injured ? 'No leg or ab work; they show as resting on the heat map.' : 'Legs and abs show on the heat map again.'}
          checked={state.injured}
          onChange={(v) => update((st) => ({ ...st, injured: v }))}
        />
      </Glass>

      <SectionTitle
        right={
          <Press onPress={() => update((st) => ({ ...st, week: DEFAULT_WEEK }))} style={s.link} accessibilityRole="button">
            <Text style={s.linkText}>Reset</Text>
          </Press>
        }
      >
        Day order
      </SectionTitle>
      <Text style={[type.small, { marginBottom: space.md }]}>Tap a day to change which workout it gets.</Text>
      <Glass r={radius.xxl}>
        {ORDER.map((wd, i) => {
          const day = DAYS.find((d) => d.id === state.week[wd]);
          return (
            <Press
              key={wd}
              onPress={() => cycleDay(wd)}
              style={[s.row, i > 0 && s.divider, { borderRadius: 0 }]}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAY_SHORT[wd]}: ${day ? dayTitle[day.id] : 'Rest'}. Tap to change.`}
            >
              <Text style={s.wd}>{WEEKDAY_SHORT[wd]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.dayName, !day && { color: color.subtle }]}>{day ? dayTitle[day.id] : 'Rest'}</Text>
                {day && <Text style={type.small}>{day.name}</Text>}
              </View>
              <Icon name="swap" size={18} color={color.subtle} />
            </Press>
          );
        })}
      </Glass>

      <SectionTitle>Exercise choices</SectionTitle>
      <View style={{ gap: space.md }}>
        {slots.map(({ day, plan }) => {
          const current = pickOption(plan, state.variants);
          return (
            <Glass key={plan.slot} r={radius.xl} style={{ gap: space.sm, padding: space.lg }}>
              <Text style={type.label}>{dayTitle[day.id]}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {plan.options.map((o) => (
                  <Chip key={o} label={EXERCISES[o].name} active={o === current} onPress={() => update((st) => ({ ...st, variants: { ...st.variants, [plan.slot]: o } }))} />
                ))}
              </View>
            </Glass>
          );
        })}
      </View>

      <SectionTitle>3D model credits</SectionTitle>
      <Glass r={radius.xl} style={{ gap: space.xs, padding: space.lg }}>
        <Text style={type.small}>
          The muscle model is adapted from Z-Anatomy, based on BodyParts3D, via the Gymmetry muscle map. Changes: compressed for mobile.
          Shared under the same licence.
        </Text>
        {CREDITS.map((c) => (
          <Press key={c.url} onPress={() => Linking.openURL(c.url)} style={s.credit} accessibilityRole="link">
            <Icon name="link" size={16} color={color.lime} />
            <Text style={s.creditText}>{c.label}</Text>
          </Press>
        ))}
        <Text style={[type.small, { marginTop: space.sm }]}>
          Fonts: Bricolage Grotesque and Figtree (SIL Open Font License). Component structure after react-native-reusables (MIT).
        </Text>
      </Glass>

      <SectionTitle>Data</SectionTitle>
      <Text style={[type.small, { marginBottom: space.md }]}>Everything is stored on this phone only.</Text>
      {confirmDelete ? (
        <Glass r={radius.xl} style={{ gap: space.md, padding: space.lg }}>
          <Text style={type.h3}>Delete all workout history? This can’t be undone.</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label="Cancel" onPress={() => setConfirmDelete(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="destructive"
                icon="trash"
                label="Delete"
                onPress={() => {
                  update((st) => ({ ...st, logs: {}, sessions: {}, warmups: {} }));
                  setConfirmDelete(false);
                }}
              />
            </View>
          </View>
        </Glass>
      ) : (
        <Button variant="destructive" icon="trash" label="Delete workout history" onPress={() => setConfirmDelete(true)} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: font.display, fontSize: size.numXL, lineHeight: leading.numXL, letterSpacing: -2, color: color.text },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  toggleIcon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, minHeight: 64 },
  divider: { borderTopWidth: 1, borderTopColor: color.line },
  wd: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.lime, width: 40 },
  dayName: { fontFamily: font.display, fontSize: size.body, color: color.text },
  link: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.sm, borderRadius: radius.pill },
  linkText: { fontFamily: font.bodyBold, fontSize: size.small, color: color.lime },
  credit: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.min, borderRadius: radius.sm },
  creditText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.small, color: color.text },
});
