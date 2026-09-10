import type { Brick } from "../types";

export interface LevelSpec {
  rows: number;
  cols: number;
  width: number;
  height: number;
  padding: number;
  offsetY: number;
  quizRatio: number;
  minHp: number;
  maxHp: number;
}

export interface Rng {
  (): number;
}

function takeRandom<T>(items: T[], rng: Rng): T {
  const index = Math.floor(rng() * items.length);
  return items.splice(index, 1)[0]!;
}

export function hpForCell(row: number, rows: number, minHp: number, maxHp: number, rng: Rng): number {
  const depth = rows <= 1 ? 1 : row / (rows - 1);
  const bias = minHp + depth * (maxHp - minHp);
  const jitter = rng() < 0.28 ? 1 : 0;
  return Math.min(maxHp, Math.max(minHp, Math.round(bias + jitter)));
}

export function brickMetrics(spec: Pick<LevelSpec, "rows" | "cols" | "width" | "height" | "padding" | "offsetY">): {
  brickW: number;
  brickH: number;
  gap: number;
} {
  const gap = Math.max(4, Math.round(spec.width * 0.012));
  const brickW = (spec.width - spec.padding * 2 - gap * (spec.cols - 1)) / spec.cols;
  const brickH = Math.min(38, Math.max(22, (spec.height * 0.52 - spec.offsetY) / spec.rows - gap));
  return { brickW, brickH, gap };
}

export function buildLevel(spec: LevelSpec, rng: Rng = Math.random): Brick[] {
  const { rows, cols, padding, offsetY, quizRatio, minHp, maxHp } = spec;
  const { brickW, brickH, gap } = brickMetrics(spec);
  const bricks: Brick[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const hp = hpForCell(row, rows, minHp, maxHp, rng);
      bricks.push({
        id: `b-${row}-${col}-${Math.floor(rng() * 1e6)}`,
        x: padding + col * (brickW + gap),
        y: offsetY + row * (brickH + gap),
        w: brickW,
        h: brickH,
        hp,
        maxHp: hp,
        kind: "hp",
        alive: true,
      });
    }
  }

  const slots = [...bricks];
  const quizzes = Math.min(slots.length - 1, Math.max(3, Math.round(slots.length * quizRatio)));
  for (let i = 0; i < quizzes; i += 1) {
    const brick = takeRandom(slots, rng);
    brick.kind = "quiz";
    brick.hp = 1;
    brick.maxHp = 1;
  }

  return bricks;
}

export function hitBrick(brick: Brick): { broke: boolean; hp: number } {
  if (!brick.alive) {
    return { broke: false, hp: 0 };
  }
  brick.hp -= 1;
  if (brick.hp <= 0) {
    brick.alive = false;
    brick.hp = 0;
    return { broke: true, hp: 0 };
  }
  return { broke: false, hp: brick.hp };
}

export function aliveBricks(bricks: Brick[]): Brick[] {
  return bricks.filter((brick) => brick.alive);
}

/** True when the questions are gone and only numbered leftovers remain. */
export function onlyNumbersLeft(bricks: Brick[]): boolean {
  const alive = aliveBricks(bricks);
  return alive.length > 0 && alive.every((brick) => brick.kind === "hp");
}

export interface WavePressure {
  maxBrickHp?: number;
  rowBonus?: number;
  hpBonus?: number;
}

/**
 * The wall has to climb. Named table difficulty adds rows and hit points on
 * top of the wave ramp, and a hard question floor thickens numbered bricks
 * so a smart-ass table actually plays harder.
 */
export function waveSpec(
  wave: number,
  width: number,
  height: number,
  pressure: WavePressure = {},
  questionFloor = 0,
): LevelSpec {
  const rowBonus = pressure.rowBonus ?? 0;
  const hpBonus = pressure.hpBonus ?? 0;
  const questionBonus = questionFloor >= 3 ? 2 : questionFloor >= 2 ? 1 : 0;
  const cap = pressure.maxBrickHp ?? 5;
  const rows = Math.min(10, 5 + Math.floor((wave - 1) / 2) + rowBonus);
  const cols = width < 420 ? 6 : Math.min(10, 7 + Math.floor((wave - 1) / 3));
  return {
    rows,
    cols,
    width,
    height,
    padding: 10,
    offsetY: 10,
    quizRatio: Math.min(0.36, 0.22 + wave * 0.012),
    minHp: 1,
    maxHp: Math.min(cap, 1 + Math.ceil(wave / 2) + hpBonus + questionBonus),
  };
}

/** Classic cannon step: surviving bricks drop one row. No new bricks. */
export function descendBricks(bricks: Brick[], dangerY: number): { reachedFloor: boolean } {
  const sample = aliveBricks(bricks)[0];
  if (!sample) return { reachedFloor: false };
  const drop = sample.h + 6;
  let reachedFloor = false;
  for (const brick of bricks) {
    if (!brick.alive) continue;
    brick.y += drop;
    if (brick.y + brick.h >= dangerY) reachedFloor = true;
  }
  return { reachedFloor };
}

export function dropRow(bricks: Brick[], width: number, rng: Rng = Math.random): Brick[] {
  const sample = aliveBricks(bricks)[0];
  if (!sample) return bricks;
  const gap = 6;
  const drop = sample.h + gap;
  for (const brick of bricks) {
    if (brick.alive) brick.y += drop;
  }
  const cols = Math.max(4, Math.round((width - 20) / (sample.w + gap)));
  const brickW = sample.w;
  const added: Brick[] = [];
  for (let col = 0; col < cols; col += 1) {
    const quiz = rng() < 0.45;
    added.push({
      id: `drop-${Date.now()}-${col}`,
      x: 10 + col * (brickW + gap),
      y: 10,
      w: brickW,
      h: sample.h,
      hp: quiz ? 1 : 2,
      maxHp: quiz ? 1 : 2,
      kind: quiz ? "quiz" : "hp",
      alive: true,
    });
  }
  return [...bricks, ...added];
}

export function armorBricks(bricks: Brick[]): void {
  for (const brick of bricks) {
    if (!brick.alive) continue;
    brick.hp = Math.min(8, brick.hp + 1);
    brick.maxHp = Math.max(brick.maxHp, brick.hp);
  }
}
