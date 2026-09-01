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
  /** Angle being aimed while a stuck ball is held, or null when not aiming. */
  aim: number | null;
  /** Recent ball positions, newest last, for the comet trail. */
  trail: Array<{ x: number; y: number }>;
  hooks?: BreakerHooks;
}

/** Straight up. Aim is clamped to a cone around this so you cannot fire down. */
export const AIM_UP = -Math.PI / 2;
export const AIM_SPREAD = Math.PI * 0.44;

/** Releasing a held aim fires harder than a tap ever did. */
export const RELEASE_BOOST = 1.5;

const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/** Lighten or darken a hex colour, for glaze highlights and seated shadow. */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clampByte = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  const r = clampByte(((n >> 16) & 255) * factor);
  const g = clampByte(((n >> 8) & 255) * factor);
  const b = clampByte((n & 255) * factor);
  return `rgb(${r},${g},${b})`;
}

const PADDLE = { tiny: 72, normal: 118, wide: 168 };
const MAX_LIVES = 12;

export function createWorld(
  width: number,
  height: number,
  bricks: Brick[],
  lives: number,
  speed: number,
  tableBalls = 1,
): BreakerWorld {
  const paddleW = Math.min(PADDLE.normal, width * 0.34);
  const radius = Math.max(7, width * 0.018);
  const start = Math.max(1, Math.min(3, tableBalls));
  const balls = Array.from({ length: start }, () => stuckBall(width / 2, height - 40, radius));
  const world: BreakerWorld = {
    width,
    height,
    bricks,
    balls,
    paddle: { x: width / 2 - paddleW / 2, y: height - 26, w: paddleW, h: 14 },
    lives: Math.min(MAX_LIVES, lives),
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
    aim: null,
    trail: [],
  };
  placeStuckBalls(world);
  return world;
}

function stuckBall(x: number, y: number, r: number): Ball {
  return { x, y, r, vx: 0, vy: 0, stuck: true };
}

function placeStuckBalls(world: BreakerWorld): void {
  const stuck = world.balls.filter((ball) => ball.stuck);
  if (!stuck.length) return;
  const span = Math.min(world.paddle.w * 0.62, 78);
  stuck.forEach((ball, index) => {
    const t = stuck.length === 1 ? 0.5 : index / (stuck.length - 1);
    ball.x = world.paddle.x + world.paddle.w / 2 + (t - 0.5) * span;
    ball.y = world.paddle.y - ball.r - 1;
  });
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
  placeStuckBalls(world);
}

/** Point the shot at a canvas coordinate, clamped to the upward cone. */
export function aimAt(world: BreakerWorld, x: number, y: number): number | null {
  const ball = world.balls.find((candidate) => candidate.stuck);
  if (!ball) {
    world.aim = null;
    return null;
  }
  const raw = Math.atan2(y - ball.y, x - ball.x);
  world.aim = clampAim(raw);
  return world.aim;
}

export function clampAim(angle: number): number {
  // Work in offsets from straight up so the wrap at +/-PI cannot bite.
  let offset = angle - AIM_UP;
  while (offset > Math.PI) offset -= Math.PI * 2;
  while (offset < -Math.PI) offset += Math.PI * 2;
  return AIM_UP + clamp(offset, -AIM_SPREAD, AIM_SPREAD);
}

export function clearAim(world: BreakerWorld): void {
  world.aim = null;
}

/**
 * Fire every stuck ball. With an angle the shot goes where it was aimed and
 * leaves faster, which is what makes releasing a held aim feel like a shot
 * rather than a nudge. Without one it fans out, for a keyboard launch.
 */
export function launchBalls(world: BreakerWorld, angle?: number | null): void {
  const stuck = world.balls.filter((ball) => ball.stuck);
  if (stuck.length === 0) return;
  const aimed = angle ?? world.aim;
  const speed = world.speed * (aimed === null || aimed === undefined ? 1 : RELEASE_BOOST);
  stuck.forEach((ball, index) => {
    ball.stuck = false;
    let heading: number;
    if (aimed === null || aimed === undefined) {
      const t = stuck.length === 1 ? 0.5 : index / (stuck.length - 1);
      heading = AIM_UP + (t - 0.5) * Math.PI * 0.72;
    } else {
      // A fanned spread around the aim keeps multiball from stacking one line.
      const t = stuck.length === 1 ? 0 : index / (stuck.length - 1) - 0.5;
      heading = clampAim(aimed + t * 0.32);
    }
    ball.vx = Math.cos(heading) * speed;
    ball.vy = Math.sin(heading) * speed;
  });
  world.aim = null;
}

const MAX_LIVE_BALLS = 12;

export function spawnBalls(world: BreakerWorld, count: number): void {
  const source = world.balls.find((ball) => !ball.stuck) ?? world.balls[0];
  if (!source) return;
  const room = Math.max(0, MAX_LIVE_BALLS - world.balls.length);
  const add = Math.min(count, room);
  for (let i = 0; i < add; i += 1) {
    const t = add === 1 ? 0.5 : i / (add - 1);
    const angle = -Math.PI / 2 + (t - 0.5) * Math.PI * 0.9;
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

/**
 * Enamel, not candy. Each tier is a fired-glaze colour rather than a neon, and
 * the ramp runs cool to hot as armour deepens so the wall reads at a glance.
 * Question bricks are brass because they are the thing worth hitting.
 */
export function colorForBrick(brick: Brick): string {
  if (brick.kind === "quiz") return "#e0a83a";
  if (brick.hp >= 5) return "#a8414c";
  if (brick.hp >= 4) return "#c26a3c";
  if (brick.hp >= 3) return "#c99a3a";
  if (brick.hp >= 2) return "#4c8f7d";
  return "#3f6f9e";
}

export function attachHooks(world: BreakerWorld, hooks: BreakerHooks): BreakerWorld {
  world.hooks = hooks;
  return world;
}

export function applyEffect(world: BreakerWorld, effect: Effect, now: number): Brick[] {
  const extraBroken: Brick[] = [];
  switch (effect.id) {
    case "extraLife":
      world.lives = Math.min(MAX_LIVES, world.lives + 1);
      break;
    case "extraPair":
      world.lives = Math.min(MAX_LIVES, world.lives + 2);
      break;
    case "multiball":
      spawnBalls(world, 2);
      break;
    case "tripleBall":
      spawnBalls(world, 3);
      break;
    case "ballStorm":
      spawnBalls(world, 5);
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
        if (!brick.alive || brick.kind === "quiz") continue;
        const result = hitBrick(brick);
        burst(world, brick.x + brick.w / 2, brick.y + brick.h / 2, colorForBrick(brick));
        if (result.broke) extraBroken.push(brick);
      }
      break;
    case "tinyPaddle":
      setPaddleMode(world, "tiny", now);
      break;
    case "fastBall":
      world.speed = Math.min(12, world.speed * 1.18);
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
  placeStuckBalls(world);

  world.particles = world.particles.filter((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= dt * 1.8;
    return particle.life > 0;
  });

  const lead = world.balls.find((ball) => !ball.stuck);
  if (lead) {
    world.trail.push({ x: lead.x, y: lead.y });
    if (world.trail.length > 18) world.trail.shift();
  } else if (world.trail.length > 0) {
    world.trail.shift();
  }

  const fireball = now < world.fireballUntil;
  const wobbly = now < world.wobbleUntil;

  balls: for (const ball of world.balls) {
    if (ball.stuck) continue;

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
      if (world.paused) break balls;
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
  g.addColorStop(0, "#241832");
  g.addColorStop(0.55, "#150e1c");
  g.addColorStop(1, "#0b0710");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, world.width, world.height);

  // A warm spotlight above the wall, as if the board were lit from the rig.
  const spot = ctx.createRadialGradient(
    world.width / 2, world.height * 0.06, 10,
    world.width / 2, world.height * 0.06, world.height * 0.52,
  );
  spot.addColorStop(0, "rgba(224,168,58,0.13)");
  spot.addColorStop(1, "rgba(224,168,58,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, world.width, world.height);

  for (const brick of world.bricks) {
    if (!brick.alive) continue;
    const color = colorForBrick(brick);
    const wear = 0.5 + (brick.hp / Math.max(brick.maxHp, 1)) * 0.5;
    const radius = 5;

    // Seated shadow, so the wall sits on the stage instead of floating.
    roundRect(ctx, brick.x, brick.y + 2, brick.w, brick.h, radius);
    ctx.fillStyle = "rgba(11,7,16,0.55)";
    ctx.fill();

    const glaze = ctx.createLinearGradient(0, brick.y, 0, brick.y + brick.h);
    glaze.addColorStop(0, shade(color, 1.24));
    glaze.addColorStop(0.5, color);
    glaze.addColorStop(1, shade(color, 0.7));
    roundRect(ctx, brick.x, brick.y, brick.w, brick.h, radius);
    ctx.globalAlpha = wear;
    ctx.fillStyle = glaze;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Lit top edge.
    ctx.beginPath();
    ctx.moveTo(brick.x + radius, brick.y + 1.25);
    ctx.lineTo(brick.x + brick.w - radius, brick.y + 1.25);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;

    if (brick.kind === "quiz") {
      roundRect(ctx, brick.x, brick.y, brick.w, brick.h, radius);
      ctx.strokeStyle = "rgba(246,201,100,0.85)";
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(20,12,24,0.82)";
    ctx.font =
      brick.kind === "quiz"
        ? `800 ${Math.max(13, Math.round(brick.h * 0.56))}px ${MONO}`
        : `600 ${Math.max(11, Math.round(brick.h * 0.44))}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brick.kind === "quiz" ? "?" : String(brick.hp), brick.x + brick.w / 2, brick.y + brick.h / 2 + 0.5);
  }

  // Comet trail behind the lead ball.
  world.trail.forEach((point, index) => {
    const t = (index + 1) / world.trail.length;
    ctx.globalAlpha = t * 0.5;
    ctx.fillStyle = "#f4ece1";
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(1.5, 4 * t), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Aiming line: dotted, so it reads as a plan rather than a laser.
  if (world.aim !== null) {
    const ball = world.balls.find((candidate) => candidate.stuck);
    if (ball) {
      const dx = Math.cos(world.aim);
      const dy = Math.sin(world.aim);
      // Long enough to reach the wall, and bright enough to read as a plan.
      for (let step = 1; step <= 40; step += 1) {
        const dist = step * 20;
        const x = ball.x + dx * dist;
        const y = ball.y + dy * dist;
        if (y < -10 || x < -10 || x > world.width + 10) break;
        ctx.globalAlpha = Math.max(0.22, 0.95 - step * 0.02);
        ctx.fillStyle = "#f6c964";
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, 4.2 - step * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  for (const particle of world.particles) {
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 3, 3);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = now < world.fireballUntil ? "#c26a3c" : "#4fae94";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 14;
  roundRect(ctx, world.paddle.x, world.paddle.y, world.paddle.w, world.paddle.h, 7);
  ctx.fill();
  ctx.shadowBlur = 0;

  for (const ball of world.balls) {
    ctx.beginPath();
    ctx.fillStyle = now < world.fireballUntil ? "#ff8a4a" : "#f4efe4";
    ctx.shadowColor = now < world.wobbleUntil ? "#c4525f" : "#e0a83a";
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
