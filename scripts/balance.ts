/**
 * Headless balance probe. Plays whole cannon runs with a simple bot so the
 * level ramp can be checked against real physics instead of arithmetic. Run
 * with `npx vite-node scripts/balance.ts`.
 */
import {
  MAX_LIVES,
  attachHooks,
  beginSweep,
  createWorld,
  launchBalls,
  restockCannon,
  stepWorld,
  type BreakerWorld,
} from "../src/game/breaker";
import { aliveBricks, buildLevel, descendBricks, liftBricks, onlyNumbersLeft, specForPlan } from "../src/logic/bricks";
import { difficulty, type DifficultyName } from "../src/logic/difficulty";
import { levelPlan } from "../src/logic/levels";
import { stakeFor } from "../src/logic/stakes";
import type { Difficulty } from "../src/types";

const WIDTH = 390;
const HEIGHT = 660;
const MAX_LEVEL = 80;

/** Aim at the lowest surviving brick, which is roughly what a human does. */
function botAim(world: BreakerWorld): number {
  const alive = aliveBricks(world.bricks);
  if (alive.length === 0) return -Math.PI / 2;
  const target =
    alive.filter((b) => b.kind !== "hp")[0] ??
    alive.reduce((best, b) => (b.y > best.y ? b : best), alive[0]!);
  const ball = world.balls.find((b) => b.stuck) ?? world.balls[0]!;
  return Math.atan2(target.y + target.h / 2 - ball.y, target.x + target.w / 2 - ball.x);
}

interface RunResult {
  level: number;
  volleys: number;
  answered: number;
  reason: string;
}

function playRun(name: DifficultyName, accuracy: number, rng: () => number): RunResult {
  const preset = difficulty(name);
  let lives = preset.lives;
  let answered = 0;
  let volleys = 0;

  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const plan = levelPlan(level, preset, WIDTH);
    let cleared = false;
    let breached = false;
    const world = attachHooks(
      createWorld(WIDTH, HEIGHT, buildLevel(specForPlan(plan, WIDTH, HEIGHT), rng), lives, 5.6 * plan.ballSpeed, 1, {
        mode: "cannon",
        magazine: plan.magazine,
      }),
      {
        onBrickHit: (brick, broke) => {
          if (!broke || brick.kind === "hp") return;
          // A question fires. The bot answers, and the stake moves lives.
          answered += 1;
          const tier = (brick.tier ?? plan.tier) as Difficulty;
          const stake = stakeFor(tier, rng() < accuracy);
          world.lives = Math.max(0, Math.min(MAX_LIVES, world.lives + stake.lives));
          if (stake.punish === "armor") {
            for (const b of world.bricks) {
              if (b.alive && b.kind === "hp") b.hp = Math.min(8, b.hp + 1);
            }
          }
        },
        onBallLost: () => undefined,
        onBoardClear: () => {
          cleared = true;
        },
        onVolleyEnd: () => {
          if (cleared) return;
          if (onlyNumbersLeft(world.bricks) && beginSweep(world)) return;
          const { reachedFloor } = descendBricks(world.bricks, world.paddle.y - 6, plan.descent);
          if (reachedFloor) {
            world.lives -= plan.descent;
            if (world.lives <= 0) {
              breached = true;
              return;
            }
            liftBricks(world.bricks, 2);
          }
          restockCannon(world, plan.magazine);
        },
      },
    );

    let guard = 0;
    while (!cleared && !breached && world.lives > 0 && guard < 90_000) {
      guard += 1;
      if (world.balls.some((b) => b.stuck) && !world.volleyActive && !world.cleanup) {
        launchBalls(world, botAim(world));
        volleys += 1;
      }
      stepWorld(world, 0.016, guard * 16);
    }

    lives = world.lives;
    if (breached) return { level, volleys, answered, reason: "wall reached the floor" };
    if (lives <= 0) return { level, volleys, answered, reason: "ran out of lives" };
    if (!cleared) return { level, volleys, answered, reason: "stalled" };
    if (preset.lifePerWave) lives = Math.min(MAX_LIVES, lives + 1);
  }
  return { level: MAX_LEVEL, volleys, answered, reason: "survived the probe" };
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function report(name: DifficultyName, accuracy: number, trials = 40): void {
  const levels: number[] = [];
  const reasons = new Map<string, number>();
  for (let trial = 0; trial < trials; trial += 1) {
    const result = playRun(name, accuracy, seeded(trial * 7919 + 13));
    levels.push(result.level);
    reasons.set(result.reason, (reasons.get(result.reason) ?? 0) + 1);
  }
  levels.sort((a, b) => a - b);
  const median = levels[Math.floor(levels.length / 2)]!;
  const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
  const capped = levels.filter((l) => l >= MAX_LEVEL).length;
  console.log(
    `${name.padEnd(7)} acc ${(accuracy * 100).toFixed(0).padStart(3)}%  ` +
      `median L${String(median).padStart(2)}  mean L${mean.toFixed(1).padStart(4)}  ` +
      `worst L${levels[0]}  best L${levels[levels.length - 1]}  ` +
      `hit cap ${capped}/${trials}  ${[...reasons].map(([r, n]) => `${r}:${n}`).join(", ")}`,
  );
}

/** Per-level probe: how many volleys a level costs, and how close the wall got. */
function perLevel(name: DifficultyName, accuracy: number, trials = 12): void {
  const preset = difficulty(name);
  console.log(`\nper-level, ${name}, accuracy ${(accuracy * 100).toFixed(0)}%`);
  console.log("lvl layout    rows mag desc cells totalHp | volleys breaches cleared");
  for (let level = 1; level <= 30; level += 1) {
    const plan = levelPlan(level, preset, WIDTH);
    let volleys = 0;
    let breaches = 0;
    let clears = 0;
    let cells = 0;
    let totalHp = 0;
    for (let trial = 0; trial < trials; trial += 1) {
      const rng = seeded(trial * 104729 + level);
      const bricks = buildLevel(specForPlan(plan, WIDTH, HEIGHT), rng);
      cells += bricks.length;
      totalHp += bricks.reduce((sum, b) => sum + b.hp, 0);
      let cleared = false;
      let dead = false;
      const world = attachHooks(
        createWorld(WIDTH, HEIGHT, bricks, MAX_LIVES, 5.6 * plan.ballSpeed, 1, {
          mode: "cannon",
          magazine: plan.magazine,
        }),
        {
          onBrickHit: () => undefined,
          onBallLost: () => undefined,
          onBoardClear: () => {
            cleared = true;
          },
          onVolleyEnd: () => {
            if (cleared) return;
            if (onlyNumbersLeft(world.bricks) && beginSweep(world)) return;
            const { reachedFloor } = descendBricks(world.bricks, world.paddle.y - 6, plan.descent);
            if (reachedFloor) {
              breaches += 1;
              world.lives -= plan.descent;
              if (world.lives <= 0) {
                dead = true;
                return;
              }
              liftBricks(world.bricks, 2);
            }
            restockCannon(world, plan.magazine);
          },
        },
      );
      let guard = 0;
      while (!cleared && !dead && guard < 90_000) {
        guard += 1;
        if (world.balls.some((b) => b.stuck) && !world.volleyActive && !world.cleanup) {
          launchBalls(world, botAim(world));
          volleys += 1;
        }
        stepWorld(world, 0.016, guard * 16);
      }
      if (cleared) clears += 1;
    }
    console.log(
      `${String(level).padStart(3)} ${plan.layout.padEnd(9)} ${String(plan.rows).padStart(4)} ` +
        `${String(plan.magazine).padStart(3)} ${String(plan.descent).padStart(4)} ` +
        `${(cells / trials).toFixed(0).padStart(5)} ${(totalHp / trials).toFixed(0).padStart(7)} | ` +
        `${(volleys / trials).toFixed(1).padStart(7)} ${(breaches / trials).toFixed(1).padStart(8)} ${clears}/${trials}`,
    );
  }
}

if (process.argv.includes("--per-level")) {
  perLevel("normal", 1);
} else {
  for (const name of ["chill", "normal", "hard", "brutal"] as DifficultyName[]) {
    for (const accuracy of [0.5, 0.7, 0.9]) {
      report(name, accuracy);
    }
  }
}
