import { describe, expect, it } from "vitest";
import { TIER_LABELS, TIER_LIVES, stakeFor, tierReward } from "../src/logic/stakes";

describe("stakes", () => {
  it("risks and pays the same number of lives, so the bet is honest", () => {
    for (const tier of [1, 2, 3] as const) {
      expect(stakeFor(tier, true).lives).toBe(TIER_LIVES[tier]);
      expect(stakeFor(tier, false).lives).toBe(-TIER_LIVES[tier]);
    }
  });

  it("pays more the harder the question", () => {
    expect(stakeFor(2, true).score).toBeGreaterThan(stakeFor(1, true).score);
    expect(stakeFor(3, true).score).toBeGreaterThan(stakeFor(2, true).score);
    expect(stakeFor(3, true).lives).toBeGreaterThan(stakeFor(1, true).lives);
  });

  it("pays nothing for a wrong answer, whatever the tier", () => {
    for (const tier of [1, 2, 3] as const) {
      expect(stakeFor(tier, false).score).toBe(0);
      expect(stakeFor(tier, false).tone).toBe("bad");
    }
  });

  it("stacks a streak bonus but caps it", () => {
    const plain = stakeFor(1, true, 1).score;
    expect(stakeFor(1, true, 3).score).toBeGreaterThan(plain);
    expect(stakeFor(1, true, 20).score).toBe(stakeFor(1, true, 5).score);
  });

  it("only punishes the wall on the harder misses", () => {
    expect(stakeFor(1, false).punish).toBe("none");
    expect(stakeFor(2, false).punish).toBe("armor");
    expect(stakeFor(3, false).punish).toBe("dropRow");
    for (const tier of [1, 2, 3] as const) {
      expect(stakeFor(tier, true).punish).toBe("none");
    }
  });

  it("writes the price on the tin before you answer", () => {
    expect(tierReward(1)).toBe("+1 life / -1 if wrong");
    expect(tierReward(3)).toBe("+3 lives / -3 if wrong");
    expect(TIER_LABELS[3]).toBe("Brutal");
  });
});
