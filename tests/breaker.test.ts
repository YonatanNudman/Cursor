import { describe, expect, it } from "vitest";
import { applyStake, attachHooks, beginSweep, CLEANUP_SPEED, createWorld, launchBalls, MAX_LIVES, stepWorld } from "../src/game/breaker";
import { stakeFor } from "../src/logic/stakes";
import type { Brick } from "../src/types";

describe("table balls", () => {
  it("spreads the chosen number of stuck balls on the paddle", () => {
    const world = createWorld(400, 500, [], 5, 6, { startBalls: 3 });
    expect(world.balls).toHaveLength(3);
    expect(world.balls.every((ball) => ball.stuck)).toBe(true);
    const xs = new Set(world.balls.map((ball) => Math.round(ball.x)));
    expect(xs.size).toBe(3);
  });

  it("launches every stuck ball in a fan", () => {
    const world = createWorld(400, 500, [], 5, 6, { startBalls: 3 });
    launchBalls(world);
    expect(world.balls.every((ball) => !ball.stuck)).toBe(true);
    const angles = new Set(world.balls.map((ball) => Math.round(ball.vx * 10)));
    expect(angles.size).toBe(3);
  });
});

describe("question stakes", () => {
  it("pays lives for a right answer and takes them for a wrong one", () => {
    const world = createWorld(400, 500, [], 5, 6);
    applyStake(world, stakeFor(3, true));
    expect(world.lives).toBe(8);
    applyStake(world, stakeFor(2, false));
    expect(world.lives).toBe(6);
  });

  it("never banks past the life cap or below zero", () => {
    const rich = createWorld(400, 500, [], MAX_LIVES, 6);
    applyStake(rich, stakeFor(3, true));
    expect(rich.lives).toBe(MAX_LIVES);
    const broke = createWorld(400, 500, [], 1, 6);
    applyStake(broke, stakeFor(3, false));
    expect(broke.lives).toBe(0);
  });

  it("grows the wall on a brutal miss and armors it on a hard one", () => {
    const wall = [brick({ id: "n", x: 40, kind: "hp", hp: 2, maxHp: 2 })];
    const dropped = createWorld(400, 500, [...wall], 5, 6);
    const count = dropped.bricks.length;
    applyStake(dropped, stakeFor(3, false));
    expect(dropped.bricks.length).toBeGreaterThan(count);

    const armored = createWorld(400, 500, [brick({ id: "n2", x: 40, kind: "hp", hp: 2, maxHp: 2 })], 5, 6);
    applyStake(armored, stakeFor(2, false));
    expect(armored.bricks[0]!.hp).toBe(3);
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
  it("stops the rest of the frame once a quiz pauses the table", () => {
    const first = brick({ id: "q1", x: 100, kind: "quiz" });
    const second = brick({ id: "q2", x: 220, kind: "quiz" });
    const world = createWorld(400, 500, [first, second], 5, 6);
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
    const world = createWorld(400, 500, [numbered], 2, 6);
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

  it("homes at leftover numbers instead of flying up the empty middle", () => {
    const numbered = brick({ id: "n", x: 320, y: 40, kind: "hp", hp: 2, maxHp: 2 });
    const world = createWorld(400, 500, [numbered], 2, 6);
    world.balls = [{ x: 40, y: 400, r: 7, vx: 0, vy: -6, stuck: false }];
    expect(beginSweep(world)).toBe(true);
    expect(world.balls[0]!.vx).toBeGreaterThan(0);
    expect(world.balls[0]!.vy).toBeLessThan(0);
    for (let i = 0; i < 90; i += 1) stepWorld(world, 0.016, i * 16);
    expect(numbered.alive).toBe(false);
  });

  it("will not sweep while a question brick is still up", () => {
    const numbered = brick({ id: "n", x: 40, kind: "hp" });
    const quiz = brick({ id: "q", x: 100, kind: "quiz" });
    const world = createWorld(400, 500, [numbered, quiz], 2, 6);
    expect(beginSweep(world)).toBe(false);
    expect(world.cleanup).toBe(false);
  });

  it("will not sweep while a star brick is still up", () => {
    const numbered = brick({ id: "n", x: 40, kind: "hp" });
    const pick = brick({ id: "p", x: 100, kind: "pick" });
    const world = createWorld(400, 500, [numbered, pick], 2, 6);
    expect(beginSweep(world)).toBe(false);
  });

  it("refuses to chase a brick that has reached the paddle", () => {
    // The sweep ball homes at leftovers, so an unreachable one would hang it.
    const world = createWorld(400, 500, [], 2, 6);
    const sunk = brick({ id: "n", x: 40, y: world.paddle.y + 4, kind: "hp" });
    world.bricks = [sunk];
    expect(beginSweep(world)).toBe(false);
    sunk.y = 40;
    expect(beginSweep(world)).toBe(true);
  });
});

describe("wave clear", () => {
  it("does not take a life after the wall is already gone", () => {
    const world = createWorld(400, 500, [], 1, 6);
    world.cleared = true;
    world.balls = [{ x: 200, y: 520, r: 7, vx: 0, vy: 8, stuck: false }];
    let lost = 0;
    attachHooks(world, {
      onBrickHit: () => undefined,
      onBallLost: () => {
        lost += 1;
      },
      onBoardClear: () => undefined,
    });
    stepWorld(world, 0.05, 0);
    expect(world.lives).toBe(1);
    expect(lost).toBe(0);
  });
});

describe("cannon volley", () => {
  it("fires the magazine then ends the volley without taking a life", () => {
    const world = createWorld(400, 500, [], 3, 6, { mode: "cannon", magazine: 4 });
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
    } as const;
    const plain = createWorld(360, 640, buildLevel(spec, () => 0.5), 3, 6);
    launchBalls(plain);
    const plainSpeed = Math.hypot(plain.balls[0]!.vx, plain.balls[0]!.vy);

    const aimed = createWorld(360, 640, buildLevel(spec, () => 0.5), 3, 6);
    launchBalls(aimed, -Math.PI / 2);
    const aimedSpeed = Math.hypot(aimed.balls[0]!.vx, aimed.balls[0]!.vy);

    expect(aimedSpeed).toBeGreaterThan(plainSpeed);
    expect(aimedSpeed / plainSpeed).toBeCloseTo(RELEASE_BOOST, 1);
    expect(aimed.balls[0]!.stuck).toBe(false);
    expect(aimed.aim).toBeNull();
  });
});
