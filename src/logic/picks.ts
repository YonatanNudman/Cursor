import { TRIVIA_CATEGORIES, type Difficulty, type TriviaCategory } from "../types";

/** How many recent picks stay locked out, so nobody farms one category. */
export const PICK_COOLDOWN = 4;

/** Categories offered at once on a pick brick. */
export const PICK_CHOICES = 3;

export const PICK_TIERS: readonly Difficulty[] = [1, 2, 3];

/**
 * Offer categories the player has not just used. Everything picked in the last
 * `PICK_COOLDOWN` turns is off the table, so a Sports-only run is impossible.
 */
export function offerCategories(
  recent: TriviaCategory[],
  rng: () => number = Math.random,
  pool: readonly TriviaCategory[] = TRIVIA_CATEGORIES,
  count = PICK_CHOICES,
): TriviaCategory[] {
  const blocked = new Set(recent.slice(-PICK_COOLDOWN));
  let open = pool.filter((category) => !blocked.has(category));
  if (open.length < count) open = [...pool];
  const bag = [...open];
  const picked: TriviaCategory[] = [];
  while (picked.length < count && bag.length > 0) {
    const index = Math.floor(rng() * bag.length) % bag.length;
    picked.push(bag.splice(index, 1)[0]!);
  }
  return picked;
}

export function rememberPick(
  recent: TriviaCategory[],
  category: TriviaCategory,
): TriviaCategory[] {
  return [...recent, category].slice(-PICK_COOLDOWN);
}

/** True once the player has used up the variety guard and must branch out. */
export function isBlocked(recent: TriviaCategory[], category: TriviaCategory): boolean {
  return recent.slice(-PICK_COOLDOWN).includes(category);
}
