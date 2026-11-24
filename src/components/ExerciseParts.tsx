import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { EQUIPMENT_LABEL, EXERCISES, type ExerciseInfo } from '../data/exercises';
import { EXERCISE_VIDEO } from '../data/exercise-video';
import { howToImages } from '../data/how-to';
import { LoopVideo } from './LoopVideo';
import { tipsFor } from '../data/tips';
import { useStore, type OwnVideo } from '../store';
import { MUSCLE_LABEL } from '../data/muscles';
import type { Swap } from '../data/swaps';
import { round1, type MachineSetup } from '../load';
import { color, font, radius, size, space, themed, touch, type } from '../theme';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { Badge, Button, Press } from './ui';

// ---------- How-to images ----------

export { howToImages } from '../data/how-to';

/** Where an exercise's picture comes from, in order of preference. */
export type MediaKind = 'mine' | 'video' | 'clay' | 'photo' | 'none';
export function mediaFor(exerciseId: string, userVideos: Record<string, OwnVideo> = {}) {
  const mine = userVideos[exerciseId];
  if (mine) return { kind: 'mine' as const, video: { uri: mine.uri }, start: mine.start, end: mine.end };
  const v = EXERCISE_VIDEO[exerciseId];
  if (v) return { kind: 'video' as const, video: v.source, credit: v.credit };
  const img = howToImages(exerciseId);
  if (img) return { kind: img.clay ? ('clay' as const) : ('photo' as const), img };
  return { kind: 'none' as const };
}

/**
 * The exercise's moving picture: your own recording, else the bundled video (muted, looping), else
 * the start/end stills cross-fading, else a photo. Tap to pause / play. Reduce motion starts paused.
 */
export function ExerciseMedia({ exerciseId, height = 300, label }: { exerciseId: string; height?: number; label?: string }) {
  const { state } = useStore();
  const m = mediaFor(exerciseId, state.userVideos);
  const name = label ?? EXERCISES[exerciseId]?.name ?? 'Exercise';
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(reduce);
  const [end, setEnd] = useState(false);
  const fade = useSharedValue(0);
  const stills = m.kind === 'clay' || m.kind === 'photo';
  useEffect(() => {
    if (!stills || paused) return;
    const t = setInterval(() => setEnd((v) => !v), 2200);
    return () => clearInterval(t);
  }, [stills, paused]);
  useEffect(() => {
    fade.value = reduce ? (end ? 1 : 0) : withTiming(end ? 1 : 0, { duration: 600, easing: Easing.inOut(Easing.quad) });
  }, [end, reduce, fade]);
  const endStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (m.kind === 'none') {
    return (
      <View style={[s.photo, s.noPhoto, { height }]}>
        <Icon name="info" size={28} color={color.muted} />
        <Text style={[type.small, { textAlign: 'center' }]}>No picture for this one yet. Follow the steps below, or record your own.</Text>
      </View>
    );
  }
  const isVideo = m.kind === 'mine' || m.kind === 'video';
  return (
    <Press
      onPress={() => setPaused((v) => !v)}
      tick
      scaleTo={0.98}
      style={[s.photo, s.stage, { height }]}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${isVideo ? 'video' : `${end ? 'end' : 'start'} position`}. ${paused ? 'Paused, tap to play' : 'Tap to pause'}`}
      testID={isVideo ? 'exercise-video' : 'exercise-photo'}
    >
      {isVideo ? (
        <LoopVideo source={m.video} paused={paused} start={m.kind === 'mine' ? m.start : undefined} end={m.kind === 'mine' ? m.end : undefined} />
      ) : (
        <>
          <Image source={m.img!.start} style={s.img} resizeMode={m.kind === 'clay' ? 'contain' : 'cover'} />
          <Animated.View style={[StyleSheet.absoluteFill, endStyle]} pointerEvents="none">
            <Image source={m.img!.end} style={s.img} resizeMode={m.kind === 'clay' ? 'contain' : 'cover'} />
          </Animated.View>
          <View style={s.phase}>
            <View style={[s.phaseDot, !end && s.phaseOn]} />
            <Text style={[s.phaseText, !end && { color: color.accentText }]}>Start</Text>
            <View style={[s.phaseDot, end && s.phaseOn]} />
            <Text style={[s.phaseText, end && { color: color.accentText }]}>End</Text>
          </View>
        </>
      )}
      {m.kind === 'mine' && (
        <View style={s.mine}>
          <Text style={s.phaseText}>Your video</Text>
        </View>
      )}
      {paused && (
        <View style={s.paused} testID="media-paused">
          <Text style={s.phaseText}>Paused · tap to play</Text>
        </View>
      )}
    </Press>
  );
}

/** Where the picture came from (shown under it). */
export function mediaCredit(exerciseId: string, userVideos: Record<string, OwnVideo> = {}) {
  const m = mediaFor(exerciseId, userVideos);
  if (m.kind === 'mine') return 'Your own video (stored on this phone)';
  if (m.kind === 'video') return `Video: ${m.credit} (credits in Settings)`;
  if (m.kind === 'clay') return '3D render: made for this app, CC BY-SA 4.0 (credits in Settings)';
  if (m.kind === 'photo') return 'Photos: free-exercise-db (public domain)';
  return '';
}

/** The written how-to steps. */
export function HowToSteps({ ex }: { ex: ExerciseInfo }) {
  return (
    <View>
      {ex.steps.map((t, i) => (
        <View key={i} style={s.step}>
          <Text style={s.stepNo}>{i + 1}</Text>
          <Text style={[type.body, { flex: 1, color: color.muted }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

/** Form cues for the movement. */
export function Tips({ ex }: { ex: ExerciseInfo }) {
  const tips = tipsFor(ex);
  return (
    <View style={{ gap: space.sm, marginTop: space.sm }}>
      {tips.map((t, i) => (
        <View key={i} style={s.tip}>
          <Icon name="check" size={14} color={color.accent} />
          <Text style={[type.small, { flex: 1, color: color.muted }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

/** Media, then the steps, then where the picture came from. */
export function HowTo({ ex }: { ex: ExerciseInfo }) {
  const { state } = useStore();
  const credit = mediaCredit(ex.id, state.userVideos);
  return (
    <View>
      <ExerciseMedia exerciseId={ex.id} />
      <HowToSteps ex={ex} />
      {credit ? <Text style={s.credit}>{credit}</Text> : null}
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
  note,
}: {
  original: string;
  current: string;
  swaps: Swap[];
  onPick: (id: string) => void;
  onReset: () => void;
  onClose: () => void;
  /** Extra line under the title (e.g. what happens to sets already logged). */
  note?: string;
}) {
  const options: (Swap & { original?: boolean })[] = [
    { id: original, match: 'same', why: 'The exercise your program planned.', original: true },
    ...swaps.filter((x) => x.id !== original),
  ];
  return (
    <Sheet
      title="Swap exercise"
      subtitle={note ?? `Only exercises with exactly the same primary muscles as ${EXERCISES[original].name}. Each one is logged and charted on its own.`}
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
              testID={o.original ? 'swap-option-original' : `swap-option-${o.id}`}
              accessibilityLabel={`${ex.name}, ${EQUIPMENT_LABEL[ex.equipment]}, ${o.original ? 'original' : 'same primary muscles'}: ${ex.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}`}
            >
              {img ? <Image source={img.start} style={s.thumb} /> : <View style={[s.thumb, s.noThumb]}><Icon name="barbell" size={22} color={color.muted} /></View>}
              <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
                <Text style={s.swapName} numberOfLines={2}>
                  {ex.name}
                </Text>
                <View style={s.swapTags}>
                  <Badge label={EQUIPMENT_LABEL[ex.equipment]} variant="secondary" />
                  {o.original && <Badge label="Original" variant="outline" />}
                </View>
                {/* The muscles it works: primary (the exact match) and secondary. */}
                <Text style={s.swapMuscles} numberOfLines={2}>
                  <Text style={{ color: color.text }}>{ex.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</Text>
                  {ex.secondary.length ? ` · also ${ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}` : ''}
                </Text>
                <Text style={s.why}>{o.why}</Text>
              </View>
              {on && <Icon name="checkCircle" size={24} color={color.accent} filled />}
            </Press>
          );
        })}
      </View>
    </Sheet>
  );
}

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
  const asText = value === undefined ? '' : String(value);
  const [text, setText] = useState(asText);
  const [focused, setFocused] = useState(false);
  // While typing, show exactly what's typed (an empty field or "2." included), so a value can be
  // cleared and retyped. Otherwise follow the prop; a field that needs a number gets its last
  // value back on blur if it was left empty.
  const shown = focused ? text : asText;
  return (
    <TextInput
      value={shown}
      onFocus={() => {
        setText(asText);
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
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
  onSave,
  onClose,
}: {
  name: string;
  setup: MachineSetup;
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

const s = themed(() => StyleSheet.create({
  swapMuscles: { fontFamily: font.bodySemi, fontSize: size.small, color: color.muted },
  photo: { height: 260, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: color.flash },
  img: { width: '100%', height: '100%' },
  stage: { backgroundColor: color.stage },
  mine: { position: 'absolute', top: space.sm, left: space.sm, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: color.scrim },
  tip: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
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
  phaseOn: { backgroundColor: color.accent },
  phaseText: { fontFamily: font.bodyBlack, fontSize: size.tiny, color: color.muted, marginRight: space.xs },
  step: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  stepNo: { fontFamily: font.display, fontSize: size.h3, color: color.accentText, width: 20 },
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
  swapOn: { borderColor: color.accent, backgroundColor: color.accentDim },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: color.flash },
  noThumb: { backgroundColor: color.surface3, alignItems: 'center', justifyContent: 'center' },
  swapName: { fontFamily: font.bodyBlack, fontSize: size.body, color: color.text },
  swapTags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  why: { fontFamily: font.bodySemi, fontSize: size.label, lineHeight: 16, color: color.muted },
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
}));
