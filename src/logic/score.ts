export function brickPoints(maxHp: number, kind: "hp" | "quiz"): number {
  return kind === "quiz" ? 40 : 18 * maxHp;
}

export function waveClearBonus(wave: number, lives: number): number {
  return 180 + wave * 40 + lives * 30;
}

export function formatScore(score: number): string {
  return score.toLocaleString("en-US");
}
