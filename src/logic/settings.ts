import { parseDifficulty, type DifficultyName } from "./difficulty";
import { TRIVIA_CATEGORIES, type TriviaCategory } from "../types";

export type PlayMode = "paddle" | "cannon";
export type QuestionFloor = 0 | 1 | 2 | 3;
export type CannonAmmo = 10 | 20 | 30 | 50;
export type PlaySpeed = 1 | 2 | 3 | 4 | 5;

export interface RunSettings {
  difficulty: DifficultyName;
  mode: PlayMode;
  questionFloor: QuestionFloor;
  categories: TriviaCategory[];
  cannonAmmo: CannonAmmo;
  playSpeed: PlaySpeed;
}

const KEY = "mindbreaker.settings";

export const PLAY_MODES: readonly PlayMode[] = ["paddle", "cannon"];
export const QUESTION_FLOORS: readonly QuestionFloor[] = [0, 1, 2, 3];
export const CANNON_AMMO: readonly CannonAmmo[] = [10, 20, 30, 50];
export const PLAY_SPEEDS: readonly PlaySpeed[] = [1, 2, 3, 4, 5];

export function isPlayMode(value: string): value is PlayMode {
  return (PLAY_MODES as readonly string[]).includes(value);
}

export function isQuestionFloor(value: number): value is QuestionFloor {
  return (QUESTION_FLOORS as readonly number[]).includes(value);
}

export function isCannonAmmo(value: number): value is CannonAmmo {
  return (CANNON_AMMO as readonly number[]).includes(value);
}

export function isPlaySpeed(value: number): value is PlaySpeed {
  return (PLAY_SPEEDS as readonly number[]).includes(value);
}

export function parseCategories(raw: unknown): TriviaCategory[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(TRIVIA_CATEGORIES);
  return raw.filter((item): item is TriviaCategory => typeof item === "string" && allowed.has(item));
}

export function toggleCategory(current: TriviaCategory[], next: TriviaCategory): TriviaCategory[] {
  return current.includes(next) ? current.filter((item) => item !== next) : [...current, next];
}

export function defaultSettings(): RunSettings {
  return {
    difficulty: "normal",
    mode: "cannon",
    questionFloor: 0,
    categories: [],
    cannonAmmo: 30,
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
    questionFloor:
      typeof rec.questionFloor === "number" && isQuestionFloor(rec.questionFloor)
        ? rec.questionFloor
        : fallback.questionFloor,
    categories: parseCategories(rec.categories),
    cannonAmmo:
      typeof rec.cannonAmmo === "number" && isCannonAmmo(rec.cannonAmmo) ? rec.cannonAmmo : fallback.cannonAmmo,
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
      return "Aim once. Fire the magazine. Rows drop when the volley ends.";
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

export function floorLabel(floor: QuestionFloor): string {
  switch (floor) {
    case 0:
      return "Auto";
    case 1:
      return "Easy+";
    case 2:
      return "Hard+";
    case 3:
      return "Brutal Q";
    default: {
      const _never: never = floor;
      return _never;
    }
  }
}

export function floorHint(floor: QuestionFloor): string {
  switch (floor) {
    case 0:
      return "Waves pick the tier. Later tables get meaner questions.";
    case 1:
      return "Any honest question. Soft entry.";
    case 2:
      return "Skip the easy ones. Harder answers, fatter rewards.";
    case 3:
      return "Smart-ass only. Wrong answers hurt more.";
    default: {
      const _never: never = floor;
      return _never;
    }
  }
}
