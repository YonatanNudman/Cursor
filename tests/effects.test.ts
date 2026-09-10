import { describe, expect, it } from "vitest";
import { pickEffect } from "../src/logic/effects";

const base = {
  lives: 3,
  bricksAlive: 12,
  ballsInPlay: 1,
  alreadyWobbly: false,
  alreadyFireball: false,
};

describe("pickEffect", () => {
  it("only hands out good swings for a correct answer", () => {
    for (let i = 0; i < 20; i += 1) {
      const effect = pickEffect(true, 1, base, () => i / 20);
      expect(effect.tone).toBe("good");
    }
  });

  it("only hands out bad swings for a miss", () => {
    for (let i = 0; i < 20; i += 1) {
      const effect = pickEffect(false, 0, base, () => i / 20);
      expect(effect.tone).toBe("bad");
    }
  });

  it("can confiscate a ball when you still have extras", () => {
    const effect = pickEffect(false, 0, { ...base, lives: 2 }, () => 0.99);
    expect(["tinyPaddle", "fastBall", "wobblyBall", "armorUp", "dropRow", "loseLife"]).toContain(effect.id);
  });

  it("never hands cannon a paddle that does nothing", () => {
    for (let i = 0; i < 40; i += 1) {
      const good = pickEffect(true, 1, { ...base, mode: "cannon" }, () => i / 40);
      const bad = pickEffect(false, 0, { ...base, mode: "cannon" }, () => i / 40);
      expect(good.id).not.toBe("widePaddle");
      expect(bad.id).not.toBe("tinyPaddle");
    }
  });
});
