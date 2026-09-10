export type Screen = "setup" | "play" | "result";

export const TRIVIA_CATEGORIES = [
  "Science",
  "History",
  "Geography",
  "Sports",
  "Movies",
  "Music",
  "Food",
  "Animals",
  "Tech",
  "Literature",
  "Art",
  "TV",
  "Space",
  "Nature",
  "Myths",
  "Language",
  "World",
  "General",
] as const;

/** "pick" bricks let you choose the next category and how much to risk. */
export type BrickKind = "hp" | "quiz" | "pick";

export type TriviaCategory = (typeof TRIVIA_CATEGORIES)[number];

/** 1 is a warm-up, 2 needs a moment, 3 is for the deep waves. */
export type Difficulty = 1 | 2 | 3;

export interface TriviaQuestion {
  id: string;
  category: TriviaCategory;
  question: string;
  choices: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  difficulty: Difficulty;
}

export interface Brick {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  kind: BrickKind;
  alive: boolean;
  /** Question bricks carry the tier they will ask, which sets their colour. */
  tier?: Difficulty;
  /** Question bricks carry their subject, which sets their hue. */
  category?: TriviaCategory;
}

export interface Ball {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  stuck: boolean;
}

export interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CircleRectHit {
  nx: number;
  ny: number;
  overlap: number;
}

export interface ScoreCard {
  score: number;
  wave: number;
  correct: number;
  missed: number;
  title: string;
  detail: string;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
