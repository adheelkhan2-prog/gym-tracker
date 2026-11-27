# Round 8 checklist

✓ = done and checked; ✗ = not done.

## Bugs

✓ **1. − / + and Pin | kg.** The − / +, the number boxes, the Pin | kg switch and the log ✓ now use the gesture library's own buttons. A press holds off the page swipe, so a tap can't turn into a swipe or get lost. Hold-to-repeat ticks the haptic on each step and always stops when you let go (with a safety cap).
- Tested with real taps on an Android build, on every set row: +, −, typing, hold and release, and Pin ↔ kg. It passed 3 separate times.

✓ **2. Wrong reps / appending.** Typing replaces the value; it never appends.
- Pre-fill is last session's reps for that same set. If there's no history, it's the plan's target, and it never comes from another field.
- One exception: when the weight steps up, the reps start at the bottom of the range.
- A − / + hold that kept repeating (most likely how 28 and 31 happened) can no longer run on.

✓ **3. Placeholder.** An empty box shows "—". Numbers shrink to fit instead of being cut down to "…".

✓ **4. Cursor.** No cursor over the number until you type. It then stays after the digits.

✓ **5. Week progress.** A day counts as trained when it has any logged set, with or without Finish.
- A past day with most of its planned sets (3 in 4) shows as finished; fewer is partial.
- The week strip, streak and calendar all use this rule. Days trained off the schedule count too.
- Nothing is ever deleted.
- **What I found:** the round-7 cleanup only removed "finished" marks from days with zero logged sets. It never touched sets. I can't see your phone's data from here, so I can't say for certain which case removed Tue and Wed. The app now covers both possible causes:
  - Days whose sets were ticked but saved without every number now count.
  - If saved data once couldn't be read, the app had started fresh but kept a backup copy on the phone. The app now merges those copies back in once, and Today shows a note listing the days it restored. It never undoes a "Delete workout history".
  - A storage read that keeps failing no longer saves over your data. Today shows a warning instead and keeps retrying.

✓ **6. Workout complete, 3D model.** It frames head to hips, facing the side you trained (back days face the back). Leg days show the whole body.

✓ **7. Volume.** Only sets logged in kg count, never pin numbers, even from an old kg-per-plate setting. Pin sets show separately ("+ 3 pin sets by machine pin") on the complete screen, Progress and the calendar (day and month).

✓ **8. Rest timer (Huawei).**
- "Rest is over" is an exact alarm clock on a max-priority channel, with vibration and sound at 0:00.
- The lock-screen countdown is an Android chronometer, updated by Android itself. It clears itself at 0:00.
- +15s and Skip update or cancel it straight away.
- First launch asks to turn battery optimisation off, with a button to the right setting. On Huawei it also opens App launch. The same sheet is in Settings.
- Emulator test results:
  - **Screen off (forced Doze):** the alert came 0.3 s after 0:00.
  - **App in background:** 0.2 s after 0:00.
  - **+15s:** moved it by exactly 15 s.
  - **Skip:** cleared both the countdown and the alarm.

## Changes

✓ **9. Light mode red.**
- Solid crimson Start workout / Next exercise / Done with white text.
- Solid crimson progress ring, streak flame, selected day chip and ticks for logged days.
- Crimson section labels and key numbers, and a warm crimson glow at the top.
- Everything passes AA (lowest 4.9:1). Dark mode is unchanged.

✓ **10. Share removed.** Done is full width.

## Ship

✓ Typecheck, lint, expo-doctor 20/20, 165 tests: no errors.

✓ Code review: run 6 times, and every finding is fixed except 2 I kept on purpose:
- **Pre-fill:** it follows your rule (last session's reps), not the app's suggested +1 rep / weekly-target reps. The "Target this week" line can therefore read 1 rep higher than the rows.
- **Battery permission:** the app asks for the battery-optimisation permission, which Google Play restricts. It's fine for an APK you install directly.

✓ Light and dark screenshots of every changed screen: `docs/screenshots/round-8/`.

✓ Final test: 3 crash-test loops (every flow, including − / + and the finish screen) with the network on: 0 bytes sent, no crash. Then 1 airplane-mode run: passed.

✗ EAS APK (versionCode 11, same key, installs over build 10). Builds after the test passes.
