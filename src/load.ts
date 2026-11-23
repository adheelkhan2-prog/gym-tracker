// Load types: how the weight on a set is entered (kg/lb, machine pin, bodyweight, timed), and how
// it turns into kilograms. Machine settings are always kilograms (that's what's printed on the
// stack); the kg/lb switch only changes what is shown.

import type { LogKind } from './data/exercises';
import { EXERCISES } from './data/exercises';

export type Unit = 'kg' | 'lb';

export type LoadType = 'weight' | 'stack' | 'bodyweight' | 'timed';

export const LOAD_LABEL: Record<LoadType, string> = {
  weight: 'Weight',
  stack: 'Machine pin',
  bodyweight: 'Bodyweight',
  timed: 'Timed',
};

export const LOAD_HINT: Record<LoadType, string> = {
  weight: 'Type the weight in kg or lb',
  stack: 'Log the pin number; add kg per plate to see the weight',
  bodyweight: 'Reps only',
  timed: 'Seconds only',
};

/** Extra detail saved with a set for the machine-pin load type. */
export type LoadInfo = {
  t: LoadType;
  /** Machine stack pin / plate number. */
  pin?: number;
};

/** Machine setup: kg per stack plate and the weight at pin 1. */
export type MachineSetup = { perPlate?: number; start?: number };

export const LB = 0.45359237;

export const toKg = (v: number, u: Unit) => (u === 'lb' ? v * LB : v);
export const fromKg = (kg: number, u: Unit) => (u === 'lb' ? kg / LB : kg);

/** Round for display: whole numbers when close, else one decimal. */
export const round1 = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Math.abs(r - Math.round(r)) < 0.05 ? String(Math.round(r)) : r.toFixed(1);
};

export const fmtKg = (kg: number, u: Unit) => `${round1(fromKg(kg, u))} ${u}`;

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

/** kg for a stack pin, or null when the machine isn't set up. Pin 1 = the starting weight. */
export function stackKg(pin: number, m?: MachineSetup) {
  if (!m?.perPlate) return null;
  return (m.start ?? m.perPlate) + (pin - 1) * m.perPlate;
}

/** Does a set need a weight number for this kind? */
export const isWeighted = (kind: LogKind) => kind === 'weight_reps' || kind === 'weight_time';

/** kg for a machine pin, or null when it can't be known yet (machine without kg per plate). */
export function loadKg(l: LoadInfo, machine?: MachineSetup): number | null {
  if (l.t === 'stack') return l.pin !== undefined ? stackKg(l.pin, machine) : null;
  return null;
}

/** The saved weight for a set logged with a pin: always kg (stack plates are kg), plus the pin. */
export function weightFromLoad(l: LoadInfo, machine?: MachineSetup): { weight: string; u: Unit; load: LoadInfo } {
  const kg = loadKg(l, machine);
  return { weight: kg === null ? '' : String(Math.round(kg * 100) / 100), u: 'kg', load: l };
}
