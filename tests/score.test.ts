import { describe, expect, it } from "vitest";
import { brickPoints, formatScore, waveClearBonus } from "../src/logic/score";
import { preferFresh, readBest, readSeen, rememberSeen, writeBest } from "../src/logic/seen";

describe("points", () => {
  it("pays quiz bricks and later waves more", () => {
    expect(brickPoints(2, "quiz")).toBeGreaterThan(brickPoints(2, "hp"));
    expect(waveClearBonus(3, 2)).toBeGreaterThan(waveClearBonus(1, 2));
    expect(formatScore(1200)).toBe("1,200");
  });
});

describe("seen store", () => {
  it("keeps recent ids and prefers fresh questions", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    rememberSeen(storage, ["a", "b"]);
    expect(readSeen(storage)).toEqual(["a", "b"]);
    const pool = [{ id: "a" }, { id: "c" }, { id: "d" }];
    const fresh = preferFresh(pool, readSeen(storage));
    expect(fresh.map((item) => item.id)).toEqual(["c", "d", "a"]);
  });

  it("keeps the best score", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    writeBest(storage, 40);
    writeBest(storage, 12);
    expect(readBest(storage)).toBe(40);
  });
});

describe("streak rewards", () => {
  it("climbs in steps and resets clean", async () => {
    const { streakMultiplier, streakLabel, isMilestone } = await import("../src/logic/score");
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(3)).toBe(2);
    expect(streakMultiplier(5)).toBe(3);
    expect(streakMultiplier(8)).toBe(4);
    expect(streakLabel(0)).toBe("");
    expect(streakLabel(5)).toBe("ON FIRE");
    expect(isMilestone(3)).toBe(true);
    expect(isMilestone(4)).toBe(false);
    expect(isMilestone(10)).toBe(true);
  });
});
