import { describe, expect, it } from "vitest";
import {
  createTriviaSession,
  drawQuestion,
  gradeAnswer,
  orderedChoices,
  sectionCounts,
  shuffle,
} from "../src/logic/trivia";
import { QUESTIONS } from "../src/data/questions";
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
  it("can rotate a list with a deterministic rng", () => {
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});

describe("trivia session", () => {
  it("rotates sections instead of stacking one category", () => {
    const session = createTriviaSession(questions, () => 0);
    const first = drawQuestion(session, () => 0);
    const second = drawQuestion(session, () => 0);
    expect(first?.category).not.toBe(second?.category);
  });

  it("does not repeat an id until the bank is empty", () => {
    const session = createTriviaSession(questions, () => 0.2);
    const seen = new Set<string>();
    for (let i = 0; i < questions.length; i += 1) {
      const next = drawQuestion(session, () => 0.2);
      expect(next).not.toBeNull();
      expect(seen.has(next!.id)).toBe(false);
      seen.add(next!.id);
    }
    expect(seen.size).toBe(questions.length);
    const again = drawQuestion(session, () => 0.2);
    expect(again).not.toBeNull();
  });

  it("grades a streak and a miss", () => {
    const session = createTriviaSession(questions, () => 0);
    const first = drawQuestion(session)!;
    const good = gradeAnswer(session, first, first.answer);
    expect(good.correct).toBe(true);
    expect(good.points).toBe(120);
    const miss = gradeAnswer(session, first, (first.answer + 1) % 4);
    expect(miss.streak).toBe(0);
    expect(miss.points).toBe(0);
  });
});

describe("orderedChoices", () => {
  it("keeps the correct label after shuffling", () => {
    const question = questions[1]!;
    const drawn = orderedChoices(question, () => 0.2);
    expect(drawn.labels[drawn.answer]).toBe(question.choices[question.answer]);
  });
});

describe("question bank", () => {
  it("is large, unique, and spread across sections", () => {
    const ids = QUESTIONS.map((question) => question.id);
    expect(new Set(ids).size).toBe(QUESTIONS.length);
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(300);
    const counts = sectionCounts(QUESTIONS);
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(16);
    for (const [section, count] of Object.entries(counts)) {
      expect(count, section).toBeGreaterThanOrEqual(16);
    }
    for (const question of QUESTIONS) {
      expect(new Set(question.choices).size).toBe(4);
      expect(question.answer).toBeGreaterThanOrEqual(0);
      expect(question.answer).toBeLessThan(4);
    }
  });
});
