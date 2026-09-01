/**
 * Trivia should punctuate the breaking, not interrupt it. A question is only
 * allowed once the previous one has cleared, the cooldown has elapsed, and the
 * player has actually broken some bricks since the last one. Without the brick
 * gate a lucky multiball sweep fires question after question with no play in
 * between, which reads as an interrogation rather than a game.
 */
export const QUIZ_COOLDOWN_MS = 3600;
export const QUIZ_MIN_BRICKS = 3;

export function canQueueQuiz(
  asking: boolean,
  queued: number,
  ready = true,
  bricksSinceQuiz = Number.POSITIVE_INFINITY,
): boolean {
  return !asking && queued === 0 && ready && bricksSinceQuiz >= QUIZ_MIN_BRICKS;
}
