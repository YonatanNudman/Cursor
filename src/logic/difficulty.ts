/**
 * One table dial. Named difficulty carries lives, speed, wall thickness, and
 * how fast the waves climb. Losing has to be possible, so only Chill hands a
 * ball back for clearing a wave.
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
  /** Extra starting rows on every wave. */
  rowBonus: number;
  /** Extra hit points on numbered bricks, on top of the wave ramp. */
  hpBonus: number;
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
    maxBrickHp: 3,
    rowBonus: 0,
    hpBonus: 0,
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
    rowBonus: 0,
    hpBonus: 0,
    lifePerWave: false,
  },
  hard: {
    name: "hard",
    label: "Hard",
    blurb: "Two balls. Thicker wall. Extra row from the start.",
    lives: 2,
    weight: 3,
    ballSpeed: 1.24,
    tableBalls: 1,
    maxBrickHp: 6,
    rowBonus: 1,
    hpBonus: 1,
    lifePerWave: false,
  },
  brutal: {
    name: "brutal",
    label: "Brutal",
    blurb: "One ball. Fat HP. A taller wall. One miss ends it.",
    lives: 1,
    weight: 4,
    ballSpeed: 1.52,
    tableBalls: 1,
    maxBrickHp: 7,
    rowBonus: 2,
    hpBonus: 2,
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
  return DIFFICULTIES.map((item) => PRESETS[item]);
}

export function difficultyLabel(id: DifficultyName): string {
  return difficulty(id).label;
}

export function difficultyHint(id: DifficultyName): string {
  return difficulty(id).blurb;
}
