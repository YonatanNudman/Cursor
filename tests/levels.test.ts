import { describe, expect, it } from "vitest";
import { difficulty } from "../src/logic/difficulty";
import {
  BOSS_LAYOUTS,
  LAYOUTS,
  MIN_MAGAZINE,
  isBossLevel,
  layoutFor,
  levelBonus,
  levelBrief,
  levelName,
  levelPlan,
  tierFor,
} from "../src/logic/levels";

const normal = difficulty("normal");

describe("level names", () => {
  it("names every level and starts naming laps once the list runs out", () => {
    expect(levelName(1)).toBe("Warm Up");
    expect(levelName(11)).toBe("Warm Up 2");
    expect(levelName(21)).toBe("Warm Up 3");
  });
});

describe("level shapes", () => {
  it("changes layout every level so two in a row never match", () => {
    for (let level = 1; level < 40; level += 1) {
      expect(layoutFor(level), `level ${level}`).not.toBe(layoutFor(level + 1));
    }
  });

  it("uses the whole layout list across the first lap", () => {
    const seen = new Set(Array.from({ length: LAYOUTS.length }, (_, i) => layoutFor(i + 1)));
    expect(seen.size).toBeGreaterThanOrEqual(LAYOUTS.length - BOSS_LAYOUTS.length);
  });

  it("puts a solid boss wall on every fifth level", () => {
    expect(isBossLevel(5)).toBe(true);
    expect(isBossLevel(10)).toBe(true);
    expect(isBossLevel(4)).toBe(false);
    for (const level of [5, 10, 15, 20]) {
      expect(BOSS_LAYOUTS).toContain(layoutFor(level));
      expect(levelPlan(level, normal).boss).toBe(true);
    }
  });
});

describe("the ramp", () => {
  it("gets strictly harder to survive as levels climb", () => {
    const early = levelPlan(1, normal);
    const mid = levelPlan(7, normal);
    const late = levelPlan(14, normal);
    expect(mid.rows).toBeGreaterThan(early.rows);
    expect(late.rows).toBeGreaterThanOrEqual(mid.rows);
    expect(late.maxHp).toBeGreaterThan(early.maxHp);
    expect(late.ballSpeed).toBeGreaterThan(early.ballSpeed);
    expect(late.descent).toBeGreaterThan(early.descent);
  });

  it("shrinks the magazine while the wall thickens, which is what ends a run", () => {
    let previous = levelPlan(1, normal).magazine;
    for (let level = 2; level <= 12; level += 1) {
      const next = levelPlan(level, normal).magazine;
      expect(next, `level ${level}`).toBeLessThanOrEqual(previous);
      previous = next;
    }
    expect(levelPlan(30, normal).magazine).toBe(MIN_MAGAZINE);
  });

  it("never asks for a wall the board cannot hold", () => {
    for (let level = 1; level <= 40; level += 1) {
      const plan = levelPlan(level, difficulty("brutal"));
      expect(plan.rows).toBeLessThanOrEqual(10);
      expect(plan.cols).toBeGreaterThanOrEqual(6);
      expect(plan.maxHp).toBeGreaterThanOrEqual(plan.minHp);
      expect(plan.magazine).toBeGreaterThanOrEqual(MIN_MAGAZINE);
      expect(plan.quizRatio).toBeLessThanOrEqual(0.38);
    }
  });

  it("hands a boss a thicker wall and less ammo than its neighbour", () => {
    const boss = levelPlan(10, normal);
    const plain = levelPlan(9, normal);
    expect(boss.maxHp).toBeGreaterThan(plain.maxHp);
    expect(boss.magazine).toBeLessThan(plain.magazine);
    expect(boss.picks).toBeGreaterThan(plain.picks);
  });

  it("moves the question tier up as the run goes on", () => {
    expect(tierFor(1)).toBe(1);
    expect(tierFor(5)).toBe(2);
    expect(tierFor(12)).toBe(3);
  });

  it("gives a narrow phone fewer columns than a wide one", () => {
    expect(levelPlan(9, normal, 390).cols).toBeLessThan(levelPlan(9, normal, 900).cols);
  });
});

describe("payouts", () => {
  it("pays more for depth, for spare lives, and double for a boss", () => {
    expect(levelBonus(levelPlan(6, normal), 1)).toBeGreaterThan(levelBonus(levelPlan(2, normal), 1));
    expect(levelBonus(levelPlan(2, normal), 5)).toBeGreaterThan(levelBonus(levelPlan(2, normal), 1));
    expect(levelBonus(levelPlan(5, normal), 2)).toBeGreaterThan(2 * levelBonus(levelPlan(4, normal), 2) * 0.9);
  });

  it("warns about a boss in the level brief", () => {
    expect(levelBrief(levelPlan(5, normal))).toContain("Boss");
    expect(levelBrief(levelPlan(4, normal))).toContain("rows");
  });
});
