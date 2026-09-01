import { describe, expect, it } from "vitest";
import { allDifficulties, difficulty, parseDifficulty } from "../src/logic/difficulty";

describe("difficulty", () => {
  it("gets harder in every dimension as it climbs", () => {
    const order = allDifficulties();
    expect(order.map((preset) => preset.name)).toEqual(["chill", "normal", "hard", "brutal"]);
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i]!.lives).toBeLessThanOrEqual(order[i - 1]!.lives);
      expect(order[i]!.ballSpeed).toBeGreaterThan(order[i - 1]!.ballSpeed);
      expect(order[i]!.weight).toBeGreaterThan(order[i - 1]!.weight);
    }
  });

  it("only gives a ball back on the gentlest level, so a run can be lost", () => {
    expect(difficulty("chill").lifePerWave).toBe(true);
    for (const name of ["normal", "hard", "brutal"] as const) {
      expect(difficulty(name).lifePerWave, name).toBe(false);
    }
    expect(difficulty("brutal").lives).toBe(1);
  });

  it("falls back to normal on junk input", () => {
    expect(parseDifficulty("nope")).toBe("normal");
    expect(parseDifficulty(undefined)).toBe("normal");
    expect(parseDifficulty("hard")).toBe("hard");
  });
});
