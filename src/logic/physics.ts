import type { CircleRectHit, Rect } from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function aabbOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleRectCollision(
  cx: number,
  cy: number,
  radius: number,
  rect: Rect,
): CircleRectHit | null {
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq > radius * radius) {
    return null;
  }

  if (distSq === 0) {
    const left = cx - rect.x;
    const right = rect.x + rect.w - cx;
    const top = cy - rect.y;
    const bottom = rect.y + rect.h - cy;
    const nearest = Math.min(left, right, top, bottom);
    if (nearest === left) return { nx: -1, ny: 0, overlap: radius + left };
    if (nearest === right) return { nx: 1, ny: 0, overlap: radius + right };
    if (nearest === top) return { nx: 0, ny: -1, overlap: radius + top };
    return { nx: 0, ny: 1, overlap: radius + bottom };
  }

  const dist = Math.sqrt(distSq);
  return {
    nx: dx / dist,
    ny: dy / dist,
    overlap: radius - dist,
  };
}

export function reflectVelocity(
  vx: number,
  vy: number,
  nx: number,
  ny: number,
): { vx: number; vy: number } {
  const dot = vx * nx + vy * ny;
  return {
    vx: vx - 2 * dot * nx,
    vy: vy - 2 * dot * ny,
  };
}

export function paddleBounce(
  ballX: number,
  paddleX: number,
  paddleW: number,
  speed: number,
): { vx: number; vy: number } {
  const t = clamp((ballX - paddleX) / paddleW, 0, 1);
  const angle = (t - 0.5) * Math.PI * 0.72;
  return {
    vx: Math.sin(angle) * speed,
    vy: -Math.abs(Math.cos(angle) * speed),
  };
}

export function keepBallSpeed(
  vx: number,
  vy: number,
  speed: number,
): { vx: number; vy: number } {
  const current = Math.hypot(vx, vy);
  if (current === 0) {
    return { vx: 0, vy: -speed };
  }
  const scale = speed / current;
  let nextVx = vx * scale;
  let nextVy = vy * scale;
  if (Math.abs(nextVy) < speed * 0.28) {
    nextVy = Math.sign(nextVy || -1) * speed * 0.28;
    const rest = Math.sqrt(Math.max(speed * speed - nextVy * nextVy, 0));
    nextVx = Math.sign(nextVx || 1) * rest;
  }
  return { vx: nextVx, vy: nextVy };
}
