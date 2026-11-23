# Design: Gym Tracker

A dark room lit by one spotlight. Near-black and graphite layers, film grain, a vignette, slow
dark smoke. Deep crimson is the only accent, and it is rare. Premium and quiet, never a poster.

Taste settings: boldness 7/10, animation 7/10, density 3/10.

## World

- **Ground**: near-black `#070708` with graphite surfaces; one soft spotlight from above,
  slow-drifting dark smoke, a very faint dark blood-red glow far back (`#7A0C17`), film grain,
  and a vignette at the edges.
- **Glass**: dark and fairly transparent, low blur, a faint 1px border, a brighter top edge
  (lit from above) and a deep shadow underneath.
- **Crimson `#E0243A`** is the rare accent: thin lines, small glows, active states, the one
  number that matters, PR moments. Pressed: `#FF3B4F`. No big red gradients, no solid red blocks
  (small active fills like a checked set or a level bubble are the limit).
- **Red never means "wrong"**. Warnings, errors and deletes are amber `#FFB020` / white with an
  icon.
- **Main buttons** are dark glass with a thin crimson edge and a crimson label. A solid crimson
  button is reserved for the PR/finish moment.
- **Clay exercise renders** sit in the same room: on black, with a vignette; their muscle glow is
  red-orange, close enough to the crimson UI to read as one family.

## Tokens

All tokens live in `src/theme.ts`.

| Role | Token | Value |
|---|---|---|
| Ground | `color.bg` | `#070708` |
| Surfaces | `color.surface` / `surface2` / `surface3` | `#111113` / `#18181B` / `#232327` |
| Glass tint / border | `color.glass` / `glassBorder` | `rgba(16,16,19,0.46)` / `rgba(255,255,255,0.075)` |
| Text | `color.text` | `#ECECEF` |
| Secondary / tertiary text | `color.muted` / `subtle` | `#A3A3AD` / `#868690` (≥4.5:1) |
| Accent (lines, rings, icons, big numbers) | `color.accent` | `#E0243A` (4.3:1 on black: not for small text) |
| Accent pressed | `color.accentPressed` | `#FF3B4F` |
| Accent small text | `color.accentText` | `#FF5466` (≥5.0:1 on every surface) |
| On a crimson fill | `color.onAccent` | `#FFFFFF` (4.7:1) |
| Far background glow | `color.glowDeep` | `#7A0C17` |
| Warning / delete | `color.warn` | `#FFB020` with an icon |

Type: **Bricolage Grotesque** (800/700) for display and numbers, **Figtree** (500–800) for UI
text; numbers tabular. Bold but quiet: one big number per screen. Scale: 76 / 64 / 48 / 32 / 28 /
24 / 20 / 18 / 16 / 14 / 12.

Shape: radii 12 / 18 / 24 / 30 / 36, pills for buttons and chips. Touch targets ≥48 dp, primary
actions 56 dp, all main actions in the bottom third (thumb reach). Spacing on a 4 dp grid.

## Motion

- Pressables spring to 0.95 with a crimson ring and a light haptic.
- Focus mode: swipe between exercises, pull down to close, long-press a set to edit, swipe to
  delete (with undo); every gesture also has a button or a screen-reader action.
- Rest: full-screen dark ring that drains; haptic (and optional sound) at zero; ongoing
  countdown notification.
- PR: one crimson flash, crimson particles, a haptic, a small "New PR" pill.
- Smoke drifts slowly; under reduce motion everything rests and state changes are instant.
- Loading shows skeletons, never spinners.

## Don'ts

No gradient text, no emoji as icons (the app's own SVG icon set), no one-sided accent bars on
cards, no pink, no lime, no red for errors, no small text in `#E0243A` (use `accentText`).
