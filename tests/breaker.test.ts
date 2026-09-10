import { describe, expect, it } from "vitest";
import { applyEffect, attachHooks, beginSweep, CLEANUP_SPEED, createWorld, launchBalls, stepWorld } from "../src/game/breaker";
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

describe("question leftover sweep", () => {
  it("turns the leftover numbers into one fast pierce ball and restocks without a life", () => {
    const numbered = brick({ id: "n", x: 40, kind: "hp", hp: 3, maxHp: 3 });
    const world = createWorld(400, 500, [numbered], 2, 6, 1);
    launchBalls(world, -Math.PI / 2);
    expect(beginSweep(world)).toBe(true);
    expect(world.cleanup).toBe(true);
    expect(world.balls).toHaveLength(1);
    expect(world.speed).toBeGreaterThanOrEqual(CLEANUP_SPEED);
    expect(world.fireballUntil).toBe(Number.POSITIVE_INFINITY);
    const lives = world.lives;
    world.balls[0]!.y = world.height + 40;
    stepWorld(world, 0.016, 0);
    expect(world.lives).toBe(lives);
    expect(world.balls).toHaveLength(1);
    expect(world.balls[0]!.stuck).toBe(false);
  });

  it("will not sweep while a question brick is still up", () => {
    const numbered = brick({ id: "n", x: 40, kind: "hp" });
    const quiz = brick({ id: "q", x: 100, kind: "quiz" });
    const world = createWorld(400, 500, [numbered, quiz], 2, 6, 1);
    expect(beginSweep(world)).toBe(false);
    expect(world.cleanup).toBe(false);
  });
});

describe("cannon volley", () => {
  it("fires the magazine then ends the volley without taking a life", () => {
    const world = createWorld(400, 500, [], 3, 6, 1, { mode: "cannon", magazine: 4 });
    expect(world.ammoLeft).toBe(4);
    let ended = 0;
    attachHooks(world, {
      onBrickHit: () => undefined,
      onBallLost: () => undefined,
      onBoardClear: () => undefined,
      onVolleyEnd: () => {
        ended += 1;
      },
    });
    launchBalls(world, -Math.PI / 2);
    expect(world.volleyActive).toBe(true);
    expect(world.lives).toBe(3);
    for (let i = 0; i < 400; i += 1) {
      stepWorld(world, 0.016, i * 16);
    }
    expect(ended).toBe(1);
    expect(world.lives).toBe(3);
    expect(world.balls.every((ball) => ball.y < 520)).toBe(true);
  });
});

describe("aim and release", () => {
  it("clamps aim into an upward cone and never fires downward", async () => {
    const { clampAim, AIM_UP, AIM_SPREAD } = await import("../src/game/breaker");
    expect(clampAim(AIM_UP)).toBeCloseTo(AIM_UP);
    // straight down should be pulled back to the edge of the cone
    expect(clampAim(Math.PI / 2)).toBeCloseTo(AIM_UP + AIM_SPREAD);
    for (const angle of [0, 1, -1, 2.5, -2.5, 3, -3, Math.PI]) {
      expect(Math.sin(clampAim(angle)), `angle ${angle}`).toBeLessThan(0);
    }
  });

  it("releasing an aimed shot leaves faster than an unaimed one", async () => {
    const { createWorld, launchBalls, RELEASE_BOOST } = await import("../src/game/breaker");
    const { buildLevel } = await import("../src/logic/bricks");
    const spec = {
      rows: 2, cols: 4, width: 360, height: 640,
      padding: 10, offsetY: 10, quizRatio: 0.2, minHp: 1, maxHp: 2,
    };
    const plain = createWorld(360, 640, buildLevel(spec, () => 0.5), 3, 6, 1);
    launchBalls(plain);
    const plainSpeed = Math.hypot(plain.balls[0]!.vx, plain.balls[0]!.vy);

    const aimed = createWorld(360, 640, buildLevel(spec, () => 0.5), 3, 6, 1);
    launchBalls(aimed, -Math.PI / 2);
    const aimedSpeed = Math.hypot(aimed.balls[0]!.vx, aimed.balls[0]!.vy);

    expect(aimedSpeed).toBeGreaterThan(plainSpeed);
    expect(aimedSpeed / plainSpeed).toBeCloseTo(RELEASE_BOOST, 1);
    expect(aimed.balls[0]!.stuck).toBe(false);
    expect(aimed.aim).toBeNull();
  });
});
