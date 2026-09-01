import type { Brick } from "../types";
import { uniqueLetters } from "./word";

export interface LevelSpec {
  rows: number;
  cols: number;
  width: number;
  height: number;
  padding: number;
  offsetY: number;
  word: string;
  quizCount: number;
  minHp: number;
  maxHp: number;
  decoys: number;
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

export function buildLevel(spec: LevelSpec, rng: Rng = Math.random): Brick[] {
  const { rows, cols, width, height, padding, offsetY, word, quizCount, minHp, maxHp, decoys } = spec;
  const gap = 6;
  const brickW = (width - padding * 2 - gap * (cols - 1)) / cols;
  const brickH = Math.min(28, (height * 0.42 - offsetY) / rows - gap);
  const bricks: Brick[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const hp = hpForCell(row, rows, minHp, maxHp, rng);
      bricks.push({
        id: `b-${row}-${col}`,
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
  const needed = uniqueLetters(word);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const decoyPool = alphabet.filter((letter) => !needed.includes(letter));
  const lettersToPlace = [
    ...needed,
    ...Array.from({ length: Math.min(decoys, decoyPool.length) }, () => takeRandom(decoyPool, rng)),
  ];

  for (const letter of lettersToPlace) {
    if (slots.length === 0) break;
    const brick = takeRandom(slots, rng);
    brick.kind = "letter";
    brick.letter = letter;
    brick.hp = Math.max(1, Math.min(brick.hp, 2));
    brick.maxHp = brick.hp;
  }

  const quizzes = Math.min(quizCount, slots.length);
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

export function stageForCircuit(level: number): {
  difficulty: 1 | 2 | 3;
  lives: number;
  rows: number;
  cols: number;
  quizCount: number;
  minHp: number;
  maxHp: number;
  decoys: number;
} {
  if (level <= 1) {
    return { difficulty: 1, lives: 4, rows: 4, cols: 8, quizCount: 2, minHp: 1, maxHp: 2, decoys: 3 };
  }
  if (level === 2) {
    return { difficulty: 1, lives: 4, rows: 5, cols: 9, quizCount: 3, minHp: 1, maxHp: 3, decoys: 4 };
  }
  if (level === 3) {
    return { difficulty: 2, lives: 3, rows: 5, cols: 10, quizCount: 3, minHp: 2, maxHp: 3, decoys: 5 };
  }
  if (level === 4) {
    return { difficulty: 2, lives: 3, rows: 6, cols: 10, quizCount: 4, minHp: 2, maxHp: 4, decoys: 5 };
  }
  return { difficulty: 3, lives: 3, rows: 6, cols: 11, quizCount: 4, minHp: 2, maxHp: 5, decoys: 6 };
}

export function classicBreakerStage(level: number): {
  rows: number;
  cols: number;
  quizCount: number;
  minHp: number;
  maxHp: number;
  lives: number;
} {
  const rows = Math.min(7, 3 + level);
  const cols = Math.min(12, 8 + Math.floor(level / 2));
  return {
    rows,
    cols,
    quizCount: 0,
    minHp: 1,
    maxHp: Math.min(5, 1 + level),
    lives: Math.max(2, 5 - Math.floor((level - 1) / 2)),
  };
}
