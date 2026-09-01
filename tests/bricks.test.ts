import { describe, expect, it } from "vitest";
import { aliveBricks, buildLevel, hitBrick, hpForCell, stageForCircuit } from "../src/logic/bricks";
import { uniqueLetters } from "../src/logic/word";

function cycle(values: number[]): () => number {
  let i = 0;
  return () => {
    const value = values[i % values.length]!;
    i += 1;
    return value;
  };
}

describe("hpForCell", () => {
  it("keeps hit points inside the requested band", () => {
    const rng = cycle([0.1, 0.9, 0.4]);
    for (let row = 0; row < 5; row += 1) {
      const hp = hpForCell(row, 5, 1, 4, rng);
      expect(hp).toBeGreaterThanOrEqual(1);
      expect(hp).toBeLessThanOrEqual(4);
    }
  });
});

describe("buildLevel", () => {
  it("places every word letter, decoys, and quiz bricks", () => {
    const bricks = buildLevel(
      {
        rows: 4,
        cols: 6,
        width: 600,
        height: 400,
        padding: 10,
        offsetY: 12,
        word: "MARS",
        quizCount: 2,
        minHp: 1,
        maxHp: 3,
        decoys: 3,
      },
      cycle([0.2, 0.8, 0.1, 0.55, 0.33]),
    );

    expect(bricks).toHaveLength(24);
    const letters = bricks.filter((brick) => brick.kind === "letter").map((brick) => brick.letter);
    for (const needed of uniqueLetters("MARS")) {
      expect(letters).toContain(needed);
    }
    expect(letters.length).toBe(7);
    expect(bricks.filter((brick) => brick.kind === "quiz")).toHaveLength(2);
    expect(bricks.every((brick) => brick.alive && brick.hp >= 1)).toBe(true);
  });
});

describe("hitBrick", () => {
  it("needs multiple hits on a thick brick and then removes it", () => {
    const brick = buildLevel(
      {
        rows: 1,
        cols: 1,
        width: 100,
        height: 80,
        padding: 0,
        offsetY: 0,
        word: "",
        quizCount: 0,
        minHp: 3,
        maxHp: 3,
        decoys: 0,
      },
      () => 0,
    )[0]!;

    expect(hitBrick(brick)).toEqual({ broke: false, hp: 2 });
    expect(hitBrick(brick)).toEqual({ broke: false, hp: 1 });
    expect(hitBrick(brick)).toEqual({ broke: true, hp: 0 });
    expect(brick.alive).toBe(false);
    expect(aliveBricks([brick])).toEqual([]);
  });
});

describe("stageForCircuit", () => {
  it("gets harsher as the circuit climbs", () => {
    const easy = stageForCircuit(1);
    const hard = stageForCircuit(5);
    expect(hard.maxHp).toBeGreaterThan(easy.maxHp);
    expect(hard.rows).toBeGreaterThan(easy.rows);
    expect(hard.difficulty).toBe(3);
  });
});
