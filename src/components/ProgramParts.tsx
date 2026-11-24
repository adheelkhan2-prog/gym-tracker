import React, { useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { EQUIPMENT_LABEL, EXERCISE_LIST, EXERCISES, type Equipment } from '../data/exercises';
import { howToImages } from './ExerciseParts';
import { MUSCLE_LABEL, type MuscleId } from '../data/muscles';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../data/program';
import type { Program } from '../data/programs';
import { addDays, dateFromKey, formatDate, todayKey } from '../store';
import { color, font, radius, size, space, themed, touch, type } from '../theme';
import type { PaintMap } from './body/BodyModel';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { Button, Chip, Press } from './ui';

/** Monday-first ordering for display. */
export const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Red where the program trains hardest across a week. */
export function programPaint(p: Program): PaintMap {
  const load: Partial<Record<MuscleId, number>> = {};
  for (const wd of p.week) {
    const d = p.days.find((x) => x.id === wd);
    if (!d) continue;
    for (const e of d.exercises) {
      const ex = EXERCISES[e.options[0]];
      if (!ex) continue;
      for (const m of ex.primary) load[m] = (load[m] ?? 0) + e.sets;
      for (const m of ex.secondary) load[m] = (load[m] ?? 0) + e.sets * 0.5;
    }
  }
  const paint: PaintMap = {};
  for (const [m, n] of Object.entries(load) as [MuscleId, number][]) {
    if (n >= 8) paint[m] = { color: color.musclePrimary, glow: 0.12 };
    else if (n >= 3) paint[m] = { color: color.muscleSecondary };
  }
  return paint;
}

/** Next Monday (or today if it is Monday). */
export function nextMonday(today = todayKey()) {
  const dow = dateFromKey(today).getDay();
  return dow === 1 ? today : addDays(today, (8 - dow) % 7 || 7);
}

/** Weekday rows; each row picks one of the program's days or Rest. */
export function WeekMapper({ program, week, onChange }: { program: Program; week: (string | null)[]; onChange: (w: (string | null)[]) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      {ORDER.map((wd) => (
        <View key={wd} style={s.weekRow}>
          <Text style={s.wd}>{WEEKDAY_SHORT[wd]}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs, paddingRight: space.md }}>
            {[...program.days.map((d) => d.id), null].map((id) => (
              <Chip
                key={id ?? 'rest'}
                label={id ? program.days.find((d) => d.id === id)!.name : 'Rest'}
                active={week[wd] === id}
                onPress={() => {
                  const w = [...week];
                  w[wd] = id;
                  onChange(w);
                }}
              />
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

/** "Switch to PPL from Monday?" — choose when it starts and which weekday gets which day. */
export function SwitchSheet({
  program,
  currentWeek,
  onConfirm,
  onClose,
}: {
  program: Program;
  /** The weekday mapping in use when this is already the active program: edit it, starting today. */
  currentWeek?: (string | null)[];
  onConfirm: (week: (string | null)[], from: string) => void;
  onClose: () => void;
}) {
  const today = todayKey();
  const monday = nextMonday(today);
  const [week, setWeek] = useState(currentWeek ?? program.week);
  const [from, setFrom] = useState(currentWeek ? today : monday);
  const days = week.filter(Boolean).length;
  const when = from === today ? 'today' : `${WEEKDAY_LONG[dateFromKey(from).getDay()]} ${formatDate(from)}`;
  return (
    <Sheet
      title={currentWeek ? `Change days for ${program.name}` : `Switch to ${program.name}?`}
      subtitle="Your history stays. Every exercise keeps its own log and charts."
      onClose={onClose}
      testID="switch-sheet"
      footer={
        <View style={{ marginTop: space.sm, gap: space.xs }}>
          <Button label={`Switch from ${from === today ? 'today' : WEEKDAY_SHORT[dateFromKey(from).getDay()]}`} icon="check" onPress={() => onConfirm(week, from)} disabled={!program.rotation && days === 0} />
          <Text style={[type.small, { textAlign: 'center' }]}>
            {program.rotation ? `Rotating plan, starting ${when}.` : `${days} training day${days === 1 ? '' : 's'} a week, starting ${when}.`}
          </Text>
        </View>
      }
    >
      <Text style={type.label}>Start</Text>
      <View style={s.row}>
        {today !== monday && <Chip label={`Next Monday · ${formatDate(monday)}`} active={from === monday} onPress={() => setFrom(monday)} />}
        <Chip label="Today" active={from === today} onPress={() => setFrom(today)} />
        {today === monday && <Chip label={`Monday after · ${formatDate(addDays(monday, 7))}`} active={from === addDays(monday, 7)} onPress={() => setFrom(addDays(monday, 7))} />}
      </View>
      {program.rotation ? (
        <Text style={[type.small, { marginTop: space.lg }]}>
          No fixed weekdays: each workout is the next day in order ({program.days.map((d) => d.name).join(' → ')} → again).
        </Text>
      ) : (
        <>
          <Text style={[type.label, { marginTop: space.lg, marginBottom: space.sm }]}>Your week</Text>
          <WeekMapper program={program} week={week} onChange={setWeek} />
        </>
      )}
    </Sheet>
  );
}

const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'cable', 'machine', 'plate_loaded', 'smith', 'ez_bar', 'bodyweight'];
const MUSCLE_FILTERS: { label: string; muscles: MuscleId[] }[] = [
  { label: 'Chest', muscles: ['pec_major_upper', 'pec_major_lower'] },
  { label: 'Back', muscles: ['upper_lats', 'lower_lats', 'rhomboids', 'mid_traps', 'teres_major'] },
  { label: 'Shoulders', muscles: ['anterior_delt', 'lateral_delt', 'posterior_delt'] },
  { label: 'Biceps', muscles: ['biceps', 'brachialis'] },
  { label: 'Triceps', muscles: ['triceps_long', 'triceps_lateral', 'triceps_medial'] },
  { label: 'Forearms', muscles: ['forearm_flexors', 'forearm_extensors', 'brachioradialis', 'hand_muscles'] },
  { label: 'Traps', muscles: ['upper_traps'] },
  { label: 'Quads', muscles: ['vastus_group', 'rectus_femoris'] },
  { label: 'Hamstrings', muscles: ['medial_hamstrings', 'lateral_hamstrings'] },
  { label: 'Glutes', muscles: ['glute_max', 'glute_med'] },
  { label: 'Calves', muscles: ['gastrocnemius', 'soleus'] },
  { label: 'Abs', muscles: ['rectus_abdominis', 'obliques', 'transverse_abdominis'] },
];

/** Searchable exercise library, filtered by muscle and equipment. */
export function LibrarySheet({ title, onPick, onClose }: { title: string; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [eq, setEq] = useState<Equipment | null>(null);
  const filters = MUSCLE_FILTERS;
  // The React Compiler memoizes this.
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const mf = MUSCLE_FILTERS.find((f) => f.label === muscle);
  const list = EXERCISE_LIST.filter(
    (e) =>
      (!eq || e.equipment === eq) &&
      (!mf || e.primary.some((m) => mf.muscles.includes(m))) &&
      words.every((w) => e.name.toLowerCase().includes(w) || e.primary.some((m) => MUSCLE_LABEL[m].toLowerCase().includes(w))),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const header = (
    <>
      <View style={s.search}>
        <Icon name="search" size={18} color={color.subtle} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search exercises or muscles"
          placeholderTextColor={color.subtle}
          style={s.searchInput}
          accessibilityLabel="Search exercises"
          autoCorrect={false}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        {filters.map((f) => (
          <Chip key={f.label} label={f.label} active={muscle === f.label} onPress={() => setMuscle(muscle === f.label ? null : f.label)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filters, { marginBottom: space.sm }]}>
        {EQUIPMENT.map((e) => (
          <Chip key={e} label={EQUIPMENT_LABEL[e]} active={eq === e} onPress={() => setEq(eq === e ? null : e)} />
        ))}
      </ScrollView>
    </>
  );

  // Virtualized: only the rows on screen (and their full-size thumbnails) are rendered and decoded.
  return (
    <Sheet title={title} subtitle={`${list.length} exercises`} onClose={onClose} testID="library-sheet" scroll={false}>
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        windowSize={5}
        contentContainerStyle={{ paddingBottom: space.md }}
        ItemSeparatorComponent={LibrarySpacer}
        ListEmptyComponent={<Text style={[type.small, { textAlign: 'center', marginTop: space.lg }]}>Nothing matches. Try fewer filters.</Text>}
        renderItem={({ item: e }) => {
          const img = howToImages(e.id);
          return (
            <Press onPress={() => onPick(e.id)} style={s.libRow} accessibilityRole="button" accessibilityLabel={`Add ${e.name}`}>
              {img ? <Image source={img.start} style={s.thumb} /> : <View style={[s.thumb, s.noThumb]}><Icon name="barbell" size={18} color={color.muted} /></View>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.libName} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={type.small} numberOfLines={1}>
                  {EQUIPMENT_LABEL[e.equipment]} · {e.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}
                </Text>
              </View>
              <Icon name="plus" size={20} color={color.accent} />
            </Press>
          );
        }}
      />
    </Sheet>
  );
}

const LibrarySpacer = () => <View style={{ height: space.xs }} />;

const s = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wd: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.accentText, width: 40 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    minHeight: touch.min,
    borderRadius: radius.pill,
    backgroundColor: color.surface2,
  },
  searchInput: { flex: 1, color: color.text, fontFamily: font.bodySemi, fontSize: size.body, minHeight: touch.min },
  filters: { gap: space.xs, paddingVertical: space.xs, marginTop: space.xs },
  libRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.lg, backgroundColor: color.glassSolid, minHeight: 64 },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: color.flash },
  noThumb: { backgroundColor: color.surface3, alignItems: 'center', justifyContent: 'center' },
  libName: { fontFamily: font.bodyBlack, fontSize: size.small, color: color.text },
}));
