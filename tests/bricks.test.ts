import { describe, expect, it } from "vitest";
import { aliveBricks, armorBricks, buildLevel, dropRow, hitBrick, hpForCell, waveSpec } from "../src/logic/bricks";

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
  it("plants a thick mix of quiz bricks", () => {
    const bricks = buildLevel(
      {
        rows: 4,
        cols: 6,
        width: 600,
        height: 400,
        padding: 10,
        offsetY: 12,
        quizRatio: 0.4,
        minHp: 1,
        maxHp: 3,
      },
      cycle([0.2, 0.8, 0.1, 0.55, 0.33]),
    );
    expect(bricks).toHaveLength(24);
    const quizzes = bricks.filter((brick) => brick.kind === "quiz");
    expect(quizzes.length).toBeGreaterThanOrEqual(8);
    expect(quizzes.every((brick) => brick.hp === 1)).toBe(true);
  });
});

describe("hitBrick and armor", () => {
  it("needs multiple hits, then can be armored back up", () => {
    const brick = buildLevel(
      {
        rows: 1,
        cols: 1,
        width: 100,
        height: 80,
        padding: 0,
        offsetY: 0,
        quizRatio: 0,
        minHp: 3,
        maxHp: 3,
      },
      () => 0,
    )[0]!;
    expect(hitBrick(brick)).toEqual({ broke: false, hp: 2 });
    armorBricks([brick]);
    expect(brick.hp).toBe(3);
    expect(hitBrick(brick).broke).toBe(false);
  });
});

describe("dropRow", () => {
  it("adds a new row without killing the old wall", () => {
    const bricks = buildLevel(waveSpec(1, 390, 640), () => 0.3);
    const before = aliveBricks(bricks).length;
    const next = dropRow(bricks, 390, () => 0.2);
    expect(aliveBricks(next).length).toBeGreaterThan(before);
  });
});

describe("waveSpec", () => {
  it("gets harsher as waves climb", () => {
    const easy = waveSpec(1, 390, 640);
    const hard = waveSpec(8, 390, 640);
    expect(hard.maxHp).toBeGreaterThan(easy.maxHp);
    expect(hard.rows).toBeGreaterThan(easy.rows);
  });
});
