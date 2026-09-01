import type { Mode, StoredScores } from "../types";

export const SCORE_KEY = "mindbreaker.scores";

export function emptyScores(): StoredScores {
  return { mix: 0, trivia: 0, word: 0, breaker: 0 };
}

export function brickPoints(maxHp: number, kind: "hp" | "letter" | "quiz"): number {
  const base = 20 * maxHp;
  if (kind === "letter") return base + 40;
  if (kind === "quiz") return base + 15;
  return base;
}

export function letterPoints(hit: boolean): number {
  return hit ? 80 : 10;
}

export function wordClearBonus(remainingLives: number, unusedBricks: number): number {
  return 250 + remainingLives * 60 + unusedBricks * 8;
}

export function boardClearBonus(lives: number): number {
  return 200 + lives * 40;
}

export function readScores(storage: Pick<Storage, "getItem"> | null): StoredScores {
  if (!storage) return emptyScores();
  try {
    const raw = storage.getItem(SCORE_KEY);
    if (!raw) return emptyScores();
    const parsed = JSON.parse(raw) as Partial<StoredScores>;
    return {
      mix: Number(parsed.mix) || 0,
      trivia: Number(parsed.trivia) || 0,
      word: Number(parsed.word) || 0,
      breaker: Number(parsed.breaker) || 0,
    };
  } catch {
    return emptyScores();
  }
}

export function writeScore(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  mode: Mode,
  score: number,
): StoredScores {
  const current = readScores(storage);
  current[mode] = Math.max(current[mode], score);
  storage?.setItem(SCORE_KEY, JSON.stringify(current));
  return current;
}

export function formatScore(score: number): string {
  return score.toLocaleString("en-US");
}
