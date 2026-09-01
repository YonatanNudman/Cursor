export type Screen =
  | "home"
  | "how"
  | "mix"
  | "trivia"
  | "word"
  | "breaker"
  | "result";

export type Mode = "mix" | "trivia" | "word" | "breaker";

export type BrickKind = "hp" | "letter" | "quiz";

export type TriviaCategory =
  | "Science"
  | "History"
  | "Geography"
  | "Sports"
  | "Movies"
  | "Music"
  | "Food"
  | "Animals"
  | "Tech"
  | "Literature"
  | "Art"
  | "General";

export interface TriviaQuestion {
  id: string;
  category: TriviaCategory;
  question: string;
  choices: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
}

export interface WordEntry {
  word: string;
  category: string;
  difficulty: 1 | 2 | 3;
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
  letter?: string;
  alive: boolean;
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

export interface Puzzle {
  word: string;
  category: string;
  guessed: Set<string>;
  wrong: number;
  maxWrong: number;
}

export interface GuessResult {
  already: boolean;
  hit: boolean;
  won: boolean;
  lost: boolean;
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
  mode: Mode;
  score: number;
  title: string;
  detail: string;
  won: boolean;
}

export interface StoredScores {
  mix: number;
  trivia: number;
  word: number;
  breaker: number;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
