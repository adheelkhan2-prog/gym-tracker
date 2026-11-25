import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { clearCrashLog, readCrashLog } from '../../crash';
import { shareCrashLog } from '../../crashShare';
import { Glass } from '../../components/glass';
import { Icon, type IconName } from '../../components/icons';
import { WeekMapper } from '../../components/ProgramParts';
import { Button, Chip, Press, Screen, SectionTitle, Switch } from '../../components/ui';
import { activeProgram, useStore } from '../../store';
import { bottomClearance, color, font, leading, radius, size, space, themed, touch, type } from '../../theme';

/** Every third-party asset in the app, grouped by where it shows up (see src/data/asset-licences.md). */
const CREDITS: { title: string; note: string; links: { label: string; url: string }[] }[] = [
  {
    title: '3D muscle model (Muscles tab)',
    note: 'Adapted from Z-Anatomy, based on BodyParts3D, via the Gymmetry muscle map. Changes: deduplicated and welded vertices; quantised positions, normals and vertex colours for mobile; muscle regions unchanged. Shared under CC BY-SA 4.0.',
    links: [
      { label: 'Z-Anatomy, Gauthier Kervyn (CC BY-SA 4.0)', url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy' },
      { label: 'BodyParts3D, Kousaku Okubo, © The Database Center for Life Science (CC BY-SA 2.1 JP)', url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/' },
      { label: 'Gymmetry muscle map model, kalibismail (CC BY-SA 4.0)', url: 'https://github.com/kalibismail/gymmetry-muscle-model' },
      { label: 'Licence: CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      { label: 'Licence: CC BY-SA 2.1 JP (BodyParts3D)', url: 'https://creativecommons.org/licenses/by-sa/2.1/jp/' },
    ],
  },
  {
    title: '3D exercise images (How to tab)',
    note: 'Rendered for this app in Blender. Body: MakeHuman base mesh, rig and shape targets (CC0). Muscle detail and regions baked from the muscle model above, so the images are shared under CC BY-SA 4.0. Poses, equipment and lighting are our own.',
    links: [
      { label: 'MakeHuman / MPFB2 (CC0 1.0)', url: 'https://github.com/makehumancommunity/mpfb2' },
      { label: 'Licence: CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    ],
  },
  {
    title: 'Exercise videos',
    note: '43 exercises play a short looping video of a real person: 36 by Goulart from the open exercise database wger (wger.de, CC BY-SA 4.0), 6 from Mixkit (mixkit.co, Mixkit Stock Video Free License) and 1 from Pixabay (pixabay.com, Pixabay Content License). Changes: chosen per exercise, trimmed to a 3–6 s loop, cross-faded at the loop point, sound removed, re-encoded at the original resolution; the wger clips are shared under CC BY-SA 4.0. The source of every clip is listed in the app’s asset-licences file. Videos you import stay on this phone.',
    links: [
      { label: 'wger exercise database (videos by Goulart)', url: 'https://wger.de/en/exercise/overview/' },
      { label: 'Licence: CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      { label: 'Mixkit free stock video', url: 'https://mixkit.co/free-stock-video/' },
      { label: 'Mixkit Stock Video Free License', url: 'https://mixkit.co/license/#videoFree' },
      { label: 'Pixabay Content License', url: 'https://pixabay.com/service/license-summary/' },
    ],
  },
  {
    title: 'Exercise photos',
    note: 'Shown for exercises that do not have an approved 3D image yet.',
    links: [{ label: 'free-exercise-db (Unlicense, public domain)', url: 'https://github.com/yuhonas/free-exercise-db' }],
  },
  {
    title: 'Fonts',
    note: 'SIL Open Font License 1.1.',
    links: [
      { label: 'Bricolage Grotesque (OFL)', url: 'https://fonts.google.com/specimen/Bricolage+Grotesque' },
      { label: 'Figtree (OFL)', url: 'https://fonts.google.com/specimen/Figtree' },
    ],
  },
];


function Toggle({ icon, title, sub, checked, onChange }: { icon: IconName; title: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.toggle}>
      <View style={s.toggleIcon}>
        <Icon name={icon} size={20} color={checked ? color.accent : color.muted} filled={checked} />
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

  return (
    <Screen padBottom={bottomClearance.tabs}>
      <Text style={s.title} accessibilityRole="header">
        Settings
      </Text>

      <SectionTitle>Appearance</SectionTitle>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }} accessibilityRole="radiogroup">
        {(
          [
            ['system', 'System'],
            ['light', 'Light'],
            ['dark', 'Dark'],
          ] as const
        ).map(([v, label]) => (
          <Chip key={v} label={label} active={state.theme === v} onPress={() => update((st) => ({ ...st, theme: v }))} />
        ))}
      </View>
      <Text style={[type.small, { marginTop: space.sm }]}>System follows your phone’s light or dark mode.</Text>

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
      </Glass>

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
        {program.rotation ? (
          <Text style={type.small}>Rotating plan: each session is the next day in order ({program.days.map((d) => d.name).join(' → ')}). Change it in Programs.</Text>
        ) : (
          <>
            <Text style={type.label}>Day order</Text>
            <WeekMapper program={program} week={state.week} onChange={(week) => update((st) => ({ ...st, week }))} />
            <Button size="sm" variant="ghost" label="Reset to the program’s default week" onPress={() => update((st) => ({ ...st, week: program.week }))} />
          </>
        )}
      </Glass>

      <SectionTitle>Credits</SectionTitle>
      <Glass r={radius.xl} style={{ gap: space.xs, padding: space.lg }}>
        {CREDITS.map((g, i) => (
          <View key={g.title} style={i > 0 ? s.creditGroup : undefined}>
            <Text style={s.creditTitle}>{g.title}</Text>
            <Text style={type.small}>{g.note}</Text>
            {g.links.map((c) => (
              // The app is fully offline: sources are listed as text (selectable to copy), never opened.
              <View key={c.url} style={s.credit}>
                <Text style={s.creditText}>{c.label}</Text>
                <Text style={s.creditUrl} selectable>
                  {c.url}
                </Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={[type.small, s.creditGroup]}>
          Icons and the rest-timer sound were made for this app. Component structure after react-native-reusables (MIT).
        </Text>
      </Glass>

      <CrashLogSection />

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

/** Crash log: what went wrong and the last steps before it, kept on the phone. */
function CrashLogSection() {
  const [entries, setEntries] = useState(() => readCrashLog());
  const [open, setOpen] = useState(false);
  const shown = open ? entries : entries.slice(0, 3);
  return (
    <>
      <SectionTitle>Crash log</SectionTitle>
      <Glass r={radius.xl} style={{ gap: space.md, padding: space.lg }}>
        {entries.length === 0 ? (
          <Text style={type.small}>No crashes recorded. If the app ever closes or shows an error, the details are saved here so you can share them.</Text>
        ) : (
          <>
            <Text style={type.small}>
              {entries.length} recorded. Share the log so the problem can be found; your workouts are not included.
            </Text>
            {shown.map((c) => (
              <View key={c.at + c.message} style={s.crashRow}>
                <Icon name="alert" size={16} color={color.warn} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.crashWhen}>
                    {new Date(c.at).toLocaleString()} · {c.kind === 'unclean-exit' ? 'closed unexpectedly' : c.kind}
                  </Text>
                  <Text style={type.small} numberOfLines={open ? 6 : 2}>
                    {c.message}
                  </Text>
                  {open && c.trail.length > 0 && <Text style={s.crashTrail}>Last steps: {c.trail.slice(-6).join(' → ')}</Text>}
                </View>
              </View>
            ))}
            {entries.length > 3 && <Button size="sm" variant="ghost" label={open ? 'Show less' : `Show all ${entries.length}`} onPress={() => setOpen(!open)} />}
          </>
        )}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button size="sm" variant="secondary" icon="share" label="Share log" onPress={() => void shareCrashLog().catch(() => {})} />
          </View>
          {entries.length > 0 && (
            <View style={{ flex: 1 }}>
              <Button
                size="sm"
                variant="destructive"
                icon="trash"
                label="Clear"
                onPress={() => {
                  clearCrashLog();
                  setEntries([]);
                }}
              />
            </View>
          )}
        </View>
      </Glass>
    </>
  );
}

const s = themed(() => StyleSheet.create({
  crashRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  crashWhen: { fontFamily: font.bodyBold, fontSize: size.label, color: color.text },
  crashTrail: { fontFamily: font.body, fontSize: size.label, color: color.subtle, marginTop: space.xxs },
  title: { fontFamily: font.display, fontSize: size.numXL, lineHeight: leading.numXL, letterSpacing: -2, color: color.text },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  toggleIcon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  divider: { borderTopWidth: 1, borderTopColor: color.line },
  welcome: { marginTop: space.md, padding: space.lg, gap: space.xs },
  link: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.sm, borderRadius: radius.pill },
  linkText: { fontFamily: font.bodyBold, fontSize: size.small, color: color.accentText },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: touch.min, height: touch.min, borderRadius: radius.pill, borderWidth: 2, borderColor: color.glassBorder },
  colorName: { flex: 1, minWidth: 0, minHeight: touch.min, color: color.text, fontFamily: font.bodyBold, fontSize: size.small },
  kg: { fontFamily: font.bodyBold, fontSize: size.label, color: color.muted },
  del: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  credit: { gap: 2, paddingVertical: space.xs },
  creditUrl: { fontFamily: font.body, fontSize: size.label, color: color.subtle },
  creditGroup: { marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  creditTitle: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.text, marginBottom: space.xs },
  creditText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.small, color: color.text },
}));

// One bad screen shows a recovery panel for that screen only; it never takes the app down.
export { RouteError as ErrorBoundary } from '../../components/RouteError';
