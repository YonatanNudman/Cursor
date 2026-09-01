import { aliveBricks, armorBricks, dropRow, hitBrick } from "../logic/bricks";
import {
  circleRectCollision,
  clamp,
  keepBallSpeed,
  paddleBounce,
  reflectVelocity,
} from "../logic/physics";
import type { Effect } from "../types";
import { assertNever, type Ball, type Brick, type Paddle } from "../types";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface BreakerHooks {
  onBrickHit: (brick: Brick, broke: boolean) => void;
  onBallLost: () => void;
  onBoardClear: () => void;
}

export type PaddleMode = "normal" | "wide" | "tiny";

export interface BreakerWorld {
  width: number;
  height: number;
  bricks: Brick[];
  balls: Ball[];
  paddle: Paddle;
  lives: number;
  speed: number;
  paused: boolean;
  cleared: boolean;
  paddleMode: PaddleMode;
  paddleUntil: number;
  fireballUntil: number;
  wobbleUntil: number;
  wobblePhase: number;
  shake: number;
  particles: Particle[];
  hooks?: BreakerHooks;
}

const PADDLE = { tiny: 72, normal: 118, wide: 168 };

export function createWorld(
  width: number,
  height: number,
  bricks: Brick[],
  lives: number,
  speed: number,
): BreakerWorld {
  const paddleW = Math.min(PADDLE.normal, width * 0.34);
  return {
    width,
    height,
    bricks,
    balls: [stuckBall(width / 2, height - 40, Math.max(7, width * 0.018))],
    paddle: { x: width / 2 - paddleW / 2, y: height - 26, w: paddleW, h: 14 },
    lives,
    speed,
    paused: false,
    cleared: false,
    paddleMode: "normal",
    paddleUntil: 0,
    fireballUntil: 0,
    wobbleUntil: 0,
    wobblePhase: 0,
    shake: 0,
    particles: [],
  };
}

function stuckBall(x: number, y: number, r: number): Ball {
  return { x, y, r, vx: 0, vy: 0, stuck: true };
}

function paddleWidth(world: BreakerWorld): number {
  const mode = world.paddleMode;
  const raw = mode === "wide" ? PADDLE.wide : mode === "tiny" ? PADDLE.tiny : PADDLE.normal;
  return Math.min(raw, world.width * (mode === "wide" ? 0.48 : mode === "tiny" ? 0.2 : 0.34));
}

function setPaddleMode(world: BreakerWorld, mode: PaddleMode, now: number): void {
  const center = world.paddle.x + world.paddle.w / 2;
  world.paddleMode = mode;
  world.paddleUntil = now + 9000;
  world.paddle.w = paddleWidth(world);
  world.paddle.x = clamp(center - world.paddle.w / 2, 6, world.width - world.paddle.w - 6);
}

export function movePaddle(world: BreakerWorld, x: number): void {
  const half = world.paddle.w / 2;
  world.paddle.x = clamp(x - half, 6, world.width - world.paddle.w - 6);
  for (const ball of world.balls) {
    if (ball.stuck) {
      ball.x = world.paddle.x + world.paddle.w / 2;
      ball.y = world.paddle.y - ball.r - 1;
    }
  }
}

export function launchBalls(world: BreakerWorld): void {
  for (const ball of world.balls) {
    if (!ball.stuck) continue;
    ball.stuck = false;
    const bounce = paddleBounce(ball.x, world.paddle.x, world.paddle.w, world.speed);
    ball.vx = bounce.vx;
    ball.vy = bounce.vy;
  }
}

export function spawnBalls(world: BreakerWorld, count: number): void {
  const source = world.balls.find((ball) => !ball.stuck) ?? world.balls[0];
  if (!source) return;
  for (let i = 0; i < count; i += 1) {
    const angle = (-0.7 + i * 0.4) * Math.PI;
    world.balls.push({
      x: source.x,
      y: source.y,
      r: source.r,
      vx: Math.cos(angle) * world.speed,
      vy: -Math.abs(Math.sin(angle) * world.speed),
      stuck: false,
    });
  }
}

export function colorForBrick(brick: Brick): string {
  if (brick.kind === "quiz") return "#ff6b9d";
  if (brick.hp >= 5) return "#ff5d5d";
  if (brick.hp >= 4) return "#ff8a4a";
  if (brick.hp >= 3) return "#ffc24b";
  if (brick.hp >= 2) return "#5ad0c6";
  return "#7ee0ff";
}

export function attachHooks(world: BreakerWorld, hooks: BreakerHooks): BreakerWorld {
  world.hooks = hooks;
  return world;
}

export function applyEffect(world: BreakerWorld, effect: Effect, now: number): Brick[] {
  const extraBroken: Brick[] = [];
  switch (effect.id) {
    case "extraLife":
      world.lives += 1;
      break;
    case "multiball":
      spawnBalls(world, 2);
      break;
    case "widePaddle":
      setPaddleMode(world, "wide", now);
      break;
    case "slowBall":
      world.speed = Math.max(3.6, world.speed * 0.78);
      rescaleBalls(world);
      break;
    case "fireball":
      world.fireballUntil = now + 8000;
      break;
    case "chipWall":
      for (const brick of world.bricks) {
        if (!brick.alive) continue;
        const result = hitBrick(brick);
        burst(world, brick.x + brick.w / 2, brick.y + brick.h / 2, colorForBrick(brick));
        if (result.broke) extraBroken.push(brick);
      }
      break;
    case "tinyPaddle":
      setPaddleMode(world, "tiny", now);
      break;
    case "fastBall":
      world.speed = Math.min(9.2, world.speed * 1.2);
      rescaleBalls(world);
      break;
    case "wobblyBall":
      world.wobbleUntil = now + 8000;
      break;
    case "armorUp":
      armorBricks(world.bricks);
      break;
    case "dropRow":
      world.bricks = dropRow(world.bricks, world.width);
      break;
    case "loseLife":
      world.lives = Math.max(0, world.lives - 1);
      break;
    default:
      assertNever(effect.id);
  }
  world.shake = effect.tone === "bad" ? 10 : 6;
  return extraBroken;
}

function rescaleBalls(world: BreakerWorld): void {
  for (const ball of world.balls) {
    if (ball.stuck) continue;
    const kept = keepBallSpeed(ball.vx, ball.vy, world.speed);
    ball.vx = kept.vx;
    ball.vy = kept.vy;
  }
}

function burst(world: BreakerWorld, x: number, y: number, color: string): void {
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * 2.8,
      vy: Math.sin(angle) * 2.8,
      life: 1,
      color,
    });
  }
}

export function stepWorld(world: BreakerWorld, dt: number, now: number): void {
  if (world.paused) return;

  if (now > world.paddleUntil && world.paddleMode !== "normal") {
    setPaddleMode(world, "normal", now);
    world.paddleUntil = 0;
  }

  world.shake = Math.max(0, world.shake - dt * 28);
  world.wobblePhase += dt * 10;

  world.particles = world.particles.filter((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= dt * 1.8;
    return particle.life > 0;
  });

  const fireball = now < world.fireballUntil;
  const wobbly = now < world.wobbleUntil;

  for (const ball of world.balls) {
    if (ball.stuck) {
      ball.x = world.paddle.x + world.paddle.w / 2;
      ball.y = world.paddle.y - ball.r - 1;
      continue;
    }

    if (wobbly) {
      ball.vx += Math.sin(world.wobblePhase + ball.x * 0.02) * 0.18;
    }

    ball.x += ball.vx * dt * 60;
    ball.y += ball.vy * dt * 60;

    if (ball.x - ball.r <= 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.r >= world.width) {
      ball.x = world.width - ball.r;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
    }

    const paddleHit = circleRectCollision(ball.x, ball.y, ball.r, world.paddle);
    if (paddleHit && ball.vy > 0) {
      const bounced = paddleBounce(ball.x, world.paddle.x, world.paddle.w, world.speed);
      ball.vx = bounced.vx;
      ball.vy = bounced.vy;
      ball.y = world.paddle.y - ball.r - 1;
    }

    for (const brick of world.bricks) {
      if (!brick.alive) continue;
      const hit = circleRectCollision(ball.x, ball.y, ball.r, brick);
      if (!hit) continue;
      if (!fireball) {
        const reflected = reflectVelocity(ball.vx, ball.vy, hit.nx, hit.ny);
        const kept = keepBallSpeed(reflected.vx, reflected.vy, world.speed);
        ball.vx = kept.vx;
        ball.vy = kept.vy;
        ball.x += hit.nx * (hit.overlap + 0.5);
        ball.y += hit.ny * (hit.overlap + 0.5);
      } else {
        ball.x += ball.vx * 0.15;
        ball.y += ball.vy * 0.15;
      }
      const result = hitBrick(brick);
      burst(world, brick.x + brick.w / 2, brick.y + brick.h / 2, colorForBrick(brick));
      world.hooks?.onBrickHit(brick, result.broke);
      if (!fireball) break;
    }
  }

  const before = world.balls.length;
  world.balls = world.balls.filter((ball) => ball.y - ball.r < world.height + 12);
  if (world.balls.length < before && world.balls.length === 0) {
    world.lives -= 1;
    if (world.lives > 0) {
      world.balls.push(stuckBall(world.paddle.x + world.paddle.w / 2, world.paddle.y - 8, 7));
    }
    world.hooks?.onBallLost();
  }

  if (!world.cleared && aliveBricks(world.bricks).length === 0) {
    world.cleared = true;
    world.hooks?.onBoardClear();
  }
}

export function drawWorld(ctx: CanvasRenderingContext2D, world: BreakerWorld, now: number): void {
  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  ctx.clearRect(-20, -20, world.width + 40, world.height + 40);
  const g = ctx.createLinearGradient(0, 0, 0, world.height);
  g.addColorStop(0, "#101428");
  g.addColorStop(1, "#07090f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  for (let x = 0; x < world.width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }

  for (const brick of world.bricks) {
    if (!brick.alive) continue;
    const color = colorForBrick(brick);
    roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 6);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.28 + (brick.hp / Math.max(brick.maxHp, 1)) * 0.72;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(7,9,15,0.4)";
    ctx.stroke();
    ctx.fillStyle = "#141414";
    ctx.font = `700 ${Math.max(11, Math.round(brick.h * 0.48))}px 'IBM Plex Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brick.kind === "quiz" ? "?" : String(brick.hp), brick.x + brick.w / 2, brick.y + brick.h / 2 + 0.5);
  }

  for (const particle of world.particles) {
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 3, 3);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = now < world.fireballUntil ? "#ff8a4a" : "#5cffc3";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 14;
  roundRect(ctx, world.paddle.x, world.paddle.y, world.paddle.w, world.paddle.h, 7);
  ctx.fill();
  ctx.shadowBlur = 0;

  for (const ball of world.balls) {
    ctx.beginPath();
    ctx.fillStyle = now < world.fireballUntil ? "#ff8a4a" : "#f4efe4";
    ctx.shadowColor = now < world.wobbleUntil ? "#ff6b9d" : "#ffe66d";
    ctx.shadowBlur = 12;
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
