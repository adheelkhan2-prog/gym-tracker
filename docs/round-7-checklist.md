# Round 7: checklist before building the APK

Branch `round-7`. Checks: typecheck ✓, lint ✓, expo-doctor 20/20 ✓, 135 unit tests ✓, Code Review plugin
run twice (every finding fixed, except the shorter test runs you asked for).

## Bugs

| # | Item | Status |
| --- | --- | --- |
| 1 | Today "Done" with 0 sets | ✓ Done only when finished with sets logged. Today's card always has Start / Continue / Train again. Any day in the week strip can be trained. The wrong "finished" marks saved on your phone are removed on update, and every set is kept. |
| 2 | Status bar overlap | ✓ Solid strip and fade behind the status bar on Today, Progress, Supps, Settings, exercise, programs, builder and finish screens. The workout header is fixed. |
| 3 | Background hard edge | ✓ The glow blobs were clipped by a screen-sized moving view. Each now moves inside its own blob-sized view. |
| 4 | Red line on Seated Cable Row | ✓ Every image and video file was scanned and all are clean. The line was the crimson press ring drawn over the video. Media no longer has a ring, and videos use a TextureView. |
| 5 | 222 kg shoulder press | ✓ Not a unit conversion. Tapping a box could append digits ("2" + "22" = "222"); typing now replaces the value. Added the "That's a big jump, is 222 kg right?" check. Every set can be edited or deleted from the exercise history and the calendar. Progress lift rows now show your unit. |
| 6 | 3D head | ✓ The head skin had a hole in the skull. A fitted skull now fills it. The rim light is neutral, so the face never glows red. The whole body fits in frame, and the hint sits below the model. |
| 7 | Farmer's Walk "40 reps" | ✓ Timed exercises use seconds everywhere: targets, rows (Sec, ±5 s), PRs, and +5 s progressive overload. |
| 8 | Swap on a real build | ✓ Passed in the emulator runs (swap on page 2). |

## Changes

| # | Item | Status |
| --- | --- | --- |
| 9 | One exercise per page | ✓ Next exercise (crimson once all sets are logged) and ← Previous, swipe left/right, an "Exercise 2 of 7" bar that opens the list, Finish on the last page. Notes are collapsible with no ⓘ. Rest timer, swap, PR moment, validation and scrolling over the boxes all work. |
| 10 | Smoother pop-ups | ✓ One UI-thread value drives every sheet: a soft spring, a backdrop that fades with it, drag down to close, and a slide-away on close. |
| 11 | **Changed:** keep machine pins, tap-only | ✓ Pin logging is kept; "Set kg per plate" is removed. Each set has − / + for pin or kg (pin 1, kg 2.5, 1 for dumbbells under 10 kg, lb 5 / 2) and for reps (1) or seconds (5). The number in the middle can be tapped to type. Holding repeats faster with a light tick. Sets pre-fill from the set above or your last session. The compact Pin / kg switch sits in the set header. The placeholder is "—" and the cursor is crimson. Lifts you logged in kg stay in kg after the update. |
| 12 | Remove rank/XP | ✓ Removed from Today, Progress, Workout complete and the share card. |
| 13 | Progress → Lifts | ✓ Every exercise in your plan, grouped by day, plus search over your history. Lifts with no sets say "No sets yet", and a lift with only one session gets a "First session" card instead of a chart. |
| 14 | Per-supplement reminders | ✓ The shared block is gone. Tap a supplement to set its own on/off, morning time, follow-ups and last call, using the phone's time picker. Each has its own notification with Taken / Not yet, its own streak and its own test button. Rename and delete are available. Your Creatine and Protein settings and streaks carry over. |
| 15 | Remove Frosted glass | ✓ Cards are solid everywhere; expo-blur is removed. |
| 16 | Switches | ✓ White knob, crimson when on, grey when off, in both themes. |
| 17 | Dark mode visibility | ✓ Lighter charcoal cards, stronger borders and lighter secondary text. Every text colour passes WCAG AA on every surface (lowest 4.56:1). |

## Content

| # | Item | Status |
| --- | --- | --- |
| 18 | More real videos | ✓ 7 new real-person videos: Push-Ups, Pull-Ups, Lat Pulldown (replacing the clay loop), Machine Chest Press, Cable Crossover, Hanging Leg Raise and Front Squat. That makes 42 of 128 exercises, and 15 of 35 in your split. There are no clay loops left. Every licence is recorded in `src/data/asset-licences.md` and in Settings → Credits. Searched: wger ✓, Mixkit ✓ (Free licence only), Wikimedia Commons (only a sumo deadlift, forward lunge and push press), Openverse (images and audio only, no video). Pexels and Pixabay block automated access without a free API key. The no-video list is in the report. |
| 19 | Audit every program | ✓ Upper Body 5-Day matches your split exactly. The other 6 programs have no duplicates and correct weekdays and names, and timed exercises use seconds. Changes: see the table in the report. |

## New

| Item | Status |
| --- | --- |
| Workout calendar (top of Progress) | ✓ Month view: swipe for months, Today button, crimson dot (filled = finished, outline = partial), a small marker for days you took all your supplements, and today highlighted. Tap a day for the workout name, every exercise and set (pin or kg × reps), 🏆 PRs, duration and volume, with edit or delete on any set. A month summary shows workouts, volume, PRs and best streak. Offline, light and dark, built from your existing history. |

## Still to do before sending the APK

- Final test: 3 crash-test loops, then 1 airplane-mode run.
- EAS build (same key, installs over build 8).
