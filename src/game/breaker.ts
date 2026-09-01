import { aliveBricks, hitBrick } from "../logic/bricks";
import {
  circleRectCollision,
  clamp,
  keepBallSpeed,
  paddleBounce,
  reflectVelocity,
} from "../logic/physics";
import type { Ball, Brick, Paddle } from "../types";

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
  widenUntil: number;
  particles: Particle[];
  hooks?: BreakerHooks;
}

const BASE_PADDLE = 96;

export function createWorld(
  width: number,
  height: number,
  bricks: Brick[],
  lives: number,
  speed: number,
): BreakerWorld {
  return {
    width,
    height,
    bricks,
    balls: [stuckBall(width / 2, height - 36)],
    paddle: { x: width / 2 - BASE_PADDLE / 2, y: height - 28, w: BASE_PADDLE, h: 12 },
    lives,
    speed,
    paused: false,
    cleared: false,
    widenUntil: 0,
    particles: [],
  };
}

function stuckBall(x: number, y: number): Ball {
  return { x, y, r: 7, vx: 0, vy: 0, stuck: true };
}

export function movePaddle(world: BreakerWorld, x: number): void {
  const half = world.paddle.w / 2;
  world.paddle.x = clamp(x - half, 8, world.width - world.paddle.w - 8);
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

export function addLife(world: BreakerWorld): void {
  world.lives += 1;
}

export function widenPaddle(world: BreakerWorld, now: number): void {
  world.widenUntil = now + 8000;
  world.paddle.w = 140;
}

export function smashBoard(world: BreakerWorld): Brick[] {
  const broken: Brick[] = [];
  for (const brick of world.bricks) {
    if (!brick.alive) continue;
    const result = hitBrick(brick);
    burst(world, brick.x + brick.w / 2, brick.y + brick.h / 2, colorForBrick(brick));
    if (result.broke) {
      broken.push(brick);
    }
  }
  return broken;
}

function burst(world: BreakerWorld, x: number, y: number, color: string): void {
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * 2.4,
      vy: Math.sin(angle) * 2.4,
      life: 1,
      color,
    });
  }
}

export function colorForBrick(brick: Brick): string {
  if (brick.kind === "letter") return "#ffe66d";
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

export function stepWorld(world: BreakerWorld, dt: number, now: number): void {
  if (world.paused) return;

  if (now > world.widenUntil && world.paddle.w !== BASE_PADDLE) {
    const center = world.paddle.x + world.paddle.w / 2;
    world.paddle.w = BASE_PADDLE;
    world.paddle.x = clamp(center - BASE_PADDLE / 2, 8, world.width - BASE_PADDLE - 8);
  }

  world.particles = world.particles.filter((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= dt * 1.8;
    return particle.life > 0;
  });

  for (const ball of world.balls) {
    if (ball.stuck) {
      ball.x = world.paddle.x + world.paddle.w / 2;
      ball.y = world.paddle.y - ball.r - 1;
      continue;
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
      const reflected = reflectVelocity(ball.vx, ball.vy, hit.nx, hit.ny);
      const kept = keepBallSpeed(reflected.vx, reflected.vy, world.speed);
      ball.vx = kept.vx;
      ball.vy = kept.vy;
      ball.x += hit.nx * (hit.overlap + 0.5);
      ball.y += hit.ny * (hit.overlap + 0.5);
      const result = hitBrick(brick);
      burst(world, brick.x + brick.w / 2, brick.y + brick.h / 2, colorForBrick(brick));
      world.hooks?.onBrickHit(brick, result.broke);
      break;
    }
  }

  const before = world.balls.length;
  world.balls = world.balls.filter((ball) => ball.y - ball.r < world.height + 10);
  if (world.balls.length < before) {
    world.lives -= 1;
    if (world.lives > 0 && world.balls.length === 0) {
      world.balls.push(stuckBall(world.paddle.x + world.paddle.w / 2, world.paddle.y - 8));
    }
    world.hooks?.onBallLost();
  }

  if (!world.cleared && aliveBricks(world.bricks).length === 0) {
    world.cleared = true;
    world.hooks?.onBoardClear();
  }
}

export function drawWorld(ctx: CanvasRenderingContext2D, world: BreakerWorld): void {
  ctx.clearRect(0, 0, world.width, world.height);
  const g = ctx.createLinearGradient(0, 0, 0, world.height);
  g.addColorStop(0, "#101428");
  g.addColorStop(1, "#07090f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < world.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }

  for (const brick of world.bricks) {
    if (!brick.alive) continue;
    const color = colorForBrick(brick);
    roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 5);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22 + (brick.hp / Math.max(brick.maxHp, 1)) * 0.78;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(7,9,15,0.45)";
    ctx.stroke();
    ctx.fillStyle = "#141414";
    ctx.font = "700 12px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = brick.kind === "letter" ? brick.letter ?? "?" : brick.kind === "quiz" ? "?" : String(brick.hp);
    ctx.fillText(label, brick.x + brick.w / 2, brick.y + brick.h / 2 + 0.5);
  }

  for (const particle of world.particles) {
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 3, 3);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "#5cffc3";
  ctx.shadowColor = "#5cffc3";
  ctx.shadowBlur = 12;
  roundRect(ctx, world.paddle.x, world.paddle.y, world.paddle.w, world.paddle.h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  for (const ball of world.balls) {
    ctx.beginPath();
    ctx.fillStyle = "#f4efe4";
    ctx.shadowColor = "#ffe66d";
    ctx.shadowBlur = 10;
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
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
