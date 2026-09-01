/**
 * One dial instead of three. The old title screen asked for speed, pocket balls,
 * and table balls before you could play, which is three decisions a first-timer
 * cannot make usefully. A named difficulty carries all of it, and it is the only
 * thing worth choosing.
 *
 * Losing has to be possible for any of this to matter, so only the gentlest
 * level hands back a ball for clearing a wave.
 */
export const DIFFICULTIES = ["chill", "normal", "hard", "brutal"] as const;

export type DifficultyName = (typeof DIFFICULTIES)[number];

export interface DifficultyPreset {
  name: DifficultyName;
  label: string;
  blurb: string;
  lives: number;
  /** Score multiplier, and how hard the wall pushes back. */
  weight: number;
  /** Multiplies the base ball speed. */
  ballSpeed: number;
  tableBalls: number;
  maxBrickHp: number;
  lifePerWave: boolean;
}

const PRESETS: Record<DifficultyName, DifficultyPreset> = {
  chill: {
    name: "chill",
    label: "Chill",
    blurb: "Five balls, slow roll, a ball back each wave.",
    lives: 5,
    weight: 1,
    ballSpeed: 0.85,
    tableBalls: 1,
    maxBrickHp: 4,
    lifePerWave: true,
  },
  normal: {
    name: "normal",
    label: "Normal",
    blurb: "Three balls. No handouts.",
    lives: 3,
    weight: 2,
    ballSpeed: 1,
    tableBalls: 1,
    maxBrickHp: 5,
    lifePerWave: false,
  },
  hard: {
    name: "hard",
    label: "Hard",
    blurb: "Two balls and a faster table.",
    lives: 2,
    weight: 3,
    ballSpeed: 1.2,
    tableBalls: 1,
    maxBrickHp: 6,
    lifePerWave: false,
  },
  brutal: {
    name: "brutal",
    label: "Brutal",
    blurb: "One ball. Miss it and the run is over.",
    lives: 1,
    weight: 4,
    ballSpeed: 1.45,
    tableBalls: 1,
    maxBrickHp: 6,
    lifePerWave: false,
  },
};

export function parseDifficulty(raw: unknown): DifficultyName {
  return DIFFICULTIES.includes(raw as DifficultyName) ? (raw as DifficultyName) : "normal";
}

export function difficulty(name: DifficultyName): DifficultyPreset {
  return PRESETS[name];
}

export function allDifficulties(): DifficultyPreset[] {
  return DIFFICULTIES.map((name) => PRESETS[name]);
}
