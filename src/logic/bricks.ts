import type { Layout, LevelPlan } from "./levels";
import { TRIVIA_CATEGORIES, assertNever, type Brick, type Difficulty, type TriviaCategory } from "../types";

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
  /** Which grid cells carry a brick. Defaults to a solid wall. */
  layout?: Layout;
  /** Baseline question tier for this wall. */
  tier?: Difficulty;
  /** Choose-your-own-question bricks to plant. */
  picks?: number;
  /** Subjects this wall may paint onto its question bricks. */
  categories?: readonly TriviaCategory[];
}

export interface Rng {
  (): number;
}

function takeRandom<T>(items: T[], rng: Rng): T {
  const index = Math.floor(rng() * items.length) % items.length;
  return items.splice(Math.max(0, index), 1)[0]!;
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

/**
 * The shape of the wall. Every layout carves the same grid a different way,
 * which is the whole reason level 6 does not look like level 2.
 */
export function cellFilled(layout: Layout, row: number, col: number, rows: number, cols: number): boolean {
  const midCol = (cols - 1) / 2;
  const midRow = (rows - 1) / 2;
  switch (layout) {
    case "wall":
      return true;
    case "pyramid": {
      const span = Math.ceil(((row + 1) / rows) * cols);
      return Math.abs(col - midCol) <= span / 2;
    }
    case "checker":
      return row === 0 || (row + col) % 2 === 0;
    case "columns":
      return col % 3 !== 1;
    case "arch": {
      const doorway = ((row + 1) / rows) * cols * 0.34;
      return Math.abs(col - midCol) > doorway - 0.5;
    }
    case "diamond":
      return (
        Math.abs(col - midCol) / Math.max(1, cols / 2) +
          Math.abs(row - midRow) / Math.max(1, rows / 2) <=
        1.02
      );
    case "tunnel":
      return rows < 3 || row !== Math.floor(midRow);
    case "split":
      return Math.abs(col - midCol) > (cols >= 8 ? 1 : 0.6);
    case "spine":
      return row % 2 === 0 || Math.abs(col - midCol) < 1;
    case "crown":
      return row < rows - 1 || col % 2 === 0;
    case "fortress":
      // Near-solid, with one bolt-hole in each bottom corner.
      return !(row === rows - 1 && (col === 0 || col === cols - 1));
    case "vault":
      // A lattice of small windows you have to thread.
      return row % 2 === 0 || col % 2 === 0;
    case "gauntlet":
      // Thick frame, hollow middle. The ball has to come back out.
      return row === 0 || row === rows - 1 || col <= 1 || col >= cols - 2;
    default:
      return assertNever(layout);
  }
}

/** Deeper rows ask harder questions, so the wall reads as a gradient. */
function tierBag(base: Difficulty): Difficulty[] {
  if (base === 1) return [1, 1, 1, 2];
  if (base === 2) return [1, 2, 2, 3];
  return [2, 3, 3, 3];
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const bag = [...items];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  return bag;
}

/** Hands out subjects without repeating one until the whole pool is used. */
function categoryDealer(pool: readonly TriviaCategory[], rng: Rng): () => TriviaCategory {
  const source = pool.length > 0 ? pool : TRIVIA_CATEGORIES;
  let bag: TriviaCategory[] = [];
  return () => {
    if (bag.length === 0) bag = shuffled(source, rng);
    return bag.pop() ?? "General";
  };
}

export function buildLevel(spec: LevelSpec, rng: Rng = Math.random): Brick[] {
  const { rows, cols, padding, offsetY, quizRatio, minHp, maxHp } = spec;
  const { brickW, brickH, gap } = brickMetrics(spec);
  const layout = spec.layout ?? "wall";
  const bricks: Brick[] = [];
  const rowOf = new Map<string, number>();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!cellFilled(layout, row, col, rows, cols)) continue;
      const hp = hpForCell(row, rows, minHp, maxHp, rng);
      const id = `b-${row}-${col}-${Math.floor(rng() * 1e6)}`;
      rowOf.set(id, row);
      bricks.push({
        id,
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

  if (bricks.length === 0) {
    return buildLevel({ ...spec, layout: "wall" }, rng);
  }

  const bag = tierBag(spec.tier ?? 1);
  const dealCategory = categoryDealer(spec.categories ?? TRIVIA_CATEGORIES, rng);
  const slots = [...bricks];

  const picks = Math.min(Math.max(0, spec.picks ?? 0), Math.max(0, slots.length - 2));
  for (let i = 0; i < picks; i += 1) {
    const brick = takeRandom(slots, rng);
    brick.kind = "pick";
    brick.hp = 1;
    brick.maxHp = 1;
  }

  const quizzes = Math.min(slots.length - 1, Math.max(3, Math.round(bricks.length * quizRatio)));
  for (let i = 0; i < quizzes; i += 1) {
    if (slots.length === 0) break;
    const brick = takeRandom(slots, rng);
    const row = rowOf.get(brick.id) ?? 0;
    const drawn = bag[Math.floor(rng() * bag.length) % bag.length] ?? 1;
    const deep = row < rows / 3;
    brick.kind = "quiz";
    brick.hp = 1;
    brick.maxHp = 1;
    brick.tier = deep ? (Math.min(3, drawn + 1) as Difficulty) : drawn;
    brick.category = dealCategory();
  }

  return bricks;
}

/** How much of the grid a layout actually fills, from 0 to 1. */
export function layoutFill(layout: Layout, rows: number, cols: number): number {
  let filled = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (cellFilled(layout, row, col, rows, cols)) filled += 1;
    }
  }
  return filled / Math.max(1, rows * cols);
}

/** The density a level plan's hit-point band is written against. */
const REFERENCE_FILL = 0.7;

/**
 * Turns a level plan into the grid the builder wants. Hit points are scaled
 * against how much of the grid the shape fills, because a solid fortress has
 * nearly twice the bricks of a checker. Without this the layout, not the level,
 * would decide how hard a wall is.
 */
export function specForPlan(
  plan: LevelPlan,
  width: number,
  height: number,
  categories: readonly TriviaCategory[] = TRIVIA_CATEGORIES,
): LevelSpec {
  const fill = layoutFill(plan.layout, plan.rows, plan.cols);
  const scale = REFERENCE_FILL / Math.max(0.3, fill);
  const minHp = Math.max(1, Math.min(8, Math.round(plan.minHp * scale)));
  const maxHp = Math.max(minHp, Math.min(8, Math.round(plan.maxHp * scale)));
  return {
    rows: plan.rows,
    cols: plan.cols,
    width,
    height,
    padding: 10,
    offsetY: 10,
    quizRatio: plan.quizRatio,
    minHp,
    maxHp,
    layout: plan.layout,
    tier: plan.tier,
    picks: plan.picks,
    categories,
  };
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

/**
 * Classic cannon step: surviving bricks drop. No new bricks.
 *
 * The wall parks against the danger line rather than sliding through it. A
 * brick below the paddle can never be hit, so letting the wall keep falling
 * would leave unreachable bricks and a level that can never end.
 */
export function descendBricks(bricks: Brick[], dangerY: number, rowsDropped = 1): { reachedFloor: boolean } {
  const alive = aliveBricks(bricks);
  const sample = alive[0];
  if (!sample) return { reachedFloor: false };
  const want = (sample.h + 6) * Math.max(1, rowsDropped);
  const lowest = Math.max(...alive.map((brick) => brick.y + brick.h));
  const drop = Math.min(want, Math.max(0, dangerY - lowest));
  for (const brick of bricks) {
    if (brick.alive) brick.y += drop;
  }
  return { reachedFloor: drop < want || lowest + drop >= dangerY };
}

/** Shoves the whole wall back up, which is what a spent life buys you. */
export function liftBricks(bricks: Brick[], rows: number): void {
  const sample = aliveBricks(bricks)[0];
  if (!sample) return;
  const lift = (sample.h + 6) * Math.max(1, rows);
  for (const brick of bricks) {
    if (!brick.alive) continue;
    brick.y = Math.max(10, brick.y - lift);
  }
}

export function dropRow(
  bricks: Brick[],
  width: number,
  rng: Rng = Math.random,
  tier: Difficulty = 1,
  categories: readonly TriviaCategory[] = TRIVIA_CATEGORIES,
): Brick[] {
  const sample = aliveBricks(bricks)[0];
  if (!sample) return bricks;
  const gap = 6;
  const drop = sample.h + gap;
  for (const brick of bricks) {
    if (brick.alive) brick.y += drop;
  }
  const cols = Math.max(4, Math.round((width - 20) / (sample.w + gap)));
  const brickW = sample.w;
  const dealCategory = categoryDealer(categories, rng);
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
      ...(quiz ? { tier, category: dealCategory() } : {}),
    });
  }
  return [...bricks, ...added];
}

export function armorBricks(bricks: Brick[]): void {
  for (const brick of bricks) {
    if (!brick.alive || brick.kind !== "hp") continue;
    brick.hp = Math.min(8, brick.hp + 1);
    brick.maxHp = Math.max(brick.maxHp, brick.hp);
  }
}
