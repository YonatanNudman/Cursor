/**
 * Trivia should punctuate the breaking, not interrupt it. Pause + cooldown
 * already stop a multiball from stacking questions. A pink brick is the
 * question — never make the player break three other bricks first.
 */
export const QUIZ_COOLDOWN_MS = 3600;

export function canQueueQuiz(asking: boolean, queued: number, ready = true): boolean {
  return !asking && queued === 0 && ready;
}
