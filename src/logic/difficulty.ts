/**
 * One dial for the whole run. It sets starting lives, ball speed, and how
 * thick the wall starts. Losing has to stay possible, so only Chill hands a
 * life back for clearing a level.
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
  maxBrickHp: number;
  /** Extra starting rows on every level. */
  rowBonus: number;
  /** Extra hit points on numbered bricks, on top of the level ramp. */
  hpBonus: number;
  /** Whether clearing a level hands a life back. */
  lifePerLevel: boolean;
}

const PRESETS: Record<DifficultyName, DifficultyPreset> = {
  chill: {
    name: "chill",
    label: "Chill",
    blurb: "Five lives, slow ball, one life back each level.",
    lives: 5,
    weight: 1,
    ballSpeed: 0.85,
      maxBrickHp: 3,
    rowBonus: 0,
    hpBonus: 0,
    lifePerLevel: true,
  },
  normal: {
    name: "normal",
    label: "Normal",
    blurb: "Three lives. No handouts.",
    lives: 3,
    weight: 2,
    ballSpeed: 1,
      maxBrickHp: 5,
    rowBonus: 0,
    hpBonus: 0,
    lifePerLevel: false,
  },
  hard: {
    name: "hard",
    label: "Hard",
    blurb: "Two lives. Thicker wall, an extra row from the start.",
    lives: 2,
    weight: 3,
    ballSpeed: 1.24,
      maxBrickHp: 6,
    rowBonus: 1,
    hpBonus: 1,
    lifePerLevel: false,
  },
  brutal: {
    name: "brutal",
    label: "Brutal",
    blurb: "One life. Fat bricks, a taller wall. One miss ends it.",
    lives: 1,
    weight: 4,
    ballSpeed: 1.52,
      maxBrickHp: 7,
    rowBonus: 2,
    hpBonus: 2,
    lifePerLevel: false,
  },
};

export function parseDifficulty(raw: unknown): DifficultyName {
  return DIFFICULTIES.includes(raw as DifficultyName) ? (raw as DifficultyName) : "normal";
}

export function difficulty(name: DifficultyName): DifficultyPreset {
  return PRESETS[name];
}

export function allDifficulties(): DifficultyPreset[] {
  return DIFFICULTIES.map((item) => PRESETS[item]);
}

export function difficultyLabel(id: DifficultyName): string {
  return difficulty(id).label;
}

export function difficultyHint(id: DifficultyName): string {
  return difficulty(id).blurb;
}
