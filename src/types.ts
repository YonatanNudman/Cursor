export type Screen = "title" | "play" | "result";

export type BrickKind = "hp" | "quiz";

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
  | "TV"
  | "Space"
  | "Nature"
  | "Myths"
  | "Language"
  | "World"
  | "General";

export interface TriviaQuestion {
  id: string;
  category: TriviaCategory;
  question: string;
  choices: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
}

export type EffectKind =
  | "extraLife"
  | "extraPair"
  | "multiball"
  | "tripleBall"
  | "ballStorm"
  | "widePaddle"
  | "slowBall"
  | "fireball"
  | "chipWall"
  | "tinyPaddle"
  | "fastBall"
  | "wobblyBall"
  | "armorUp"
  | "dropRow"
  | "loseLife";

export interface Effect {
  id: EffectKind;
  tone: "good" | "bad";
  headline: string;
  detail: string;
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
