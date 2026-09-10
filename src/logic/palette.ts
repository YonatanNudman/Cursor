import { type Difficulty, type TriviaCategory } from "../types";

/**
 * Every subject owns a hue, so a wall of question bricks reads as a spread of
 * topics before you have hit one. The tier then decides how loud that hue gets:
 * easy bricks are pale and cheap, brutal bricks glow and cost you three balls.
 */
const HUES: Record<TriviaCategory, number> = {
  Science: 174,
  History: 28,
  Geography: 148,
  Sports: 96,
  Movies: 282,
  Music: 320,
  Food: 14,
  Animals: 44,
  Tech: 200,
  Literature: 250,
  Art: 336,
  TV: 264,
  Space: 224,
  Nature: 122,
  Myths: 300,
  Language: 190,
  World: 66,
  General: 6,
};

/** Pale, solid, then hot. The eye can rank three of these without a legend. */
const TIER_PAINT: Record<Difficulty, { sat: number; light: number }> = {
  1: { sat: 32, light: 62 },
  2: { sat: 62, light: 52 },
  3: { sat: 88, light: 44 },
};

export function categoryHue(category: TriviaCategory | undefined): number {
  return category ? HUES[category] : 42;
}

export function quizColor(category: TriviaCategory | undefined, tier: Difficulty = 1): string {
  const paint = TIER_PAINT[tier];
  return `hsl(${categoryHue(category)} ${paint.sat}% ${paint.light}%)`;
}

/** Rim light on a question brick. Brutal bricks get a rim you cannot miss. */
export function quizRim(category: TriviaCategory | undefined, tier: Difficulty = 1): string {
  const alpha = tier === 3 ? 0.95 : tier === 2 ? 0.7 : 0.45;
  return `hsl(${categoryHue(category)} 90% 74% / ${alpha})`;
}

/** One glyph per tier, so colour is never the only signal. */
export function tierGlyph(tier: Difficulty = 1): string {
  return tier === 3 ? "!?" : tier === 2 ? "??" : "?";
}

export function categoryChip(category: TriviaCategory): string {
  return `hsl(${categoryHue(category)} 68% 56%)`;
}
