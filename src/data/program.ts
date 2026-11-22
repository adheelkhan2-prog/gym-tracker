// 5-day Push / Pull / Legs / Upper / Lower split.
// Each muscle group is trained about twice a week. Heavy compound lifts first,
// then accessories at higher reps.

export type PlannedExercise = {
  exerciseId: string;
  sets: number;
  reps: string; // target rep range, e.g. "6-8"
  rest: number; // rest between sets, seconds
};

export type WorkoutDay = {
  id: string;
  name: string;
  focus: string;
  exercises: PlannedExercise[];
};

export const DAYS: WorkoutDay[] = [
  {
    id: 'push',
    name: 'Push',
    focus: 'Chest · Shoulders · Triceps',
    exercises: [
      { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: 4, reps: '6-8', rest: 150 },
      { exerciseId: 'Incline_Dumbbell_Press', sets: 3, reps: '8-10', rest: 120 },
      { exerciseId: 'Seated_Dumbbell_Press', sets: 3, reps: '8-10', rest: 120 },
      { exerciseId: 'Side_Lateral_Raise', sets: 3, reps: '12-15', rest: 60 },
      { exerciseId: 'Cable_Crossover', sets: 3, reps: '12-15', rest: 60 },
      { exerciseId: 'Triceps_Pushdown_-_Rope_Attachment', sets: 3, reps: '10-12', rest: 60 },
      { exerciseId: 'Cable_Rope_Overhead_Triceps_Extension', sets: 3, reps: '10-12', rest: 60 },
    ],
  },
  {
    id: 'pull',
    name: 'Pull',
    focus: 'Back · Rear delts · Biceps',
    exercises: [
      { exerciseId: 'Wide-Grip_Lat_Pulldown', sets: 4, reps: '8-10', rest: 120 },
      { exerciseId: 'Bent_Over_Barbell_Row', sets: 3, reps: '6-8', rest: 150 },
      { exerciseId: 'Seated_Cable_Rows', sets: 3, reps: '10-12', rest: 90 },
      { exerciseId: 'Face_Pull', sets: 3, reps: '12-15', rest: 60 },
      { exerciseId: 'Dumbbell_Shrug', sets: 3, reps: '10-12', rest: 60 },
      { exerciseId: 'Barbell_Curl', sets: 3, reps: '8-10', rest: 90 },
      { exerciseId: 'Hammer_Curls', sets: 3, reps: '10-12', rest: 60 },
    ],
  },
  {
    id: 'legs',
    name: 'Legs',
    focus: 'Quads · Hamstrings · Calves',
    exercises: [
      { exerciseId: 'Barbell_Squat', sets: 4, reps: '6-8', rest: 180 },
      { exerciseId: 'Romanian_Deadlift', sets: 3, reps: '8-10', rest: 150 },
      { exerciseId: 'Leg_Press', sets: 3, reps: '10-12', rest: 120 },
      { exerciseId: 'Lying_Leg_Curls', sets: 3, reps: '10-12', rest: 90 },
      { exerciseId: 'Leg_Extensions', sets: 3, reps: '12-15', rest: 60 },
      { exerciseId: 'Standing_Calf_Raises', sets: 4, reps: '12-15', rest: 60 },
    ],
  },
  {
    id: 'upper',
    name: 'Upper',
    focus: 'Chest · Back · Arms',
    exercises: [
      { exerciseId: 'Dumbbell_Bench_Press', sets: 3, reps: '8-10', rest: 120 },
      { exerciseId: 'Pullups', sets: 3, reps: '6-10', rest: 120 },
      { exerciseId: 'T-Bar_Row_with_Handle', sets: 3, reps: '8-10', rest: 120 },
      { exerciseId: 'Side_Lateral_Raise', sets: 3, reps: '12-15', rest: 60 },
      { exerciseId: 'Dips_-_Chest_Version', sets: 3, reps: '8-12', rest: 90 },
      { exerciseId: 'Preacher_Curl', sets: 3, reps: '10-12', rest: 60 },
    ],
  },
  {
    id: 'lower',
    name: 'Lower',
    focus: 'Glutes · Hamstrings · Core',
    exercises: [
      { exerciseId: 'Barbell_Deadlift', sets: 3, reps: '5', rest: 180 },
      { exerciseId: 'Front_Barbell_Squat', sets: 3, reps: '8', rest: 150 },
      { exerciseId: 'Barbell_Walking_Lunge', sets: 3, reps: '10 / leg', rest: 90 },
      { exerciseId: 'Barbell_Hip_Thrust', sets: 3, reps: '8-12', rest: 90 },
      { exerciseId: 'Seated_Calf_Raise', sets: 4, reps: '15', rest: 60 },
      { exerciseId: 'Hanging_Leg_Raise', sets: 3, reps: '10-15', rest: 60 },
    ],
  },
];

// Weekday (0 = Sunday) -> day id, or null for a rest day.
export const DEFAULT_WEEK: (string | null)[] = [null, 'push', 'pull', 'legs', null, 'upper', 'lower'];

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const dayById = (id: string) => DAYS.find((d) => d.id === id);
