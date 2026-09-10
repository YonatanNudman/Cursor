import type { Difficulty, TriviaCategory, TriviaQuestion } from "../types";
import type { QuestionFloor } from "./settings";

export interface TriviaSession {
  remaining: TriviaQuestion[];
  asked: string[];
  askedByCategory: Partial<Record<TriviaCategory, number>>;
  bank: TriviaQuestion[];
  streak: number;
  correct: number;
  missed: number;
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = next[i];
    next[i] = next[j]!;
    next[j] = temp!;
  }
  return next;
}

export function createTriviaSession(
  questions: TriviaQuestion[],
  rng: () => number = Math.random,
): TriviaSession {
  return {
    remaining: shuffle(questions, rng),
    asked: [],
    askedByCategory: {},
    bank: questions,
    streak: 0,
    correct: 0,
    missed: 0,
  };
}

/**
 * The wall gets harder every wave, so the questions should too. Early waves stay
 * on warm-ups, the middle mixes, and the deep waves stop being polite. Returning
 * a widening list rather than one tier means a thin bank still finds something.
 */
export function tiersForWave(wave: number, floor: QuestionFloor = 0): Difficulty[] {
  const auto: Difficulty[] = wave <= 2 ? [1] : wave <= 4 ? [1, 2] : wave <= 7 ? [2, 1, 3] : wave <= 10 ? [2, 3] : [3, 2];
  if (floor <= 0) return auto;
  const clipped = auto.filter((tier) => tier >= floor);
  if (clipped.length > 0) return clipped;
  const forced: Difficulty[] = [];
  if (floor <= 3) forced.push(3);
  if (floor <= 2) forced.push(2);
  if (floor <= 1) forced.push(1);
  return forced;
}

export function filterBank(
  questions: TriviaQuestion[],
  categories: TriviaCategory[],
  floor: QuestionFloor = 0,
): TriviaQuestion[] {
  let pool = categories.length > 0 ? questions.filter((question) => categories.includes(question.category)) : questions;
  if (floor > 0) {
    const floored = pool.filter((question) => question.difficulty >= floor);
    if (floored.length >= 8) pool = floored;
    else {
      const relaxed = pool.filter((question) => question.difficulty >= Math.max(1, floor - 1));
      if (relaxed.length > 0) pool = relaxed;
    }
  }
  return pool.length > 0 ? pool : questions;
}

export function drawQuestion(
  session: TriviaSession,
  wave = 1,
  rng: () => number = Math.random,
  floor: QuestionFloor = 0,
): TriviaQuestion | null {
  if (session.remaining.length === 0) {
    const unused = session.bank.filter((question) => !session.asked.includes(question.id));
    if (unused.length > 0) {
      session.remaining = shuffle(unused, rng);
    } else {
      session.asked = [];
      session.askedByCategory = {};
      session.remaining = shuffle(session.bank, rng);
    }
  }

  // Prefer the wave's tier, then fall back through the rest so the draw never
  // comes up empty just because one tier is exhausted.
  const tiers = tiersForWave(wave, floor);
  let tiered = session.remaining;
  for (const tier of tiers) {
    const match = session.remaining.filter((question) => question.difficulty === tier);
    if (match.length > 0) {
      tiered = match;
      break;
    }
  }

  const counts = session.askedByCategory;
  let best = Infinity;
  for (const question of tiered) {
    const count = counts[question.category] ?? 0;
    if (count < best) best = count;
  }
  const pool = tiered.filter((question) => (counts[question.category] ?? 0) === best);
  const pick = pool[Math.floor(rng() * pool.length)] ?? tiered[0] ?? session.remaining[0];
  if (!pick) return null;

  session.remaining = session.remaining.filter((question) => question.id !== pick.id);
  session.asked.push(pick.id);
  counts[pick.category] = (counts[pick.category] ?? 0) + 1;
  return pick;
}

export function gradeAnswer(
  session: TriviaSession,
  question: TriviaQuestion,
  choice: number,
): { correct: boolean; streak: number; points: number } {
  const correct = choice === question.answer;
  if (correct) {
    session.correct += 1;
    session.streak += 1;
  } else {
    session.missed += 1;
    session.streak = 0;
  }
  const base = question.difficulty === 3 ? 240 : question.difficulty === 2 ? 170 : 120;
  const step = 20 + question.difficulty * 15;
  const points = correct ? base + (session.streak - 1) * step : 0;
  return { correct, streak: session.streak, points };
}

export function triviaAccuracy(session: TriviaSession): number {
  const total = session.correct + session.missed;
  if (total === 0) return 0;
  return session.correct / total;
}

export function orderedChoices(
  question: TriviaQuestion,
  rng: () => number = Math.random,
): { labels: [string, string, string, string]; answer: 0 | 1 | 2 | 3 } {
  const indexed = question.choices.map((label, index) => ({ label, index }));
  const shuffled = shuffle(indexed, rng);
  const answer = shuffled.findIndex((item) => item.index === question.answer);
  return {
    labels: [shuffled[0]!.label, shuffled[1]!.label, shuffled[2]!.label, shuffled[3]!.label],
    answer: answer as 0 | 1 | 2 | 3,
  };
}

export function sectionCounts(questions: TriviaQuestion[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const question of questions) {
    counts[question.category] = (counts[question.category] ?? 0) + 1;
  }
  return counts;
}
