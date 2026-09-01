const SEEN_KEY = "mindbreaker.seen-ids";
const BEST_KEY = "mindbreaker.best";
const MAX_SEEN = 220;

export function readSeen(storage: Pick<Storage, "getItem"> | null): string[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(SEEN_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(String).slice(-MAX_SEEN) : [];
  } catch {
    return [];
  }
}

export function rememberSeen(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  ids: string[],
): string[] {
  const next = [...readSeen(storage), ...ids].slice(-MAX_SEEN);
  storage?.setItem(SEEN_KEY, JSON.stringify(next));
  return next;
}

export function readBest(storage: Pick<Storage, "getItem"> | null): number {
  if (!storage) return 0;
  return Number(storage.getItem(BEST_KEY)) || 0;
}

export function writeBest(storage: Pick<Storage, "getItem" | "setItem"> | null, score: number): number {
  const best = Math.max(readBest(storage), score);
  storage?.setItem(BEST_KEY, String(best));
  return best;
}

export function preferFresh<T extends { id: string }>(items: T[], seen: string[]): T[] {
  const seenSet = new Set(seen);
  const fresh = items.filter((item) => !seenSet.has(item.id));
  const stale = items.filter((item) => seenSet.has(item.id));
  return fresh.length >= 16 ? fresh : [...fresh, ...stale];
}
