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
    difficulty: 1,
  },
  {
    id: "b",
    category: "Movies",
    question: "B?",
    choices: ["1", "2", "3", "4"],
    answer: 2,
    difficulty: 1,
  },
  {
    id: "c",
    category: "Science",
    question: "C?",
    choices: ["1", "2", "3", "4"],
    answer: 1,
    difficulty: 1,
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
    const first = drawQuestion(session, 1, () => 0);
    const second = drawQuestion(session, 1, () => 0);
    expect(first?.category).not.toBe(second?.category);
  });

  it("does not repeat an id until the bank is empty", () => {
    const session = createTriviaSession(questions, () => 0.2);
    const seen = new Set<string>();
    for (let i = 0; i < questions.length; i += 1) {
      const next = drawQuestion(session, 1, () => 0.2);
      expect(next).not.toBeNull();
      expect(seen.has(next!.id)).toBe(false);
      seen.add(next!.id);
    }
    expect(seen.size).toBe(questions.length);
    const again = drawQuestion(session, 1, () => 0.2);
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
      expect([1, 2, 3]).toContain(question.difficulty);
    }
    const texts = QUESTIONS.map((question) => question.question.trim().toLowerCase());
    expect(new Set(texts).size, "duplicate question text").toBe(texts.length);
    for (const tier of [1, 2, 3] as const) {
      const inTier = QUESTIONS.filter((question) => question.difficulty === tier);
      expect(inTier.length, `tier ${tier}`).toBeGreaterThanOrEqual(40);
    }
  });
});

describe("difficulty by wave", () => {
  it("warms up early and bites later", async () => {
    const { tiersForWave } = await import("../src/logic/trivia");
    expect(tiersForWave(1)[0]).toBe(1);
    expect(tiersForWave(12)[0]).toBe(3);
  });

  it("draws an easy question on wave 1 and a hard one deep in a run", () => {
    const bank = QUESTIONS;
    const early = createTriviaSession(bank, () => 0.3);
    expect(drawQuestion(early, 1, () => 0.3)?.difficulty).toBe(1);
    const late = createTriviaSession(bank, () => 0.3);
    expect(drawQuestion(late, 12, () => 0.3)?.difficulty).toBe(3);
  });
});
