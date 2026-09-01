import { describe, expect, it } from "vitest";
import {
  boardClearBonus,
  brickPoints,
  emptyScores,
  letterPoints,
  readScores,
  SCORE_KEY,
  wordClearBonus,
  writeScore,
} from "../src/logic/score";

describe("point values", () => {
  it("pays more for thick bricks and useful letters", () => {
    expect(brickPoints(1, "hp")).toBe(20);
    expect(brickPoints(3, "letter")).toBeGreaterThan(brickPoints(3, "hp"));
    expect(letterPoints(true)).toBeGreaterThan(letterPoints(false));
    expect(wordClearBonus(2, 5)).toBe(250 + 120 + 40);
    expect(boardClearBonus(3)).toBe(320);
  });
});

describe("score storage", () => {
  it("keeps the best score per mode", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };

    expect(readScores(null)).toEqual(emptyScores());
    writeScore(storage, "mix", 400);
    writeScore(storage, "mix", 120);
    writeScore(storage, "trivia", 90);
    const saved = readScores(storage);
    expect(saved.mix).toBe(400);
    expect(saved.trivia).toBe(90);
    expect(memory.get(SCORE_KEY)).toContain("400");
  });

  it("survives broken localStorage payloads", () => {
    const storage = {
      getItem: () => "{not-json",
      setItem: () => undefined,
    };
    expect(readScores(storage)).toEqual(emptyScores());
  });
});
