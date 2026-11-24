// Design tokens. Every colour, font, size, spacing, radius and motion value used by the app lives here.
// Two themes share one identity:
// - Dark: near-black with graphite layers, film grain and a vignette, lit like a spotlight in a dark
//   room.
// - Light: warm off-white paper with warm-grey layers and soft shadows.
// Deep crimson is the rare accent in both (thin lines, small glows, active states, the key number,
// PR moments). Red never means "error": warnings and deletes use amber with an icon. Media (videos,
// renders, photos) always sit on their own dark stage panel. See DESIGN.md.
//
// How theming works: `color` is ONE shared object whose values are swapped in place by applyScheme().
// Style sheets are built lazily with themed(), so they rebuild after a switch; the app re-renders the
// screens on a switch (see ThemeGate in app/_layout.tsx). Never copy a colour into a module-level
// constant: read `color.x` at render time, or inside themed().
const DARK = {
  // Near-black and graphite ladder
  bg: '#070708',
  bgRaised: '#0C0C0E',
  stage: '#0A0A0A', // the clay renders' own background: screens showing them sit on exactly this
  surface: '#111113', // opaque fallback for glass
  surface2: '#18181B',
  surface3: '#232327',
  line: 'rgba(255,255,255,0.06)',
  // Glass: darker and more transparent, a faint 1px edge, low blur
  glass: 'rgba(16,16,19,0.46)', // tint over the blur
  glassSolid: 'rgba(14,14,17,0.92)', // fallback when blur is off
  glassBorder: 'rgba(255,255,255,0.075)',
  glassHighlight: 'rgba(255,255,255,0.055)', // soft light from above
  glassPressed: 'rgba(255,255,255,0.05)',
  // Text (all ≥4.5:1 on the darkest and lightest glass)
  text: '#ECECEF',
  muted: '#A3A3AD',
  subtle: '#868690',
  // Accent: deep crimson. 4.3:1 on black, so it is for lines, rings, icons, glows and large
  // numbers; small accent text uses accentText (≥5:1 on every surface).
  accent: '#E0243A',
  accentPressed: '#FF3B4F',
  accentText: '#FF5466',
  accentDim: 'rgba(224,36,58,0.10)',
  accentGlow: 'rgba(224,36,58,0.32)',
  accentEdge: 'rgba(224,36,58,0.62)', // thin crimson edge on dark-glass buttons
  onAccent: '#FFFFFF', // text/icons on a solid crimson fill (4.7:1)
  glowDeep: '#7A0C17', // very faint dark blood red, far in the background
  // Warnings, errors and deletes: amber/white with an icon, never red.
  warn: '#FFB020',
  warnDim: 'rgba(255,176,32,0.10)',
  warnEdge: 'rgba(255,176,32,0.55)',
  ink: '#070708', // dark text on light fills
  scrim: 'rgba(4,4,5,0.78)',
  scrimDeep: 'rgba(4,4,5,0.92)',
  smoke: '#2A2A30', // slow drifting smoke in the backdrop
  inkTrack: 'rgba(10,10,10,0.18)',
  noGlow: '#000000',
  flash: '#FFFFFF',
  // 3D anatomy: light-grey figure, worked muscles red (nudged toward the crimson accent)
  muscleIdle: '#C9C9CF',
  muscleContext: '#9C9CA4',
  musclePrimary: '#E1283A',
  muscleSecondary: '#C8685C', // muted terracotta: soft, never pink
  // Chrome that differs per theme
  fadeFrom: 'rgba(7,7,8,0)', // transparent end of fades into bg
  sheenTop: 'rgba(255,255,255,0.06)',
  shadow: '#000000',
  chart: '#ECECEF',
  chartGrid: 'rgba(255,255,255,0.08)',
  body3d: '#0C0C0E', // background behind the 3D model
};

export type Palette = { [K in keyof typeof DARK]: string };

/**
 * Light theme: warm off-white paper, warm greys, the same crimson (a shade deeper so small text keeps
 * AA contrast). Contrast on bg #F5F2EE: text 15.8:1, muted 7.4:1, subtle 4.9:1, accentText 6.1:1,
 * warn 5.3:1. White text on accent 6.3:1.
 */
const LIGHT: Palette = {
  bg: '#F5F2EE',
  bgRaised: '#FAF8F5',
  stage: '#0A0A0A', // media keeps its dark stage panel in both themes
  surface: '#FFFFFF',
  surface2: '#EEEAE4',
  surface3: '#E2DDD5',
  line: 'rgba(28,22,16,0.08)',
  glass: 'rgba(255,255,255,0.74)',
  glassSolid: 'rgba(255,255,255,0.97)',
  glassBorder: 'rgba(28,22,16,0.09)',
  glassHighlight: 'rgba(255,255,255,0.7)',
  glassPressed: 'rgba(28,22,16,0.05)',
  text: '#1C1916',
  muted: '#524C46',
  subtle: '#6A635C',
  accent: '#C8102E',
  accentPressed: '#A50D26',
  accentText: '#AE0E28',
  accentDim: 'rgba(200,16,46,0.08)',
  accentGlow: 'rgba(200,16,46,0.20)',
  accentEdge: 'rgba(200,16,46,0.50)',
  onAccent: '#FFFFFF',
  glowDeep: '#F2D4D8',
  warn: '#8F5B00',
  warnDim: 'rgba(176,112,0,0.10)',
  warnEdge: 'rgba(143,91,0,0.55)',
  ink: '#1C1916',
  scrim: 'rgba(28,22,16,0.42)',
  scrimDeep: 'rgba(28,22,16,0.66)',
  smoke: '#E9E3DB',
  inkTrack: 'rgba(28,22,16,0.10)',
  noGlow: '#000000',
  flash: '#FFFFFF',
  muscleIdle: '#C9C5BF',
  muscleContext: '#A39E97',
  musclePrimary: '#D0213A',
  muscleSecondary: '#C8685C',
  fadeFrom: 'rgba(245,242,238,0)',
  sheenTop: 'rgba(255,255,255,0.55)',
  shadow: '#5A4A3A',
  chart: '#1C1916',
  chartGrid: 'rgba(28,22,16,0.10)',
  body3d: '#ECE8E2',
};

export type Scheme = 'dark' | 'light';
export const PALETTES: Record<Scheme, Palette> = { dark: { ...DARK }, light: LIGHT };

/** The live colours. Swapped in place by applyScheme(); read at render time. */
export const color: Palette = { ...DARK };

let current: Scheme = 'dark';
let version = 0;
export const currentScheme = () => current;
export const themeVersion = () => version;

/** Switch every colour (and every themed() style) to `scheme`. Returns true when it changed. */
export function applyScheme(scheme: Scheme) {
  if (scheme === current) return false;
  current = scheme;
  Object.assign(color, PALETTES[scheme]);
  gradient.sheen = [color.sheenTop, 'rgba(255,255,255,0)'] as const;
  version++;
  return true;
}

/**
 * A style object (usually StyleSheet.create) built from the live colours, rebuilt lazily after a
 * theme switch. Use exactly like a StyleSheet: `const s = themed(() => StyleSheet.create({...}))`.
 */
export function themed<T extends object>(build: () => T): T {
  let built: T | null = null;
  let at = -1;
  const get = () => {
    if (!built || at !== version) {
      built = build();
      at = version;
    }
    return built;
  };
  return new Proxy({} as T, {
    get: (_t, k) => (get() as Record<string | symbol, unknown>)[k],
    has: (_t, k) => k in get(),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, k) => ({ ...Object.getOwnPropertyDescriptor(get(), k), configurable: true }),
  });
}

/** Day names. Every day shares the same identity; days differ by name and number. */
export const dayTitle: Record<string, string> = {
  mon: 'Push Day',
  tue: 'Pull Day',
  wed: 'Chest & Grip',
  thu: 'Arms Day',
  fri: 'Back & Chest',
};

/** Gradients: the sheen is the top light on glass. Crimson is never a big gradient; `accent` is the
 * solid fill reserved for the rare PR action. */
export const gradient: { accent: readonly [string, string]; sheen: readonly [string, string] } = {
  accent: ['#E0243A', '#E0243A'] as const,
  sheen: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)'] as const,
};

/** Weekly muscle heat (sets per week): pale → deep red on the light figure. */
export const heat = {
  steps: ['#B98A82', '#CF5E55', '#D93246', '#A80F24'] as const, // dusty red → deep crimson (no pink)
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

/** Type scale: bold but quieter; one big number per screen at most. */
export const size = {
  giga: 76,
  mega: 64,
  numXL: 48,
  display: 32,
  hero: 28,
  title: 24,
  h2: 20,
  h3: 18,
  body: 16,
  small: 14,
  label: 12,
  tiny: 11,
} as const;

export const leading = { giga: 76, mega: 66, numXL: 52, display: 38, hero: 33, title: 30, h2: 26, small: 20, label: 16 } as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32, x4: 40, x5: 56 } as const;

export const radius = { sm: 12, md: 18, lg: 24, xl: 30, xxl: 36, pill: 999 } as const;

export const touch = { min: 48, primary: 56 } as const;

/** Glass panel recipe. `blur` is the expo-blur intensity. */
export const glass = { blur: 18, borderWidth: 1 } as const;

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

/*
 * Bottom clearance for scrolling screens under floating bars. Screens add the measured tab-bar
 * height (or the safe-area inset outside the tabs) to these, so the last content always scrolls
 * fully clear of the tab bar, the fade above it, and any floating button.
 */
export const floating = { tabBar: 78, gap: 14, action: 64, fade: 32 } as const;
export const bottomClearance = {
  /** Above the tab bar: its fade plus breathing room. */
  tabs: floating.fade + 24,
} as const;

/** Text style presets built from the tokens above (rebuilt on a theme switch). */
export const type = themed(() => ({
  display: { fontFamily: font.display, fontSize: size.display, lineHeight: leading.display, letterSpacing: -0.6, color: color.text },
  title: { fontFamily: font.display, fontSize: size.title, lineHeight: leading.title, letterSpacing: -0.3, color: color.text },
  h2: { fontFamily: font.display, fontSize: size.h2, lineHeight: leading.h2, letterSpacing: -0.3, color: color.text },
  h3: { fontFamily: font.bodyBold, fontSize: size.h3, lineHeight: 24, color: color.text },
  body: { fontFamily: font.body, fontSize: size.body, lineHeight: 23, color: color.text },
  bodyMuted: { fontFamily: font.body, fontSize: size.body, lineHeight: 23, color: color.muted },
  small: { fontFamily: font.body, fontSize: size.small, lineHeight: leading.small, color: color.muted },
  label: {
    fontFamily: font.bodyBlack,
    fontSize: size.label,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: color.subtle,
  },
  num: { fontFamily: font.display, fontVariant: ['tabular-nums' as const], color: color.text },
}));

export const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, '0')}`;
