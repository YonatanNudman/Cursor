export function brickPoints(maxHp: number, kind: "hp" | "quiz"): number {
  return kind === "quiz" ? 40 : 18 * maxHp;
}

export function waveClearBonus(wave: number, lives: number): number {
  return 180 + wave * 40 + lives * 30;
}

export function formatScore(score: number): string {
  return score.toLocaleString("en-US");
}

/**
 * A streak should pay off everywhere, not just on the question that earned it.
 * The multiplier rides along on every brick broken while the streak holds, so a
 * good run visibly snowballs and losing it actually stings.
 */
export function streakMultiplier(streak: number): number {
  if (streak >= 8) return 4;
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  return 1;
}

export function streakLabel(streak: number): string {
  if (streak >= 8) return "UNREAL";
  if (streak >= 5) return "ON FIRE";
  if (streak >= 3) return "HOT";
  if (streak === 2) return "NICE";
  return "";
}

/** Streak lengths worth stopping the screen for. */
export function isMilestone(streak: number): boolean {
  return streak === 3 || streak === 5 || streak === 8 || (streak > 8 && streak % 5 === 0);
}
