# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

One person: the owner, training five days a week (Mon–Fri) in a commercial gym, logging on their own Android phone between sets. Hands are often sweaty or chalked, attention is on the lift, and rest periods are 90 s to 2 min.

## Product Purpose

A personal gym log for a fixed upper-body split. It shows today's workout, makes logging each set take one or two taps, shows last session's numbers beside every set, and tells the user when to add weight. It also reminds the user to take creatine and protein (8 AM, then 1 PM and 7 PM until marked taken). Success: every set gets logged, weights go up over weeks, and supplements are taken daily.

## Positioning

Built around one person's program and injury: no leg or ab training while injured, a training rule set (rest times, progression hint, Wednesday pressing caution, joint-pain skip) baked in, and a 3D muscle model showing exactly what each exercise and each week worked.

## Operating Context

- Used mid-workout, one-handed, often in bright or dim gym light.
- Program: Mon Chest/Biceps/Shoulders, Tue Back/Triceps, Wed Chest/Forearms, Thu Shoulders/Arms, Fri Back/Chest. Sat and Sun are rest days.
- Data stays on the phone (no accounts, no cloud).
- Distributed as a sideloaded APK built by GitHub Actions; a web demo exists for quick previews.

## Capabilities and Constraints

- Expo SDK 58, Expo Router, React Native 0.88, Android only.
- Injury mode: legs and abs are excluded from the program and shown as "resting (injury)". A Settings switch turns injury mode off once recovered.
- Exercises with "X OR Y" options remember the chosen variant.
- Push-ups log reps only; farmer's walk logs weight and seconds.
- Supplement reminders must keep working exactly as they do today.
- 3D muscle model: Z-Anatomy derivative (CC BY-SA 4.0), credit required in the app.

## Brand Commitments

- Name: Gym Tracker.
- The owner asked for a fun, energetic, game-like feel (Duolingo energy for the gym) that never slows logging: 1–2 taps per set, animations under 300 ms.

## Evidence on Hand

- The owner's own logged workouts and supplement history (on device). No testimonials, users or metrics beyond that.

## Product Principles

1. Logging speed beats decoration: nothing may add a tap or a wait to completing a set.
2. Reward real progress (PRs, streaks, finished workouts), never empty activity.
3. Protect the injury: never suggest leg or ab work while injury mode is on.
4. Show the previous session everywhere a number is entered.

## Accessibility & Inclusion

48 dp minimum touch targets, 4.5:1 text contrast, respect the system font size and the "Remove animations" setting.
