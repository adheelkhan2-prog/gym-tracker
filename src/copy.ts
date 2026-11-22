// Rotating micro-copy. Picked deterministically from a seed (usually the date),
// so a line stays put while you look at it but changes from day to day.

const pick = (lines: readonly string[], seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return lines[Math.abs(h) % lines.length];
};

export const FINISH = [
  'The bar went up. So did you.',
  'Session banked. Future you says thanks.',
  'That’s how you build a back you can’t see but everyone else can.',
  'Pump secured. Go flex in a reflective surface.',
  'Another brick in the wall. A very muscular wall.',
  'You showed up and lifted heavy things. That’s the whole job.',
  'Done. Protein first, then gloat.',
  'Your sleeves are getting nervous.',
  'Consistency is the cheat code, and you just used it.',
  'Logged, lifted, legendary-ish.',
  'Muscles: damaged. Ego: thriving. Recovery: starts now.',
  'If lifting were easy it would be called napping.',
  'One more session closer to needing bigger T-shirts.',
  'The iron doesn’t lie, and today it said “nice”.',
  'Your past self could never. (Check the numbers.)',
  'Somewhere a dumbbell is still recovering from you.',
  'Workout complete. Snack mode unlocked.',
  'That was a statement set list.',
  'Strength is a habit. Today you fed it.',
  'Clock out, refuel, come back hungrier.',
  'Gains are quiet. The log isn’t.',
  'You came, you saw, you overloaded progressively.',
] as const;

export const FINISH_PR = [
  'New records. Write them in pen.',
  'The old you just got lapped.',
  'PR day. Tell nobody, tell everybody.',
  'Personal best unlocked. Raise the bar (literally).',
  'You just moved the goalposts. Again.',
  'Records are made to be broken, and you’re on a streak.',
] as const;

export const GREETING = [
  'The bar won’t lift itself.',
  'Let’s make yesterday’s numbers look small.',
  'Chalk up. It’s go time.',
  'Today’s weights are waiting.',
  'Warm up, lock in, add a rep.',
  'Small plates, big progress.',
  'Show the iron who’s boss.',
  'One good session. That’s the plan.',
] as const;

export const REST_DAY = [
  'Muscles grow while you rest. Annoying, but true.',
  'Rest day. Eat like it’s a training day.',
  'Recovery is part of the program. Do it well.',
  'Take the day. Tomorrow you lift.',
] as const;

export const SUPPS = [
  'Creatine works if you take it. Wild, right?',
  'Small scoop, big streak.',
  'Shake, sip, done.',
  'Your muscles called. They want protein.',
] as const;

export const line = (pool: readonly string[], seed: string) => pick(pool, seed);
