import type { Difficulty } from "../types";

/** What a question is worth, win or lose. Lives are the real currency. */
export interface Stake {
  /** Signed change to the ball count. Negative on a wrong answer. */
  lives: number;
  score: number;
  headline: string;
  detail: string;
  tone: "good" | "bad";
  /** Extra punishment on the wall, only ever on a wrong answer. */
  punish: "none" | "armor" | "dropRow";
}

export const TIER_LABELS: Record<Difficulty, string> = {
  1: "Easy",
  2: "Hard",
  3: "Brutal",
};

/** Lives risked and won, by question tier. Symmetric on purpose. */
export const TIER_LIVES: Record<Difficulty, number> = { 1: 1, 2: 2, 3: 3 };

const TIER_SCORE: Record<Difficulty, number> = { 1: 150, 2: 340, 3: 700 };

export function tierReward(tier: Difficulty): string {
  const lives = TIER_LIVES[tier];
  return `+${lives} ball${lives === 1 ? "" : "s"} / -${lives} if wrong`;
}

export function stakeFor(tier: Difficulty, correct: boolean, streak = 0): Stake {
  const lives = TIER_LIVES[tier];
  if (correct) {
    const bonus = Math.min(4, Math.max(0, streak - 1));
    return {
      lives,
      score: TIER_SCORE[tier] + bonus * 60,
      headline: `+${lives} ball${lives === 1 ? "" : "s"}`,
      detail: `${TIER_LABELS[tier]} answered. The rack pays out.`,
      tone: "good",
      punish: "none",
    };
  }
  return {
    lives: -lives,
    score: 0,
    headline: `-${lives} ball${lives === 1 ? "" : "s"}`,
    detail:
      tier === 3
        ? "Brutal miss. The wall grows a row."
        : tier === 2
          ? "Wrong. Every brick puts on a coat."
          : "Wrong. That one cost you leather.",
    tone: "bad",
    punish: tier === 3 ? "dropRow" : tier === 2 ? "armor" : "none",
  };
}
