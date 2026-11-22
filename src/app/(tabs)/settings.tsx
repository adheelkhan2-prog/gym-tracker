import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { NumberField } from '../../components/ExerciseParts';
import { Glass } from '../../components/glass';
import { Icon, type IconName } from '../../components/icons';
import { WeekMapper } from '../../components/ProgramParts';
import { Button, Chip, Press, Screen, SectionTitle, Switch } from '../../components/ui';
import { EXERCISES } from '../../data/exercises';
import { pickOption } from '../../data/program';
import { DEFAULT_GYM, fmtPlate, type PlateColor } from '../../load';
import { activeProgram, easingIn, todayKey, useStore } from '../../store';
import { color, font, leading, radius, size, space, touch, type } from '../../theme';

const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
const SWATCHES = ['#E5322D', '#2F6BFF', '#F5C518', '#2DBE60', '#F2F2F2', '#1A1A1A', '#FF7A1A', '#8E5CFF'];

const CREDITS = [
  { label: 'Z-Anatomy (CC BY-SA 4.0)', url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy' },
  { label: 'BodyParts3D, © The Database Center for Life Science', url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/' },
  { label: 'Gymmetry muscle map model', url: 'https://github.com/kalibismail/gymmetry-muscle-model' },
  { label: 'Licence: CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { label: 'Exercise photos: free-exercise-db (Unlicense)', url: 'https://github.com/yuhonas/free-exercise-db' },
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
  const program = activeProgram(state);
  const slots = program.days.flatMap((d) => d.exercises.filter((e) => e.options.length > 1).map((e) => ({ day: d, plan: e })));
  const gym = state.gym;
  const setGym = (patch: Partial<typeof gym>) => update((st) => ({ ...st, gym: { ...st.gym, ...patch } }));
  const setColor = (i: number, patch: Partial<PlateColor>) => setGym({ colors: gym.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const machines = Object.entries(state.machines).filter(([id, m]) => EXERCISES[id] && (m.perPlate || m.start || m.bar !== undefined));

  return (
    <Screen padBottom={140}>
      <Text style={s.title} accessibilityRole="header">
        Settings
      </Text>

      <SectionTitle>Weight unit</SectionTitle>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Kilograms (kg)" active={state.unit === 'kg'} onPress={() => update((st) => ({ ...st, unit: 'kg' }))} />
        <Chip label="Pounds (lb)" active={state.unit === 'lb'} onPress={() => update((st) => ({ ...st, unit: 'lb' }))} />
      </View>
      <Text style={[type.small, { marginTop: space.sm }]}>Converts everywhere. Old sets keep the unit you logged them in.</Text>

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
          sub={
            state.injured
              ? 'Leg and ab exercises, and splits built around them, are hidden. Legs and abs rest grey on the model.'
              : 'Every split and exercise is unlocked.'
          }
          checked={state.injured}
          onChange={(v) => update((st) => ({ ...st, injured: v, easeInFrom: v ? null : todayKey(), easeInDismissed: false }))}
        />
      </Glass>
      {easingIn(state) && (
        <Glass r={radius.xl} style={s.welcome} glow={color.lime}>
          <Text style={type.h3}>Welcome back. Ease in.</Text>
          <Text style={type.small}>
            Legs and abs are back. For the first 2 weeks, use about half your old leg weights, stop 3–4 reps short of failure, and add load only when it feels easy.
          </Text>
        </Glass>
      )}

      <SectionTitle
        right={
          <Press onPress={() => router.push('/programs')} style={s.link} accessibilityRole="button">
            <Text style={s.linkText}>All programs</Text>
          </Press>
        }
      >
        Program
      </SectionTitle>
      <Glass r={radius.xxl} style={{ padding: space.lg, gap: space.md }}>
        <View>
          <Text style={type.h3}>{program.name}</Text>
          <Text style={type.small}>{program.focus}</Text>
        </View>
        <Text style={type.label}>Day order</Text>
        <WeekMapper program={program} week={state.week} onChange={(week) => update((st) => ({ ...st, week }))} />
        <Button size="sm" variant="ghost" label="Reset to the program’s default week" onPress={() => update((st) => ({ ...st, week: program.week }))} />
      </Glass>

      {slots.length > 0 && <SectionTitle>Exercise choices</SectionTitle>}
      <View style={{ gap: space.md }}>
        {slots.map(({ day, plan }) => {
          const current = pickOption(plan, state.variants);
          return (
            <Glass key={plan.slot} r={radius.xl} style={{ gap: space.sm, padding: space.lg }}>
              <Text style={type.label}>{day.name}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {plan.options.map((o) => (
                  <Chip key={o} label={EXERCISES[o].name} active={o === current} onPress={() => update((st) => ({ ...st, variants: { ...st.variants, [plan.slot]: o } }))} />
                ))}
              </View>
            </Glass>
          );
        })}
      </View>

      <SectionTitle
        right={
          <Press onPress={() => setGym(DEFAULT_GYM)} style={s.link} accessibilityRole="button">
            <Text style={s.linkText}>Reset</Text>
          </Press>
        }
      >
        My gym
      </SectionTitle>
      <Glass r={radius.xxl} style={{ padding: space.lg, gap: space.xl }}>
        <View style={s.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>Bar weight</Text>
            <Text style={type.small}>kg, used for barbell plate maths.</Text>
          </View>
          <NumberField value={gym.bar} onChange={(n) => setGym({ bar: n })} label="Bar weight in kilograms" />
        </View>
        <View style={{ gap: space.sm }}>
          <Text style={type.h3}>Plates you have (kg)</Text>
          <View style={s.wrap}>
            {ALL_PLATES.map((p) => {
              const on = gym.plates.includes(p);
              return (
                <Chip
                  key={p}
                  label={fmtPlate(p)}
                  active={on}
                  onPress={() => setGym({ plates: on ? gym.plates.filter((x) => x !== p) : [...gym.plates, p].sort((a, b) => b - a) })}
                />
              );
            })}
          </View>
        </View>
        <View style={{ gap: space.sm }}>
          <Text style={type.h3}>Plate colours</Text>
          <Text style={type.small}>Match your gym. Tap a swatch to change its colour.</Text>
          {gym.colors.map((c, i) => (
            <View key={c.id} style={s.colorRow}>
              <Press
                onPress={() => setColor(i, { hex: SWATCHES[(SWATCHES.indexOf(c.hex) + 1) % SWATCHES.length] })}
                style={[s.swatch, { backgroundColor: c.hex }]}
                accessibilityRole="button"
                accessibilityLabel={`${c.name} plate colour. Tap to change`}
              >
                <View />
              </Press>
              <TextInput value={c.name} onChangeText={(t) => setColor(i, { name: t })} style={s.colorName} accessibilityLabel={`Colour ${i + 1} name`} />
              <NumberField value={c.kg} onChange={(n) => setColor(i, { kg: n })} label={`${c.name} plate kilograms`} />
              <Text style={s.kg}>kg</Text>
              <Press onPress={() => setGym({ colors: gym.colors.filter((_, j) => j !== i) })} style={s.del} accessibilityRole="button" accessibilityLabel={`Remove ${c.name}`}>
                <Icon name="close" size={16} color={color.muted} />
              </Press>
            </View>
          ))}
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            label="Add colour"
            onPress={() =>
              setGym({ colors: [...gym.colors, { id: `c${gym.colors.length}-${Date.now().toString(36)}`, name: 'New', hex: SWATCHES[gym.colors.length % SWATCHES.length], kg: 2.5 }] })
            }
          />
        </View>
        <View style={{ gap: space.sm }}>
          <Text style={type.h3}>Machine stacks</Text>
          {machines.length === 0 ? (
            <Text style={type.small}>Pick “Machine pin” on a machine or cable exercise, then set its kg per plate there.</Text>
          ) : (
            machines.map(([id, m]) => (
              <View key={id} style={s.colorRow}>
                <Text style={[s.colorName, { textAlignVertical: 'center' }]} numberOfLines={1}>
                  {EXERCISES[id].name}
                </Text>
                <NumberField
                  value={m.perPlate}
                  onChange={(n) => update((st) => ({ ...st, machines: { ...st.machines, [id]: { ...st.machines[id], perPlate: n } } }))}
                  label={`${EXERCISES[id].name} kilograms per plate`}
                  placeholder="kg"
                />
                <Text style={s.kg}>/ plate</Text>
              </View>
            ))
          )}
        </View>
      </Glass>

      <SectionTitle>Credits</SectionTitle>
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
  divider: { borderTopWidth: 1, borderTopColor: color.line },
  welcome: { marginTop: space.md, padding: space.lg, gap: space.xs },
  link: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.sm, borderRadius: radius.pill },
  linkText: { fontFamily: font.bodyBold, fontSize: size.small, color: color.lime },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 2, borderColor: color.glassBorder },
  colorName: { flex: 1, minWidth: 0, minHeight: touch.min, color: color.text, fontFamily: font.bodyBold, fontSize: size.small },
  kg: { fontFamily: font.bodyBold, fontSize: size.label, color: color.muted },
  del: { width: 36, height: touch.min, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  credit: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.min, borderRadius: radius.sm },
  creditText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.small, color: color.text },
});
