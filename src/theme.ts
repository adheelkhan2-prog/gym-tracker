// Design tokens. Every colour, font, size, spacing, radius and motion value used by the app lives here.
// Glassmorphism on black: lime is the action colour, hot pink only glows behind glass
// and marks PRs and the streak flame. See DESIGN.md.

export const color = {
  // Black ladder (from the Raycast DESIGN.md base)
  bg: '#0A0A0A',
  bgRaised: '#101011',
  surface: '#161618', // opaque fallback for glass
  surface2: '#1F1F22',
  surface3: '#2A2A2E',
  line: 'rgba(255,255,255,0.09)',
  // Glass
  glass: 'rgba(28,28,32,0.55)', // tint over the blur
  glassSolid: 'rgba(24,24,28,0.86)', // fallback when blur is off
  glassBorder: 'rgba(255,255,255,0.15)',
  glassHighlight: 'rgba(255,255,255,0.10)',
  glassPressed: 'rgba(255,255,255,0.06)',
  // Text (all ≥4.5:1 on glass, including over the glow blobs)
  text: '#F5F5F7',
  muted: '#B4B4BC',
  subtle: '#9A9AA4',
  // Accents
  lime: '#C8FF2E',
  limeSoft: '#E4FF99',
  limeDim: 'rgba(200,255,46,0.14)',
  limeGlow: 'rgba(200,255,46,0.35)',
  pink: '#FF3D9A',
  pinkSoft: '#FF9CCB',
  pinkDim: 'rgba(255,61,154,0.14)',
  pinkGlow: 'rgba(255,61,154,0.30)',
  danger: '#FF5C7A',
  ink: '#0A0A0A', // text on lime / pink
  scrim: 'rgba(10,10,10,0.72)',
  scrimDeep: 'rgba(10,10,10,0.90)',
  inkTrack: 'rgba(10,10,10,0.18)',
  noGlow: '#000000',
  flash: '#FFFFFF',
  // 3D anatomy: light-grey figure, worked muscles red
  muscleIdle: '#C9C9CF',
  muscleContext: '#9C9CA4',
  muscleInjured: '#55555C',
  musclePrimary: '#E5322D',
  muscleSecondary: '#F08F86',
} as const;

/** Day names. Every day shares the lime/pink identity; days differ by name and number. */
export const dayTitle: Record<string, string> = {
  mon: 'Push Day',
  tue: 'Pull Day',
  wed: 'Chest & Grip',
  thu: 'Arms Day',
  fri: 'Back & Chest',
};

/** Lime glow gradients for heroes; pink stays in the background blobs. */
export const gradient = {
  lime: ['#D9FF6B', '#C8FF2E', '#9EE000'] as const,
  limeFade: ['rgba(200,255,46,0.22)', 'rgba(200,255,46,0)'] as const,
  sheen: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'] as const,
};

/** Weekly muscle heat (sets per week): pale → deep red on the light figure. */
export const heat = {
  steps: ['#F4B6AE', '#EC7A6C', '#DD3F31', '#B5120A'] as const,
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

/** Type scale: Raycast's 64/56/24/22/20/18/16 ladder, pushed to a 96 mega number. */
export const size = {
  giga: 96,
  mega: 80,
  numXL: 56,
  display: 40,
  hero: 34,
  title: 28,
  h2: 22,
  h3: 18,
  body: 16,
  small: 14,
  label: 12,
  tiny: 11,
} as const;

export const leading = { giga: 92, mega: 80, numXL: 58, display: 44, hero: 38, title: 32, h2: 26, small: 20, label: 16 } as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32, x4: 40, x5: 56 } as const;

export const radius = { sm: 12, md: 18, lg: 24, xl: 30, xxl: 36, pill: 999 } as const;

export const touch = { min: 48, primary: 56 } as const;

/** Glass panel recipe. `blur` is the expo-blur intensity. */
export const glass = { blur: 40, borderWidth: 1 } as const;

/** Spring physics everywhere; durations only for fades. */
export const motion = {
  fast: 160,
  base: 220,
  pressScale: 0.95,
  spring: { damping: 15, stiffness: 320, mass: 0.6 },
  pop: { damping: 9, stiffness: 380, mass: 0.5 },
  gentle: { damping: 18, stiffness: 140, mass: 0.9 },
  swipe: { damping: 20, stiffness: 220, mass: 0.8 },
  stagger: 70,
} as const;

/** Room left under scrolling content so a floating bar never hides the last row. */
export const restBarClearance = 140;

/** Text style presets built from the tokens above. */
export const type = {
  display: { fontFamily: font.display, fontSize: size.display, lineHeight: leading.display, letterSpacing: -1.2, color: color.text },
  title: { fontFamily: font.display, fontSize: size.title, lineHeight: leading.title, letterSpacing: -0.6, color: color.text },
  h2: { fontFamily: font.display, fontSize: size.h2, lineHeight: leading.h2, letterSpacing: -0.3, color: color.text },
  h3: { fontFamily: font.bodyBold, fontSize: size.h3, lineHeight: 24, color: color.text },
  body: { fontFamily: font.body, fontSize: size.body, lineHeight: 23, color: color.text },
  bodyMuted: { fontFamily: font.body, fontSize: size.body, lineHeight: 23, color: color.muted },
  small: { fontFamily: font.body, fontSize: size.small, lineHeight: leading.small, color: color.muted },
  label: {
    fontFamily: font.bodyBlack,
    fontSize: size.label,
    letterSpacing: 1.2,
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
