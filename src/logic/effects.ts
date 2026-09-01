import type { Effect, EffectKind } from "../types";
import { assertNever } from "../types";

export interface EffectContext {
  lives: number;
  bricksAlive: number;
  ballsInPlay: number;
  alreadyWobbly: boolean;
  alreadyFireball: boolean;
}

const GOOD: Record<Exclude<EffectKind, "tinyPaddle" | "fastBall" | "wobblyBall" | "armorUp" | "dropRow" | "loseLife">, Omit<Effect, "id">> = {
  extraLife: { tone: "good", headline: "Extra ball", detail: "Pocket another shot. Don't waste it." },
  multiball: { tone: "good", headline: "Two more balls", detail: "The table just got loud." },
  widePaddle: { tone: "good", headline: "Paddle stretched", detail: "Catcher's mitt mode. Enjoy it." },
  slowBall: { tone: "good", headline: "Slow-mo", detail: "The ball takes a breath." },
  fireball: { tone: "good", headline: "Fireball", detail: "It punches through bricks. No bounce." },
  chipWall: { tone: "good", headline: "The wall flinches", detail: "Every brick just lost a hit." },
};

const BAD: Record<Extract<EffectKind, "tinyPaddle" | "fastBall" | "wobblyBall" | "armorUp" | "dropRow" | "loseLife">, Omit<Effect, "id">> = {
  tinyPaddle: { tone: "bad", headline: "Tiny paddle", detail: "Thumbs just got a smaller job." },
  fastBall: { tone: "bad", headline: "The ball got angry", detail: "It will not wait for you." },
  wobblyBall: { tone: "bad", headline: "Wobbly ball", detail: "It drifts. Stay with it." },
  armorUp: { tone: "bad", headline: "Bricks put on coats", detail: "Every survivor gained a hit." },
  dropRow: { tone: "bad", headline: "New row incoming", detail: "The wall just grew a mouth." },
  loseLife: { tone: "bad", headline: "Ball confiscated", detail: "Wrong answers cost leather." },
};

function pack(id: EffectKind): Effect {
  switch (id) {
    case "extraLife":
    case "multiball":
    case "widePaddle":
    case "slowBall":
    case "fireball":
    case "chipWall":
      return { id, ...GOOD[id] };
    case "tinyPaddle":
    case "fastBall":
    case "wobblyBall":
    case "armorUp":
    case "dropRow":
    case "loseLife":
      return { id, ...BAD[id] };
    default:
      return assertNever(id);
  }
}

export function pickEffect(correct: boolean, streak: number, ctx: EffectContext, rng: () => number = Math.random): Effect {
  const pool: EffectKind[] = correct
    ? ["extraLife", "widePaddle", "slowBall", "chipWall"]
    : ["tinyPaddle", "fastBall", "wobblyBall", "armorUp"];

  if (correct && ctx.ballsInPlay < 3) pool.push("multiball");
  if (correct && !ctx.alreadyFireball) pool.push("fireball");
  if (correct && streak >= 3) pool.push("extraLife", "fireball", "multiball");
  if (!correct && ctx.bricksAlive > 6) pool.push("dropRow");
  if (!correct && ctx.lives > 1) pool.push("loseLife");
  if (!correct && ctx.alreadyWobbly) {
    const filtered = pool.filter((id) => id !== "wobblyBall");
    if (filtered.length) {
      return pack(filtered[Math.floor(rng() * filtered.length)]!);
    }
  }

  return pack(pool[Math.floor(rng() * pool.length)]!);
}
