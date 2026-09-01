import { describe, expect, it } from "vitest";
import {
  createTriviaSession,
  drawQuestion,
  gradeAnswer,
  orderedChoices,
  shuffle,
  triviaAccuracy,
} from "../src/logic/trivia";
import type { TriviaQuestion } from "../src/types";

const questions: TriviaQuestion[] = [
  {
    id: "a",
    category: "Science",
    question: "A?",
    choices: ["1", "2", "3", "4"],
    answer: 0,
  },
  {
    id: "b",
    category: "Movies",
    question: "B?",
    choices: ["1", "2", "3", "4"],
    answer: 2,
  },
  {
    id: "c",
    category: "Science",
    question: "C?",
    choices: ["1", "2", "3", "4"],
    answer: 1,
  },
];

describe("shuffle", () => {
  it("can reverse a list with a deterministic rng", () => {
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});

describe("trivia session", () => {
  it("filters by category and grades a streak", () => {
    const session = createTriviaSession(questions, "Science", () => 0);
    expect(session.remaining.every((q) => q.category === "Science")).toBe(true);
    const first = drawQuestion(session);
    expect(first).not.toBeNull();
    const good = gradeAnswer(session, first!, first!.answer);
    expect(good.correct).toBe(true);
    expect(good.points).toBe(100);
    const second = drawQuestion(session);
    const better = gradeAnswer(session, second!, second!.answer);
    expect(better.streak).toBe(2);
    expect(better.points).toBe(125);
    expect(triviaAccuracy(session)).toBe(1);
  });

  it("breaks a streak on a miss", () => {
    const session = createTriviaSession(questions, "all", () => 0);
    const question = drawQuestion(session)!;
    gradeAnswer(session, question, question.answer);
    const miss = gradeAnswer(session, question, (question.answer + 1) % 4);
    expect(miss.correct).toBe(false);
    expect(miss.streak).toBe(0);
    expect(miss.points).toBe(0);
    expect(session.missed).toBe(1);
  });
});

describe("orderedChoices", () => {
  it("keeps the correct label after shuffling", () => {
    const question = questions[1]!;
    const drawn = orderedChoices(question, () => 0.2);
    expect(drawn.labels[drawn.answer]).toBe(question.choices[question.answer]);
    expect(new Set(drawn.labels).size).toBe(4);
  });
});
