import type { Difficulty, TriviaCategory, TriviaQuestion } from "../types";

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
export function tiersForWave(wave: number): Difficulty[] {
  if (wave <= 2) return [1];
  if (wave <= 4) return [1, 2];
  if (wave <= 7) return [2, 1, 3];
  if (wave <= 10) return [2, 3];
  return [3, 2];
}

export function drawQuestion(
  session: TriviaSession,
  wave = 1,
  rng: () => number = Math.random,
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
  const tiers = tiersForWave(wave);
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
  const points = correct ? 120 + (session.streak - 1) * 35 : 0;
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
