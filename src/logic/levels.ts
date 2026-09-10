import type { Difficulty } from "../types";
import type { DifficultyPreset } from "./difficulty";

/**
 * Each level draws a different wall. The shape decides which grid cells hold a
 * brick, so level 3 never looks like level 4 even at the same size.
 */
const PLAIN_LAYOUTS = [
  "wall",
  "pyramid",
  "checker",
  "columns",
  "arch",
  "diamond",
  "tunnel",
  "split",
  "spine",
  "crown",
] as const;

/**
 * Boss shapes are kept out of the normal rotation, which is what guarantees a
 * boss never wears the same wall as the level before or after it.
 */
const BOSS_ONLY_LAYOUTS = ["fortress", "vault", "gauntlet"] as const;

export const LAYOUTS = [...PLAIN_LAYOUTS, ...BOSS_ONLY_LAYOUTS] as const;

export type Layout = (typeof LAYOUTS)[number];

export const BOSS_LAYOUTS: readonly Layout[] = BOSS_ONLY_LAYOUTS;

export interface LevelPlan {
  index: number;
  name: string;
  layout: Layout;
  rows: number;
  cols: number;
  minHp: number;
  maxHp: number;
  quizRatio: number;
  /** Question tier this level leans on when the player does not pick one. */
  tier: Difficulty;
  ballSpeed: number;
  /** Cannon balls per volley. This shrinks as walls thicken. */
  magazine: number;
  /** Rows the wall drops each time a volley runs dry. */
  descent: number;
  /** Choose-your-own-question bricks planted in the wall. */
  picks: number;
  boss: boolean;
}

const NAMES = [
  "Warm Up",
  "Chalk Dust",
  "Pop Quiz",
  "Study Hall",
  "Midterms",
  "Hall Monitor",
  "Detention",
  "Cram Week",
  "Thesis",
  "Finals",
];

export const MAX_MAGAZINE = 32;
export const MIN_MAGAZINE = 11;

/** Bosses take a permanent bite out of the magazine, so the ramp only ever falls. */
function magazineFor(step: number): number {
  const bosses = Math.floor(step / 5);
  return Math.max(MIN_MAGAZINE, MAX_MAGAZINE - (step - 1) - bosses * 2);
}

export function isBossLevel(index: number): boolean {
  return index >= 5 && index % 5 === 0;
}

export function levelName(index: number): string {
  const base = NAMES[(index - 1) % NAMES.length] ?? "Overtime";
  const lap = Math.floor((index - 1) / NAMES.length);
  return lap > 0 ? `${base} ${lap + 1}` : base;
}

export function layoutFor(index: number): Layout {
  if (isBossLevel(index)) {
    return BOSS_LAYOUTS[(Math.floor(index / 5) - 1) % BOSS_LAYOUTS.length] ?? "fortress";
  }
  return PLAIN_LAYOUTS[(index - 1) % PLAIN_LAYOUTS.length] ?? "wall";
}

export function tierFor(index: number): Difficulty {
  if (index >= 9) return 3;
  if (index >= 4) return 2;
  return 1;
}

/**
 * The ramp that makes a run end. Walls grow rows and hit points while the
 * magazine shrinks and the wall drops faster, so past level ten a clean clear
 * stops being possible and the player has to trade questions for lives.
 */
export function levelPlan(index: number, preset: DifficultyPreset, width = 390): LevelPlan {
  const step = Math.max(1, index);
  const boss = isBossLevel(step);
  const rows = Math.min(10, 4 + Math.floor((step - 1) / 2) + preset.rowBonus + (boss ? 1 : 0));
  const minHp = Math.min(4, 1 + Math.floor((step - 1) / 4) + preset.hpBonus);
  const maxHp = Math.min(preset.maxBrickHp + (boss ? 2 : 0), minHp + 1 + Math.floor(step / 3));
  const magazine = magazineFor(step);
  return {
    index: step,
    name: levelName(step),
    layout: layoutFor(step),
    rows,
    cols: width < 420 ? 6 : Math.min(9, 7 + Math.floor((step - 1) / 4)),
    minHp,
    maxHp,
    quizRatio: Math.min(0.38, 0.2 + step * 0.014),
    tier: tierFor(step),
    ballSpeed: preset.ballSpeed * (1 + (step - 1) * 0.045),
    magazine,
    descent: Math.min(5, 1 + Math.floor((step - 1) / 6)),
    picks: boss ? 2 : 1,
    boss,
  };
}

/** Clearing a level pays more the deeper you are, and a boss pays double. */
export function levelBonus(plan: LevelPlan, livesLeft: number): number {
  const base = 220 + plan.index * 90 + livesLeft * 45;
  return plan.boss ? base * 2 : base;
}

/** One line of warning shown on the level card before the wall appears. */
export function levelBrief(plan: LevelPlan): string {
  if (plan.boss) return `Boss wall. ${plan.rows} rows, ${plan.magazine} shots, no soft cells.`;
  return `${plan.rows} rows · ${plan.magazine} shots · drops ${plan.descent} row${plan.descent === 1 ? "" : "s"} a volley`;
}
