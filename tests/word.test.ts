import { describe, expect, it } from "vitest";
import {
  createPuzzle,
  displayWord,
  guessLetter,
  pickWord,
  remainingLetters,
  uniqueLetters,
} from "../src/logic/word";
import type { WordEntry } from "../src/types";

describe("uniqueLetters", () => {
  it("skips spaces and repeats", () => {
    expect(uniqueLetters("Star Wars")).toEqual(["S", "T", "A", "R", "W"]);
  });
});

describe("guessLetter", () => {
  it("fills a simple word and reports a win", () => {
    const puzzle = createPuzzle({ word: "CAB", category: "Play", difficulty: 1 }, 3);
    expect(displayWord(puzzle)).toBe("___");
    expect(guessLetter(puzzle, "c").hit).toBe(true);
    expect(displayWord(puzzle)).toBe("C__");
    expect(guessLetter(puzzle, "c").already).toBe(true);
    guessLetter(puzzle, "A");
    const last = guessLetter(puzzle, "B");
    expect(last.won).toBe(true);
    expect(remainingLetters(puzzle)).toEqual([]);
  });

  it("loses after too many misses", () => {
    const puzzle = createPuzzle({ word: "CAB", category: "Play", difficulty: 1 }, 1);
    const miss = guessLetter(puzzle, "Z");
    expect(miss.hit).toBe(false);
    expect(miss.lost).toBe(true);
  });

  it("keeps spaces visible in phrases", () => {
    const puzzle = createPuzzle({ word: "Star Wars", category: "Movies", difficulty: 3 }, 6);
    expect(displayWord(puzzle)).toBe("____ ____");
    guessLetter(puzzle, "S");
    expect(displayWord(puzzle)).toBe("S___ ___S");
  });
});

describe("pickWord", () => {
  it("stays inside the requested difficulty when possible", () => {
    const words: WordEntry[] = [
      { word: "AA", category: "A", difficulty: 1 },
      { word: "BBB", category: "B", difficulty: 2 },
    ];
    const picked = pickWord(words, 2, () => 0);
    expect(picked.difficulty).toBe(2);
  });
});
