// Load types: how the weight on a set is entered, and how it turns into kilograms.
// Plates and machine settings are always kilograms (that's what's printed on them); the
// kg/lb switch only changes what is shown.

import type { LogKind } from './data/exercises';
import { EXERCISES } from './data/exercises';

export type Unit = 'kg' | 'lb';

export type LoadType = 'weight' | 'stack' | 'plates' | 'colors' | 'bodyweight' | 'timed';

export const LOAD_LABEL: Record<LoadType, string> = {
  weight: 'Weight',
  stack: 'Machine pin',
  plates: 'Barbell plates',
  colors: 'Colour plates',
  bodyweight: 'Bodyweight',
  timed: 'Timed',
};

export const LOAD_HINT: Record<LoadType, string> = {
  weight: 'Type the weight in kg or lb',
  stack: 'Log the pin number; add kg per plate to see the weight',
  plates: 'Tap the plates on one side; bar included',
  colors: 'Tap the coloured plates on one side',
  bodyweight: 'Reps only',
  timed: 'Seconds only',
};

/** Extra detail saved with a set for the non-plain load types. */
export type LoadInfo = {
  t: LoadType;
  /** Machine stack pin / plate number. */
  pin?: number;
  /** Plates on ONE side, in kg (plates load type). */
  plates?: number[];
  /** Colour ids on ONE side (colors load type). */
  colors?: string[];
  /** Bar or sled weight in kg used for this set. */
  bar?: number;
};

export type PlateColor = { id: string; name: string; hex: string; kg: number };

export type Gym = {
  bar: number;
  /** Plate sizes the gym has, kg. */
  plates: number[];
  colors: PlateColor[];
};

export type MachineSetup = { perPlate?: number; start?: number; bar?: number };

export const DEFAULT_GYM: Gym = {
  bar: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  colors: [
    { id: 'red', name: 'Red', hex: '#E5322D', kg: 25 },
    { id: 'blue', name: 'Blue', hex: '#2F6BFF', kg: 20 },
    { id: 'yellow', name: 'Yellow', hex: '#F5C518', kg: 15 },
    { id: 'green', name: 'Green', hex: '#2DBE60', kg: 10 },
    { id: 'white', name: 'White', hex: '#F2F2F2', kg: 5 },
  ],
};

export const LB = 0.45359237;

export const toKg = (v: number, u: Unit) => (u === 'lb' ? v * LB : v);
export const fromKg = (kg: number, u: Unit) => (u === 'lb' ? kg / LB : kg);

/** Round for display: whole numbers when close, else one decimal. */
export const round1 = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Math.abs(r - Math.round(r)) < 0.05 ? String(Math.round(r)) : r.toFixed(1);
};

export const fmtKg = (kg: number, u: Unit) => `${round1(fromKg(kg, u))} ${u}`;

/** Plate sizes keep their real precision: 1.25 stays 1.25. */
export const fmtPlate = (kg: number) => String(Math.round(kg * 100) / 100);

/** Which load types make sense for an exercise. The first one is the default. */
export function loadTypesFor(id: string): LoadType[] {
  const ex = EXERCISES[id];
  if (!ex) return ['weight'];
  if (ex.kind === 'reps') return ['bodyweight'];
  if (ex.kind === 'time') return ['timed'];
  if (ex.kind === 'weight_time') return ['weight'];
  switch (ex.equipment) {
    case 'machine':
    case 'cable':
      return ['stack', 'weight'];
    case 'barbell':
    case 'smith':
    case 'ez_bar':
    case 'trap_bar':
    case 'plate_loaded':
      return ['weight', 'plates', 'colors'];
    default:
      return ['weight'];
  }
}

export const defaultLoadType = (id: string) => loadTypesFor(id)[0];

/** The load type in use for an exercise, falling back to the default when a saved one no longer fits. */
export function loadTypeOf(id: string, saved: Record<string, LoadType>) {
  const s = saved[id];
  return s && loadTypesFor(id).includes(s) ? s : defaultLoadType(id);
}

/** Default bar/sled weight for an exercise: 0 for plate-loaded machines and Smith, gym bar otherwise. */
export function barFor(id: string, gym: Gym, machine?: MachineSetup) {
  if (machine?.bar !== undefined) return machine.bar;
  const eq = EXERCISES[id]?.equipment;
  if (eq === 'plate_loaded' || eq === 'smith') return 0;
  if (eq === 'ez_bar') return 10;
  return gym.bar;
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const platesTotal = (plates: number[], bar: number) => bar + 2 * sum(plates);

export const colorsKg = (colors: string[], gym: Gym) =>
  sum(colors.map((c) => gym.colors.find((x) => x.id === c)?.kg ?? 0));

/** kg for a stack pin, or null when the machine isn't set up. Pin 1 = the starting weight. */
export function stackKg(pin: number, m?: MachineSetup) {
  if (!m?.perPlate) return null;
  return (m.start ?? m.perPlate) + (pin - 1) * m.perPlate;
}

/** "2×20 + 2×5 + bar" style breakdown for one side of plates. */
export function platesText(plates: number[], bar: number) {
  const counts = new Map<number, number>();
  for (const p of plates) counts.set(p, (counts.get(p) ?? 0) + 1);
  const parts = [...counts.entries()].sort((a, b) => b[0] - a[0]).map(([kg, n]) => `${n * 2}×${fmtPlate(kg)}`);
  if (bar > 0) parts.push('bar');
  return parts.length ? parts.join(' + ') : 'Empty bar';
}

/** Does a set need a weight number for this kind? */
export const isWeighted = (kind: LogKind) => kind === 'weight_reps' || kind === 'weight_time';
