import { describe, expect, it } from "vitest";
import {
  aabbOverlap,
  circleRectCollision,
  clamp,
  keepBallSpeed,
  paddleBounce,
  reflectVelocity,
} from "../src/logic/physics";

describe("clamp", () => {
  it("keeps values inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe("aabbOverlap", () => {
  it("detects overlapping and separate boxes", () => {
    expect(aabbOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(aabbOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 10, h: 10 })).toBe(false);
  });
});

describe("circleRectCollision", () => {
  it("returns a hit when the ball overlaps a brick", () => {
    const hit = circleRectCollision(10, 10, 6, { x: 12, y: 8, w: 20, h: 12 });
    expect(hit).not.toBeNull();
    expect(hit!.overlap).toBeGreaterThan(0);
  });

  it("misses when the ball is clear of the brick", () => {
    expect(circleRectCollision(0, 0, 4, { x: 40, y: 40, w: 10, h: 10 })).toBeNull();
  });
});

describe("reflectVelocity", () => {
  it("bounces off a horizontal surface", () => {
    const next = reflectVelocity(3, 4, 0, -1);
    expect(next.vx).toBe(3);
    expect(next.vy).toBe(-4);
  });
});

describe("paddleBounce", () => {
  it("sends the ball left, up, or right from paddle contact", () => {
    const left = paddleBounce(10, 0, 100, 10);
    const mid = paddleBounce(50, 0, 100, 10);
    const right = paddleBounce(90, 0, 100, 10);
    expect(left.vx).toBeLessThan(0);
    expect(mid.vy).toBeLessThan(0);
    expect(Math.abs(mid.vx)).toBeLessThan(2);
    expect(right.vx).toBeGreaterThan(0);
    expect(left.vy).toBeLessThan(0);
    expect(right.vy).toBeLessThan(0);
  });
});

describe("keepBallSpeed", () => {
  it("restores a target speed and avoids a flat horizontal bounce", () => {
    const next = keepBallSpeed(10, 0.1, 8);
    expect(Math.hypot(next.vx, next.vy)).toBeCloseTo(8, 5);
    expect(Math.abs(next.vy)).toBeGreaterThan(1);
  });
});
