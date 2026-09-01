import { describe, expect, it } from "vitest";
import { applyEffect, createWorld, launchBalls } from "../src/game/breaker";

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
