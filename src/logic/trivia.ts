import type { TriviaCategory, TriviaQuestion } from "../types";

export interface TriviaSession {
  remaining: TriviaQuestion[];
  asked: string[];
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
  category: TriviaCategory | "all" = "all",
  rng: () => number = Math.random,
): TriviaSession {
  const pool =
    category === "all"
      ? questions
      : questions.filter((question) => question.category === category);
  return {
    remaining: shuffle(pool, rng),
    asked: [],
    streak: 0,
    correct: 0,
    missed: 0,
  };
}

export function drawQuestion(session: TriviaSession): TriviaQuestion | null {
  const question = session.remaining.shift() ?? null;
  if (question) {
    session.asked.push(question.id);
  }
  return question;
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
  const points = correct ? 100 + (session.streak - 1) * 25 : 0;
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
