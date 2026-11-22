# Design references

Notes only. No screenshots or artwork from other products are stored here, so nothing
copyrighted ships with the app.

## How these were gathered

- Mobbin MCP was not connected, so app screens come from public product pages and from
  first-hand knowledge of the apps, written up as patterns rather than copied visuals.
- Godly (godly.website) now redirects to recent.design, which this environment's network
  does not allow, so it could not be browsed.
- Watermelon UI (ui.watermelon.sh) was browsed: a large catalogue (600+ components, 100+
  animations) with a lime primary and soft, rounded surfaces.
- The anatomy style reference is the image attached in chat (light-grey muscled figure on
  black, worked muscles red, start/end positions side by side). It is a commercial
  illustration and is not included; we build our own look with the Z-Anatomy model.

## What to borrow

| Source | Borrow | Where it lands |
|---|---|---|
| **Hevy** | "Previous" values inline on every set; tap ✓ completes and starts the rest timer; tapping a previous value reuses it | Exercise set rows, one-tap complete |
| **Strong** | Ruthless speed: no confirmation between sets, numbers big and left-aligned | Set rows, no modal between sets |
| **Fitbod** | Muscle map as the main visual of a workout; recovery heat | 3D model on Exercise, weekly heat map |
| **Apple Fitness+** | Rings as the single progress language; huge numerals; summary screen where stats count up one after another | Today ring, Workout done stats, rest ring |
| **Nike Training Club** | Bold condensed headlines over dark imagery; full-bleed workout cards | Today hero and swipe deck |
| **Duolingo** | Streak flame, XP bar that fills after a lesson, level-up burst, playful copy that changes every time, celebrations you can tap through | XP/ranks, streaks, rotating copy, skippable celebrations |
| **Watermelon UI** | Lime-led accent on calm surfaces; animated counters and badges as first-class components; variants via tokens | Component variants (Button/Badge/Card) driven by `src/theme.ts` |
| **Glassmorphism (current)** | Frosted panels with a 1px ~15% white border and a faint top highlight, coloured glow blobs drifting behind the glass, huge display numbers | Glass cards, drifting lime/pink backdrop |
| **Anatomy reference** | Light-grey figure, black ground, worked muscles red, secondary muscles lighter red | 3D model materials |

## Rules taken from the references

1. Lime is the action colour. Hot pink only glows behind glass and marks PRs / streak flame.
2. One hero per screen: a ring, a huge number or the 3D body. Never a grid of equal tiles.
3. Every number that matters counts up; every list staggers in; nothing animates linearly.
4. Celebrations are proportional and skippable; logging a set stays one tap.
