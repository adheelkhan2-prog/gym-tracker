// The running rest timer, kept outside the exercise screen so it survives
// moving on to the next exercise (that screen replaces the current one).
export const restCarry: { endsAt: number | null; total: number } = { endsAt: null, total: 90 };
