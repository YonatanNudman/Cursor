export const SPEEDS = [1, 2, 3, 4] as const;
export const BALL_STOCKS = [3, 5, 7, 9] as const;
export const TABLE_BALLS = [1, 2, 3] as const;

export type SpeedMult = (typeof SPEEDS)[number];
export type BallStock = (typeof BALL_STOCKS)[number];
export type TableBalls = (typeof TABLE_BALLS)[number];

export interface RunSettings {
  speed: SpeedMult;
  balls: BallStock;
  table: TableBalls;
}

const KEY = "mindbreaker.settings";

export function parseSpeed(raw: unknown): SpeedMult {
  const value = Number(raw);
  return SPEEDS.includes(value as SpeedMult) ? (value as SpeedMult) : 2;
}

export function parseBalls(raw: unknown): BallStock {
  const value = Number(raw);
  return BALL_STOCKS.includes(value as BallStock) ? (value as BallStock) : 5;
}

export function parseTable(raw: unknown): TableBalls {
  const value = Number(raw);
  return TABLE_BALLS.includes(value as TableBalls) ? (value as TableBalls) : 1;
}

export function defaultSettings(): RunSettings {
  return { speed: 2, balls: 5, table: 1 };
}

export function readSettings(storage: Pick<Storage, "getItem"> | null): RunSettings {
  if (!storage) return defaultSettings();
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? "{}") as Partial<RunSettings>;
    return {
      speed: parseSpeed(parsed.speed),
      balls: parseBalls(parsed.balls),
      table: parseTable(parsed.table),
    };
  } catch {
    return defaultSettings();
  }
}

export function writeSettings(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  next: RunSettings,
): RunSettings {
  const settings = {
    speed: parseSpeed(next.speed),
    balls: parseBalls(next.balls),
    table: parseTable(next.table),
  };
  storage?.setItem(KEY, JSON.stringify(settings));
  return settings;
}
