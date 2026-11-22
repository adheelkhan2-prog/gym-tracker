# Gym Tracker

An Android app (Expo / React Native) for a 5-day Push · Pull · Legs · Upper · Lower split.

## What it does

- **Train**: shows today's workout from your weekly schedule. Each exercise has a photo, sets × reps and what you lifted last time. You can switch to any day.
- **Log sets**: enter weight and reps for every set, tick it off, and a rest timer starts. Empty fields reuse last session's numbers. New personal records get a **PR** badge. When you hit the top of the rep range on every set, the app tells you to go heavier.
- **Progress**: chart of your heaviest set or estimated 1-rep max for each exercise, plus session history.
- **Supplements**: tick creatine and protein each day. The reminder comes at **8:00 AM** with **Taken** / **Not yet** buttons. If you haven't taken them, you're reminded again at **1:00 PM** and **7:00 PM**. Tapping Taken cancels the rest of that day's reminders. All three times are adjustable.
- **Settings**: lb / kg, and which workout falls on which weekday.

All data stays on the phone.

## The program

| Day | Workout | Focus |
|---|---|---|
| Mon | Push | Chest · Shoulders · Triceps |
| Tue | Pull | Back · Rear delts · Biceps |
| Wed | Legs | Quads · Hamstrings · Calves |
| Thu | Rest | |
| Fri | Upper | Chest · Back · Arms |
| Sat | Lower | Glutes · Hamstrings · Core |
| Sun | Rest | |

Exercises, sets, reps and rest times are in `src/data/program.ts`.

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

## Credits

Exercise photos and instructions: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense / public domain).
