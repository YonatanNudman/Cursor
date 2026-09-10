import { parseDifficulty, type DifficultyName } from "./difficulty";

export type PlayMode = "paddle" | "cannon";
export type PlaySpeed = 1 | 2 | 3 | 4 | 5;

/**
 * Three dials, on purpose. The level ramp owns wall size, magazine, and
 * question tier now, so the setup screen only asks how you want to aim, how
 * much slack you want, and how fast the table should run.
 */
export interface RunSettings {
  difficulty: DifficultyName;
  mode: PlayMode;
  playSpeed: PlaySpeed;
}

const KEY = "mindbreaker.settings";

export const PLAY_MODES: readonly PlayMode[] = ["paddle", "cannon"];
export const PLAY_SPEEDS: readonly PlaySpeed[] = [1, 2, 3, 4, 5];

export function isPlayMode(value: string): value is PlayMode {
  return (PLAY_MODES as readonly string[]).includes(value);
}

export function isPlaySpeed(value: number): value is PlaySpeed {
  return (PLAY_SPEEDS as readonly number[]).includes(value);
}

export function defaultSettings(): RunSettings {
  return {
    difficulty: "normal",
    mode: "cannon",
    playSpeed: 1,
  };
}

export function settingsFromUnknown(raw: unknown): RunSettings {
  const fallback = defaultSettings();
  if (!raw || typeof raw !== "object") return fallback;
  const rec = raw as Partial<RunSettings>;
  return {
    difficulty: parseDifficulty(rec.difficulty),
    mode: typeof rec.mode === "string" && isPlayMode(rec.mode) ? rec.mode : fallback.mode,
    playSpeed: typeof rec.playSpeed === "number" && isPlaySpeed(rec.playSpeed) ? rec.playSpeed : fallback.playSpeed,
  };
}

export function readSettings(storage: Pick<Storage, "getItem"> | null): RunSettings {
  if (!storage) return defaultSettings();
  try {
    return settingsFromUnknown(JSON.parse(storage.getItem(KEY) ?? "{}"));
  } catch {
    return defaultSettings();
  }
}

export function writeSettings(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  next: RunSettings,
): RunSettings {
  const settings = settingsFromUnknown(next);
  storage?.setItem(KEY, JSON.stringify(settings));
  return settings;
}

export function modeLabel(mode: PlayMode): string {
  switch (mode) {
    case "paddle":
      return "Paddle";
    case "cannon":
      return "Cannon";
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

export function modeHint(mode: PlayMode): string {
  switch (mode) {
    case "paddle":
      return "Hold to aim, drag the bar, keep the ball alive.";
    case "cannon":
      return "Aim once. Fire the magazine. The wall drops when it runs dry.";
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}
