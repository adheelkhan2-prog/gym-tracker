// Design tokens. Every colour, font, size, spacing and radius used by the app lives here.
// See DESIGN.md for the reasoning behind each value.

export const color = {
  bg: '#0B0B10',
  surface: '#16161F',
  surface2: '#20202C',
  surface3: '#2A2A39',
  line: '#2C2C3A',
  text: '#F7F7FA',
  muted: '#A9A9BC',
  subtle: '#8C8CA3',
  lime: '#C8FF2E',
  limeSoft: '#E4FF99',
  limeDim: '#24301A', // lime-tinted surface (done set rows)
  orange: '#FF6A2B',
  orangeSoft: '#FFB08A',
  orangeDim: '#33190F', // orange-tinted surface (streak / reminder cards)
  gold: '#FFD23F',
  goldDim: '#332A0C',
  danger: '#FF5C7A',
  ink: '#0B0B10', // text on lime / orange / gold
  scrim: 'rgba(11,11,16,0.72)',
  inkTrack: 'rgba(11,11,16,0.18)', // progress track on gradient cards
  // 3D model
  muscleIdle: '#3A3A4C',
  muscleContext: '#2A2A36',
  muscleInjured: '#5E5E6E',
  noGlow: '#000000', // emissive off
} as const;

/** Lime → orange "energy bar" gradient. Used on the hero card, the main CTA and the finish screen only. */
export const gradient = {
  energy: [color.lime, '#F6E43A', color.orange] as const,
  heroCard: ['#C8FF2E', '#FFB13B', '#FF6A2B'] as const,
  surface: ['#1D1D29', '#14141C'] as const,
};

/** Weekly muscle heat (sets per week), dim → bright orange. */
export const heat = {
  steps: ['#4A2A1E', '#8A3A17', '#D9531A', '#FF8A3D'] as const,
  thresholds: [1, 5, 10, 15] as const, // at least N sets reaches step i
};

export const font = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  body: 'Figtree_500Medium',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
  bodyBlack: 'Figtree_800ExtraBold',
} as const;

export const size = {
  numXL: 56,
  hero: 34,
  display: 40,
  title: 28,
  h2: 22,
  h3: 18,
  body: 16,
  small: 14,
  label: 12,
  tiny: 11,
} as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32, x4: 40 } as const;

/** Line heights paired with the type sizes. */
export const leading = { hero: 38, display: 44, h2: 26, small: 20, label: 16 } as const;

/** Room left under scrolling content so the floating rest bar never hides the last row. */
export const restBarClearance = 140;

export const radius = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 } as const;

export const touch = { min: 48, primary: 56 } as const;

export const motion = {
  fast: 160,
  base: 220,
  pressScale: 0.96,
  spring: { damping: 14, stiffness: 320, mass: 0.6 },
  pop: { damping: 9, stiffness: 380, mass: 0.5 },
} as const;

/** Text style presets built from the tokens above. */
export const type = {
  display: { fontFamily: font.display, fontSize: size.display, lineHeight: leading.display, letterSpacing: -1, color: color.text },
  title: { fontFamily: font.display, fontSize: size.title, lineHeight: 32, letterSpacing: -0.6, color: color.text },
  h2: { fontFamily: font.display, fontSize: size.h2, lineHeight: 27, letterSpacing: -0.3, color: color.text },
  h3: { fontFamily: font.bodyBold, fontSize: size.h3, lineHeight: 24, color: color.text },
  body: { fontFamily: font.body, fontSize: size.body, lineHeight: 23, color: color.text },
  bodyMuted: { fontFamily: font.body, fontSize: size.body, lineHeight: 23, color: color.muted },
  small: { fontFamily: font.body, fontSize: size.small, lineHeight: leading.small, color: color.muted },
  label: {
    fontFamily: font.bodyBlack,
    fontSize: size.label,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: color.muted,
  },
  num: { fontFamily: font.display, fontVariant: ['tabular-nums' as const], color: color.text },
} as const;

export const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, '0')}`;
