import { parseDifficulty, type DifficultyName } from "./difficulty";

export interface RunSettings {
  difficulty: DifficultyName;
}

const KEY = "mindbreaker.settings";

export function defaultSettings(): RunSettings {
  return { difficulty: "normal" };
}

export function readSettings(storage: Pick<Storage, "getItem"> | null): RunSettings {
  if (!storage) return defaultSettings();
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? "{}") as Partial<RunSettings>;
    return { difficulty: parseDifficulty(parsed.difficulty) };
  } catch {
    return defaultSettings();
  }
}

export function writeSettings(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  next: RunSettings,
): RunSettings {
  const settings: RunSettings = { difficulty: parseDifficulty(next.difficulty) };
  storage?.setItem(KEY, JSON.stringify(settings));
  return settings;
}
