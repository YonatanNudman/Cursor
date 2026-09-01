export function canQueueQuiz(asking: boolean, queued: number): boolean {
  return !asking && queued === 0;
}
