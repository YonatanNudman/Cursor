import type { Difficulty, TriviaCategory, TriviaQuestion } from "../types";

/** Shorthand the packs are written in, so a question fits on one line. */
export function q(
  id: string,
  category: TriviaCategory,
  question: string,
  a: string,
  b: string,
  c: string,
  d: string,
  answer: 0 | 1 | 2 | 3,
  difficulty: Difficulty = 1,
): TriviaQuestion {
  return { id, category, question, choices: [a, b, c, d], answer, difficulty };
}
