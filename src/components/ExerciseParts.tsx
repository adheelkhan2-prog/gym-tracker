import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { EQUIPMENT_LABEL, EXERCISES, type ExerciseInfo } from '../data/exercises';
import { EXERCISE_3D } from '../data/exercise-3d';
import { EXERCISE_IMAGES } from '../data/exercise-images';
import { MUSCLE_LABEL } from '../data/muscles';
import type { Swap } from '../data/swaps';
import { haptic } from '../feedback';
import {
  colorsKg,
  fmtKg,
  fmtPlate,
  platesText,
  platesTotal,
  round1,
  sum,
  type Gym,
  type MachineSetup,
  type Unit,
} from '../load';
import { color, font, radius, size, space, touch, type } from '../theme';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { Badge, Button, Chip, Press } from './ui';

// ---------- How-to images ----------

/** Clay render if approved, else the free-exercise-db photo. */
export function howToImages(id: string) {
  const clay = EXERCISE_3D[id];
  return clay ? { ...clay, clay: true } : EXERCISE_IMAGES[id] ? { ...EXERCISE_IMAGES[id], clay: false } : undefined;
}

/** Start/end images that cross-fade on their own; tap to pause or resume. Written steps below. */
export function HowTo({ ex }: { ex: ExerciseInfo }) {
  const img = howToImages(ex.id);
  const reduce = useReducedMotion();
  const [end, setEnd] = useState(false);
  const [paused, setPaused] = useState(false);
  const fade = useSharedValue(0);
  useEffect(() => {
    if (!img || paused) return;
    const t = setInterval(() => setEnd((v) => !v), 2200);
    return () => clearInterval(t);
  }, [img, paused]);
  useEffect(() => {
    fade.value = reduce ? (end ? 1 : 0) : withTiming(end ? 1 : 0, { duration: 600, easing: Easing.inOut(Easing.quad) });
  }, [end, reduce, fade]);
  const endStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const mode = img?.clay ? 'contain' : 'cover';

  return (
    <View>
      {img ? (
        <Press
          onPress={() => setPaused((v) => !v)}
          tick
          scaleTo={0.98}
          style={[s.photo, img.clay && s.clay]}
          accessibilityRole="button"
          accessibilityLabel={`${ex.name}, ${end ? 'end' : 'start'} position. ${paused ? 'Paused, tap to play' : 'Tap to pause'}`}
          testID="howto-photo"
        >
          <Image source={img.start} style={s.img} resizeMode={mode} />
          <Animated.View style={[StyleSheet.absoluteFill, endStyle]} pointerEvents="none">
            <Image source={img.end} style={s.img} resizeMode={mode} />
          </Animated.View>
          <View style={s.phase}>
            <View style={[s.phaseDot, !end && s.phaseOn]} />
            <Text style={[s.phaseText, !end && { color: color.lime }]}>Start</Text>
            <View style={[s.phaseDot, end && s.phaseOn]} />
            <Text style={[s.phaseText, end && { color: color.lime }]}>End</Text>
          </View>
          {paused && (
            <View style={s.paused} testID="howto-paused">
              <Text style={s.phaseText}>Paused · tap to play</Text>
            </View>
          )}
        </Press>
      ) : (
        <View style={[s.photo, s.noPhoto]}>
          <Icon name="info" size={28} color={color.muted} />
          <Text style={[type.small, { textAlign: 'center' }]}>No licence-free image for this one yet. Follow the steps below.</Text>
        </View>
      )}
      {ex.steps.map((t, i) => (
        <View key={i} style={s.step}>
          <Text style={s.stepNo}>{i + 1}</Text>
          <Text style={[type.body, { flex: 1, color: color.muted }]}>{t}</Text>
        </View>
      ))}
      {img && <Text style={s.credit}>{img.clay ? '3D render: made for this app, CC BY-SA 4.0 (credits in Settings)' : 'Photos: free-exercise-db (public domain)'}</Text>}
    </View>
  );
}

// ---------- Swap sheet ----------

export function SwapSheet({
  original,
  current,
  swaps,
  onPick,
  onReset,
  onClose,
}: {
  original: string;
  current: string;
  swaps: Swap[];
  onPick: (id: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const options: (Swap & { original?: boolean })[] = [
    { id: original, match: 'same', why: 'The exercise your program planned.', original: true },
    ...swaps.filter((x) => x.id !== original),
  ];
  return (
    <Sheet
      title="Swap exercise"
      subtitle={`Alternatives for ${EXERCISES[original].name}. Each one is logged and charted on its own.`}
      onClose={onClose}
      testID="swap-sheet"
      footer={
        current !== original ? (
          <View style={{ marginTop: space.sm }}>
            <Button variant="outline" icon="rotate" label="Reset to original" onPress={onReset} />
          </View>
        ) : null
      }
    >
      <View style={{ gap: space.sm }}>
        {options.map((o) => {
          const ex = EXERCISES[o.id];
          const img = howToImages(o.id);
          const on = o.id === current;
          return (
            <Press
              key={o.id}
              onPress={() => onPick(o.id)}
              style={[s.swapRow, on && s.swapOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${ex.name}, ${EQUIPMENT_LABEL[ex.equipment]}, ${o.original ? 'original' : o.match === 'same' ? 'same muscles' : 'close match'}`}
            >
              {img ? <Image source={img.start} style={s.thumb} /> : <View style={[s.thumb, s.noThumb]}><Icon name="barbell" size={22} color={color.muted} /></View>}
              <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
                <Text style={s.swapName} numberOfLines={2}>
                  {ex.name}
                </Text>
                <View style={s.swapTags}>
                  <Badge label={EQUIPMENT_LABEL[ex.equipment]} variant="secondary" />
                  {o.original ? (
                    <Badge label="Original" variant="outline" />
                  ) : (
                    <Badge label={o.match === 'same' ? 'Same muscles' : 'Close match'} variant={o.match === 'same' ? 'default' : 'outline'} />
                  )}
                </View>
                <Text style={s.why}>{o.why}</Text>
              </View>
              {on && <Icon name="checkCircle" size={24} color={color.lime} filled />}
            </Press>
          );
        })}
      </View>
    </Sheet>
  );
}

// ---------- Plate pickers ----------

/** One side of the bar, drawn as plate chips. */
function SideBar({ items, onRemove }: { items: { key: string; label: string; hex?: string; kg: number }[]; onRemove: (i: number) => void }) {
  return (
    <View style={s.bar}>
      <View style={s.barShaft} />
      <View style={s.barRow}>
        {items.length === 0 && <Text style={type.small}>Tap plates below to load one side</Text>}
        {items.map((p, i) => (
          <Press
            key={`${p.key}-${i}`}
            onPress={() => onRemove(i)}
            style={[s.plateOn, { height: 40 + Math.min(40, p.kg * 1.6), backgroundColor: p.hex ?? color.surface3 }]}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${p.label}`}
          >
            <Text style={[s.plateOnText, p.hex && { color: contrast(p.hex) }]}>{p.label}</Text>
          </Press>
        ))}
      </View>
    </View>
  );
}

const contrast = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const l = ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  return l > 150 ? color.ink : color.text;
};

export function PlateSheet({
  mode,
  gym,
  unit,
  initial,
  bar: initialBar,
  onSave,
  onClose,
}: {
  mode: 'plates' | 'colors';
  gym: Gym;
  unit: Unit;
  initial: (number | string)[];
  bar: number;
  onSave: (side: (number | string)[], bar: number) => void;
  onClose: () => void;
}) {
  const [side, setSide] = useState<(number | string)[]>(initial);
  const [bar, setBar] = useState(initialBar);
  const kgOfItem = (x: number | string) => (typeof x === 'number' ? x : (gym.colors.find((c) => c.id === x)?.kg ?? 0));
  const total = mode === 'plates' ? platesTotal(side as number[], bar) : bar + 2 * colorsKg(side as string[], gym);
  const items = side.map((x) => {
    if (typeof x === 'number') return { key: String(x), label: fmtPlate(x), kg: x };
    const c = gym.colors.find((cc) => cc.id === x);
    return { key: x, label: c ? fmtPlate(c.kg) : '?', hex: c?.hex, kg: c?.kg ?? 0 };
  });
  const add = (x: number | string) => {
    haptic.tap();
    setSide((v) => [...v, x].sort((a, b) => kgOfItem(b) - kgOfItem(a)));
  };
  return (
    <Sheet
      title={mode === 'plates' ? 'Load the bar' : 'Tap the colours'}
      subtitle="One side only; the other side matches."
      onClose={onClose}
      testID="plate-sheet"
      footer={
        <View style={{ marginTop: space.sm, gap: space.sm }}>
          <Text style={s.total} accessibilityLiveRegion="polite" testID="plate-total">
            {mode === 'plates' ? platesText(side as number[], bar) : `${side.length ? `${side.length * 2} plates` : 'No plates'}${bar ? ' + bar' : ''}`} ={' '}
            <Text style={{ color: color.lime }}>{fmtKg(total, unit)}</Text>
          </Text>
          <Button label="Use this weight" icon="check" onPress={() => onSave(side, bar)} />
        </View>
      }
    >
      <SideBar items={items} onRemove={(i) => setSide((v) => v.filter((_, j) => j !== i))} />
      <Text style={s.sub}>{mode === 'plates' ? 'Plates (kg)' : 'Your gym’s colours'}</Text>
      <View style={s.plateGrid}>
        {mode === 'plates'
          ? gym.plates.map((p) => (
              <Press key={p} onPress={() => add(p)} style={s.plateBtn} accessibilityRole="button" accessibilityLabel={`Add ${p} kg plate`}>
                <Text style={s.plateBtnText}>{fmtPlate(p)}</Text>
              </Press>
            ))
          : gym.colors.map((c) => (
              <Press
                key={c.id}
                onPress={() => add(c.id)}
                style={[s.plateBtn, { backgroundColor: c.hex, borderColor: c.hex }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${c.name} plate, ${c.kg} kg`}
              >
                <Text style={[s.plateBtnText, { color: contrast(c.hex) }]}>{c.name}</Text>
                <Text style={[s.plateKg, { color: contrast(c.hex) }]}>{fmtPlate(c.kg)} kg</Text>
              </Press>
            ))}
      </View>
      <Text style={s.sub}>Bar or sled (kg)</Text>
      <View style={s.plateGrid}>
        {[0, 10, 15, 20].map((b) => (
          <Chip key={b} label={b === 0 ? 'None' : `${b}`} active={bar === b} onPress={() => setBar(b)} />
        ))}
        <NumberField value={bar} onChange={(n) => setBar(n ?? 0)} label="Bar weight in kg" />
      </View>
      {side.length > 0 && (
        <Text style={[type.small, { marginTop: space.sm }]}>
          Per side {round1(sum(side.map(kgOfItem)))} kg. Tap a plate on the bar to take it off.
        </Text>
      )}
    </Sheet>
  );
}

/** Small numeric input that keeps the raw text while typing. */
export function NumberField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: number | undefined;
  /** `undefined` when the field is cleared. */
  onChange: (n: number | undefined) => void;
  label: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  // Keep what's being typed ("2." etc.) while it still means the same number; otherwise follow the prop.
  const parsed = text === '' ? undefined : parseFloat(text);
  const shown = parsed === value || (parsed !== undefined && Number.isNaN(parsed) && value === undefined) ? text : value === undefined ? '' : String(value);
  return (
    <TextInput
      value={shown}
      onChangeText={(t) => {
        const clean = t.replace(/[^0-9.,]/g, '').replace(',', '.');
        setText(clean);
        const n = parseFloat(clean);
        if (clean === '') onChange(undefined);
        else if (Number.isFinite(n)) onChange(n);
      }}
      placeholder={placeholder}
      placeholderTextColor={color.subtle}
      keyboardType="decimal-pad"
      accessibilityLabel={label}
      style={s.numField}
      selectTextOnFocus
    />
  );
}

export function MachineSheet({
  name,
  setup,
  showBar,
  onSave,
  onClose,
}: {
  name: string;
  setup: MachineSetup;
  showBar: boolean;
  onSave: (m: MachineSetup) => void;
  onClose: () => void;
}) {
  const [m, setM] = useState<MachineSetup>(setup);
  const preview = m.perPlate ? (m.start ?? m.perPlate) + 6 * m.perPlate : null;
  return (
    <Sheet
      title="Machine settings"
      subtitle={`${name}. Saved for this exercise only.`}
      onClose={onClose}
      testID="machine-sheet"
      footer={<View style={{ marginTop: space.sm }}><Button label="Save" icon="check" onPress={() => onSave(m)} /></View>}
    >
      <View style={{ gap: space.lg }}>
        <View style={s.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>kg per plate</Text>
            <Text style={type.small}>Printed on the stack. Leave empty to log pins only.</Text>
          </View>
          <NumberField value={m.perPlate} onChange={(n) => setM((v) => ({ ...v, perPlate: n }))} label="Kilograms per stack plate" placeholder="7" />
        </View>
        <View style={s.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>Pin 1 weight</Text>
            <Text style={type.small}>The top plate’s weight, if different.</Text>
          </View>
          <NumberField value={m.start} onChange={(n) => setM((v) => ({ ...v, start: n }))} label="Starting weight in kg" placeholder={m.perPlate ? String(m.perPlate) : '7'} />
        </View>
        {showBar && (
          <View style={s.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>Bar / sled weight</Text>
              <Text style={type.small}>Added to the plates you load.</Text>
            </View>
            <NumberField value={m.bar} onChange={(n) => setM((v) => ({ ...v, bar: n }))} label="Bar or sled weight in kg" placeholder="20" />
          </View>
        )}
        {preview !== null && <Text style={type.small}>Example: pin 7 ≈ {round1(preview)} kg</Text>}
      </View>
    </Sheet>
  );
}

/** Muscle legend for the Muscles tab. */
export function MuscleLegend({ ex }: { ex: ExerciseInfo }) {
  return (
    <View style={s.legend}>
      <View style={s.legendItem}>
        <View style={[s.swatch, { backgroundColor: color.musclePrimary }]} />
        <Text style={s.legendText} numberOfLines={2}>
          {ex.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}
        </Text>
      </View>
      {ex.secondary.length > 0 && (
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: color.muscleSecondary }]} />
          <Text style={[s.legendText, { color: color.muted }]} numberOfLines={2}>
            {ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  photo: { height: 260, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: color.flash },
  img: { width: '100%', height: '100%' },
  clay: { backgroundColor: '#0A0A0A', height: 300 },
  paused: {
    position: 'absolute',
    right: space.md,
    top: space.md,
    backgroundColor: color.scrimDeep,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  noPhoto: { backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  phase: {
    position: 'absolute',
    left: space.md,
    bottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.scrimDeep,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  phaseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.subtle },
  phaseOn: { backgroundColor: color.lime },
  phaseText: { fontFamily: font.bodyBlack, fontSize: size.tiny, color: color.muted, marginRight: space.xs },
  step: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  stepNo: { fontFamily: font.display, fontSize: size.h3, color: color.lime, width: 20 },
  credit: { ...type.small, fontSize: size.tiny, marginTop: space.md, color: color.subtle },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: color.glassSolid,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  swapOn: { borderColor: color.lime, backgroundColor: color.limeDim },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: color.flash },
  noThumb: { backgroundColor: color.surface3, alignItems: 'center', justifyContent: 'center' },
  swapName: { fontFamily: font.bodyBlack, fontSize: size.body, color: color.text },
  swapTags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  why: { fontFamily: font.bodySemi, fontSize: size.label, lineHeight: 16, color: color.muted },
  bar: { height: 110, justifyContent: 'center', marginBottom: space.md },
  barShaft: { position: 'absolute', left: 0, right: 0, height: 10, borderRadius: 5, backgroundColor: color.surface3 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: space.xl, flexWrap: 'nowrap' },
  plateOn: { minWidth: 32, paddingHorizontal: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.glassBorder },
  plateOnText: { fontFamily: font.bodyBlack, fontSize: size.label, color: color.text },
  sub: { ...type.label, marginTop: space.md, marginBottom: space.sm },
  plateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  plateBtn: {
    minWidth: 64,
    minHeight: touch.min,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateBtnText: { fontFamily: font.display, fontSize: size.h3, color: color.text },
  plateKg: { fontFamily: font.bodyBold, fontSize: size.tiny },
  total: { fontFamily: font.display, fontSize: size.h3, color: color.text, textAlign: 'center' },
  numField: {
    minWidth: 76,
    minHeight: touch.min,
    borderRadius: radius.md,
    backgroundColor: color.surface2,
    color: color.text,
    textAlign: 'center',
    fontFamily: font.display,
    fontSize: size.h3,
    paddingHorizontal: space.sm,
  },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  legend: { marginTop: space.md, gap: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 14, height: 14, borderRadius: radius.pill },
  legendText: { flex: 1, fontFamily: font.bodySemi, fontSize: size.small, color: color.text },
});
