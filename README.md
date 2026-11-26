# Gym Tracker

An Android app (Expo / React Native) for a 5-day Push · Pull · Legs · Upper · Lower split.

## What it does

- **Today**: today's workout from your program and week, a 5-minute warm-up, supplements, and your week at a glance.
- **Focus mode**: one exercise at a time with the set pre-filled (last time, or a step up when you earned it), so logging is one tap. Rest timer with a lock-screen countdown.
- **Programs**: seven built-in splits plus your own, with an injury mode that hides leg and ab work.
- **How to**: clay 3D images of every exercise (or a photo where there isn't one yet) and an interactive 3D muscle model.
- **Progress**: charts per exercise, PRs, weekly muscle heat, XP and streaks.
- **Supplements**: creatine and protein reminders at 8 AM, then 1 PM and 7 PM until marked taken.

All data stays on the phone. No accounts, no analytics.

## Develop

```bash
npm install
npx expo start          # dev server
npx tsc --noEmit        # typecheck
npx expo lint           # lint
```

Build an APK locally (needs the Android SDK and Java 21):

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The APK lands in `android/app/build/outputs/apk/release/`. On GitHub, the
**Build Android APK** workflow does this on every push to `main` and attaches
the APK to the run.

## Credits and licences

Code: MIT (see `LICENSE`). Assets keep their own licences, listed in full in
[`src/data/asset-licences.md`](src/data/asset-licences.md) and in the app under Settings → Credits:

- 3D muscle model: [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy), based on
  [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/), via the
  [Gymmetry muscle map](https://github.com/kalibismail/gymmetry-muscle-model): CC BY-SA 4.0.
- Clay exercise images: rendered for this app from the muscle model above and the
  [MakeHuman / MPFB2](https://github.com/makehumancommunity/mpfb2) body (CC0): CC BY-SA 4.0.
- Exercise photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense, public domain).
- Fonts: Bricolage Grotesque and Figtree (SIL Open Font License).
