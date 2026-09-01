import { describe, expect, it } from "vitest";
import { applyEffect, attachHooks, createWorld, launchBalls, stepWorld } from "../src/game/breaker";
import type { Brick } from "../src/types";

describe("table balls", () => {
  it("spreads the chosen number of stuck balls on the paddle", () => {
    const world = createWorld(400, 500, [], 5, 6, 3);
    expect(world.balls).toHaveLength(3);
    expect(world.balls.every((ball) => ball.stuck)).toBe(true);
    const xs = new Set(world.balls.map((ball) => Math.round(ball.x)));
    expect(xs.size).toBe(3);
  });

  it("launches every stuck ball in a fan", () => {
    const world = createWorld(400, 500, [], 5, 6, 3);
    launchBalls(world);
    expect(world.balls.every((ball) => !ball.stuck)).toBe(true);
    const angles = new Set(world.balls.map((ball) => Math.round(ball.vx * 10)));
    expect(angles.size).toBe(3);
  });
});

describe("ball rewards", () => {
  it("dumps a storm without exceeding the live cap", () => {
    const world = createWorld(400, 500, [], 5, 6, 1);
    launchBalls(world);
    applyEffect(world, { id: "ballStorm", tone: "good", headline: "x", detail: "x" }, 0);
    expect(world.balls.length).toBe(6);
    applyEffect(world, { id: "extraPair", tone: "good", headline: "x", detail: "x" }, 0);
    expect(world.lives).toBe(7);
  });
});

function brick(partial: Partial<Brick> & Pick<Brick, "id" | "x" | "kind">): Brick {
  return {
    y: 40,
    w: 40,
    h: 20,
    hp: 1,
    maxHp: 1,
    alive: true,
    ...partial,
  };
}

describe("quiz pile-up", () => {
  it("lets a chip-wall flinch numbered bricks but leaves pink questions standing", () => {
    const numbered = brick({ id: "n", x: 40, kind: "hp", hp: 2, maxHp: 2 });
    const quiz = brick({ id: "q", x: 100, kind: "quiz" });
    const world = createWorld(400, 500, [numbered, quiz], 5, 6, 1);
    const broken = applyEffect(world, { id: "chipWall", tone: "good", headline: "x", detail: "x" }, 0);
    expect(numbered.hp).toBe(1);
    expect(quiz.alive).toBe(true);
    expect(broken.some((item) => item.kind === "quiz")).toBe(false);
  });

  it("stops the rest of the frame once a quiz pauses the table", () => {
    const first = brick({ id: "q1", x: 100, kind: "quiz" });
    const second = brick({ id: "q2", x: 220, kind: "quiz" });
    const world = createWorld(400, 500, [first, second], 5, 6, 1);
    world.balls = [
      { x: 120, y: 50, r: 8, vx: 0, vy: -6, stuck: false },
      { x: 240, y: 50, r: 8, vx: 0, vy: -6, stuck: false },
    ];
    let hits = 0;
    attachHooks(world, {
      onBrickHit: (_brick, broke) => {
        if (broke) {
          hits += 1;
          world.paused = true;
        }
      },
      onBallLost: () => undefined,
      onBoardClear: () => undefined,
    });
    stepWorld(world, 0.016, 0);
    expect(hits).toBe(1);
    expect(second.alive).toBe(true);
  });
});
