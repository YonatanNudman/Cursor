import type { Effect, EffectKind } from "../types";
import { assertNever } from "../types";

export interface EffectContext {
  lives: number;
  bricksAlive: number;
  ballsInPlay: number;
  alreadyWobbly: boolean;
  alreadyFireball: boolean;
}

const GOOD: Record<
  Exclude<EffectKind, "tinyPaddle" | "fastBall" | "wobblyBall" | "armorUp" | "dropRow" | "loseLife">,
  Omit<Effect, "id">
> = {
  extraLife: { tone: "good", headline: "Extra ball", detail: "One more in the pocket." },
  extraPair: { tone: "good", headline: "Two extra balls", detail: "The rack just got friendlier." },
  multiball: { tone: "good", headline: "Two on the table", detail: "Split the shot." },
  tripleBall: { tone: "good", headline: "Three on the table", detail: "Now it is a crowd." },
  ballStorm: { tone: "good", headline: "Ball storm", detail: "Five more in the air. Chaos." },
  widePaddle: { tone: "good", headline: "Paddle stretched", detail: "Catcher's mitt mode." },
  slowBall: { tone: "good", headline: "Slow-mo", detail: "The ball takes a breath." },
  fireball: { tone: "good", headline: "Fireball", detail: "It punches through bricks." },
  chipWall: { tone: "good", headline: "The wall flinches", detail: "Every brick lost a hit." },
};

const BAD: Record<
  Extract<EffectKind, "tinyPaddle" | "fastBall" | "wobblyBall" | "armorUp" | "dropRow" | "loseLife">,
  Omit<Effect, "id">
> = {
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
    case "extraPair":
    case "multiball":
    case "tripleBall":
    case "ballStorm":
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
    ? ["extraLife", "extraPair", "multiball", "widePaddle", "chipWall"]
    : ["tinyPaddle", "fastBall", "wobblyBall", "armorUp"];

  if (correct && ctx.ballsInPlay < 8) {
    pool.push("tripleBall");
    pool.push("multiball");
  }
  if (correct && ctx.ballsInPlay < 6) pool.push("ballStorm");
  if (correct && !ctx.alreadyFireball) pool.push("fireball");
  if (correct && streak >= 2) pool.push("tripleBall", "extraPair");
  if (correct && streak >= 3) pool.push("ballStorm", "ballStorm");
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

export function ballsSpawned(kind: EffectKind): number {
  switch (kind) {
    case "multiball":
      return 2;
    case "tripleBall":
      return 3;
    case "ballStorm":
      return 5;
    case "extraLife":
    case "extraPair":
    case "widePaddle":
    case "slowBall":
    case "fireball":
    case "chipWall":
    case "tinyPaddle":
    case "fastBall":
    case "wobblyBall":
    case "armorUp":
    case "dropRow":
    case "loseLife":
      return 0;
    default:
      return assertNever(kind);
  }
}
