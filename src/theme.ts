export const C = {
  bg: '#0D0E10',
  surface: '#16181B',
  surface2: '#1F2226',
  line: '#2A2E33',
  text: '#F3F4F6',
  muted: '#8B9098',
  faint: '#5C6168',
  accent: '#C6F432', // volt green
  accentInk: '#0D0E10', // text on accent
  warn: '#FFB547',
  danger: '#FF6B5E',
  pr: '#FFD84D',
};

export const R = { sm: 8, md: 14, lg: 20 };

export const font = {
  // Android's default Roboto; heavy weights and tabular numbers for the data.
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8, color: C.text },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3, color: C.text },
  body: { fontSize: 15, color: C.text },
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.8, color: C.muted, textTransform: 'uppercase' as const },
  num: { fontVariant: ['tabular-nums' as const] },
};

export const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const fmtRest = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
