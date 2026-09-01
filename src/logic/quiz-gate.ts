export function canQueueQuiz(asking: boolean, queued: number, ready = true): boolean {
  return !asking && queued === 0 && ready;
}
