# Design: Gym Tracker

Base: Spotify's dark, tactile, pill-and-circle system (`~/.claude/design-md/spotify/DESIGN.md`),
pushed much bolder: two loud accents instead of one, gradient hero surfaces, chunkier shapes
and a playful display face. Goal: Duolingo-style energy for the gym that never slows logging.

Taste settings: boldness high, animation high, density low–medium.

## World

A night-time gym floor under neon: deep blue-black ground, chalk-white type, and two
"plate colours" that mean something:

- **Electric lime**: the *do it* colour. Primary actions, completed sets, primary muscles, progress.
- **Hot orange**: the *heat* colour. Streak flames, rest timer, supplements, weekly muscle heat.
- **Gold** is reserved for personal records only.

The lime→orange gradient is the "energy bar". It appears on exactly three things: today's
workout hero card, the main Start/Finish button, and the workout-complete screen.

## Tokens

All tokens live in `src/theme.ts`. No component uses a raw colour, size, radius or spacing value.

| Role | Token | Value |
|---|---|---|
| Ground | `color.bg` | `#0B0B10` |
| Card | `color.surface` | `#16161F` |
| Raised / input | `color.surface2` | `#20202C` |
| Hairline | `color.line` | `#2C2C3A` |
| Text | `color.text` | `#F7F7FA` |
| Secondary text | `color.muted` | `#A9A9BC` (≥6.9:1 on every surface) |
| Tertiary text | `color.subtle` | `#8C8CA3` (≥4.9:1 on every surface) |
| Accent 1 | `color.lime` | `#C8FF2E` |
| Accent 2 | `color.orange` | `#FF6A2B` |
| PR | `color.gold` | `#FFD23F` |
| Ink on accents | `color.ink` | `#0B0B10` (never white on orange: 2.9:1) |

Type: **Bricolage Grotesque** (800/700) for display and every number, **Figtree** (500–800) for
UI text. Numbers are always tabular. Scale: 56 / 40 / 28 / 22 / 18 / 16 / 14 / 12.

Shape: chunky radii 12 / 18 / 24 / 32, pills for chips and primary buttons. Touch targets ≥48 dp,
primary actions 56 dp. Spacing on a 4 dp grid.

## Motion

- Every pressable scales to 0.96 on press-in (spring back, ~160 ms).
- A completed set's check pops with a spring (overshoot, <300 ms) and a light haptic.
- Rest timer is an orange ring that drains; it buzzes when done.
- A new PR fires confetti and a gold "NEW PR!" banner that never blocks input.
- System "Remove animations" turns all of this into instant state changes.

## Don'ts

No gradient text, no emoji as icons (Ionicons only), no one-sided accent bars on cards, no
eyebrow labels above headings, no white text on orange.
