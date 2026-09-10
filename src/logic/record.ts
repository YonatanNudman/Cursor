import { formatScore } from "./score";

export interface WorldRecord {
  name: string;
  score: number;
  wave: number;
  correct: number;
  at: number;
}

export const EMPTY_RECORD: WorldRecord = {
  name: "",
  score: 0,
  wave: 1,
  correct: 0,
  at: 0,
};

export const NAME_MAX = 16;
const STORAGE_KEY = "mindbreaker.world";

/** Public paste that every phone reads and updates. Pages has no server. */
const REMOTE_ID = "b3bwxocd";
const REMOTE_EDIT = "Ngjn8d4c";
const REMOTE_FETCH = `https://rentry.co/api/fetch/${REMOTE_ID}`;
const REMOTE_SAVE = `https://rentry.co/api/edit/${REMOTE_ID}`;

export function emptyRecord(): WorldRecord {
  return { ...EMPTY_RECORD };
}

export function sanitizeName(raw: string): string {
  const stripped = raw.replace(/<[^>]*>/g, " ").replace(/[^\p{L}\p{N} .'-]/gu, "");
  return stripped.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

export function parseRecord(raw: unknown): WorldRecord | null {
  if (typeof raw === "string") {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return parseRecord(JSON.parse(match[0]) as unknown);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const score = Number(row.score);
  const wave = Number(row.wave);
  const correct = Number(row.correct);
  const at = Number(row.at);
  if (!Number.isFinite(score) || score < 0) return null;
  if (!Number.isFinite(wave) || wave < 1) return null;
  if (!Number.isFinite(correct) || correct < 0) return null;
  return {
    name: sanitizeName(String(row.name ?? "")),
    score: Math.floor(score),
    wave: Math.floor(wave),
    correct: Math.floor(correct),
    at: Number.isFinite(at) && at > 0 ? Math.floor(at) : 0,
  };
}

export function beatsRecord(score: number, current: WorldRecord): boolean {
  return Number.isFinite(score) && Math.floor(score) > current.score;
}

export function hasHolder(record: WorldRecord): boolean {
  return record.score > 0 && record.name.length > 0;
}

export function betterRecord(left: WorldRecord, right: WorldRecord): WorldRecord {
  if (left.score !== right.score) return left.score > right.score ? left : right;
  if (left.name && !right.name) return left;
  if (right.name && !left.name) return right;
  if (left.at && right.at && left.at !== right.at) return left.at <= right.at ? left : right;
  return left.name ? left : right;
}

export function formatHolder(record: WorldRecord): string {
  return hasHolder(record) ? record.name : "Open table";
}

export function formatReach(record: WorldRecord): string {
  if (record.score <= 0) return "Nobody has claimed it yet";
  const bits = [`Wave ${record.wave}`, formatScore(record.score)];
  if (record.correct > 0) bits.push(`${record.correct} right`);
  return bits.join(" · ");
}

export function readLocalRecord(storage: Pick<Storage, "getItem"> | null): WorldRecord {
  if (!storage) return emptyRecord();
  try {
    return parseRecord(JSON.parse(storage.getItem(STORAGE_KEY) ?? "null")) ?? emptyRecord();
  } catch {
    return emptyRecord();
  }
}

export function writeLocalRecord(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  record: WorldRecord,
): WorldRecord {
  storage?.setItem(STORAGE_KEY, JSON.stringify(record));
  return record;
}

type RemotePayload = {
  status?: string | number;
  content?: { text?: string } | string;
};

async function remoteLoad(): Promise<WorldRecord | null> {
  const response = await fetch(REMOTE_FETCH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ edit_code: REMOTE_EDIT }),
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as RemotePayload;
  if (String(payload.status) !== "200") return null;
  const text = typeof payload.content === "string" ? payload.content : payload.content?.text;
  return parseRecord(text);
}

async function remoteSave(record: WorldRecord): Promise<boolean> {
  const response = await fetch(REMOTE_SAVE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      edit_code: REMOTE_EDIT,
      text: JSON.stringify(record),
    }),
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return false;
  const payload = (await response.json()) as RemotePayload;
  return String(payload.status) === "200";
}

export async function loadWorldRecord(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
): Promise<WorldRecord> {
  const local = readLocalRecord(storage);
  try {
    const remote = await remoteLoad();
    if (!remote) return local;
    if (beatsRecord(local.score, remote) && local.name) {
      void remoteSave(local);
      return local;
    }
    const best = betterRecord(remote, local);
    writeLocalRecord(storage, best);
    return best;
  } catch {
    return local;
  }
}

export type ClaimReason = "ok" | "name" | "beaten";

export async function claimWorldRecord(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  draft: { name: string; score: number; wave: number; correct: number },
): Promise<{ record: WorldRecord; claimed: boolean; reason: ClaimReason }> {
  const name = sanitizeName(draft.name);
  if (!name) return { record: readLocalRecord(storage), claimed: false, reason: "name" };
  const current = await loadWorldRecord(storage);
  if (!beatsRecord(draft.score, current)) {
    return { record: current, claimed: false, reason: "beaten" };
  }
  const next: WorldRecord = {
    name,
    score: Math.floor(draft.score),
    wave: Math.max(1, Math.floor(draft.wave) || 1),
    correct: Math.max(0, Math.floor(draft.correct) || 0),
    at: Date.now(),
  };
  writeLocalRecord(storage, next);
  try {
    await remoteSave(next);
  } catch {
    // The phone still shows the new plaque if the shared paste is down.
  }
  return { record: next, claimed: true, reason: "ok" };
}
