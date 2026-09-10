import { describe, expect, it } from "vitest";
import { PICK_CHOICES, PICK_COOLDOWN, isBlocked, offerCategories, rememberPick } from "../src/logic/picks";
import { TRIVIA_CATEGORIES, type TriviaCategory } from "../src/types";

describe("pick offers", () => {
  it("offers three different subjects", () => {
    const offers = offerCategories([], () => 0.5);
    expect(offers).toHaveLength(PICK_CHOICES);
    expect(new Set(offers).size).toBe(PICK_CHOICES);
  });

  it("never offers a subject from the last few picks", () => {
    const recent: TriviaCategory[] = ["Science", "Sports", "Movies", "Tech"];
    for (let seed = 0; seed < 40; seed += 1) {
      const offers = offerCategories(recent, () => (seed % 10) / 10);
      for (const category of recent) {
        expect(offers, `seed ${seed}`).not.toContain(category);
      }
    }
  });

  it("keeps only the cooldown window of picks", () => {
    let recent: TriviaCategory[] = [];
    for (const category of TRIVIA_CATEGORIES) recent = rememberPick(recent, category);
    expect(recent).toHaveLength(PICK_COOLDOWN);
    expect(recent[recent.length - 1]).toBe(TRIVIA_CATEGORIES[TRIVIA_CATEGORIES.length - 1]);
  });

  it("reports the block so a repeat farm is impossible", () => {
    const recent = rememberPick([], "Music");
    expect(isBlocked(recent, "Music")).toBe(true);
    expect(isBlocked(recent, "Food")).toBe(false);
  });

  it("frees a subject again once it has aged out", () => {
    let recent: TriviaCategory[] = ["Music"];
    for (const category of ["Food", "Art", "TV", "Space"] as TriviaCategory[]) {
      recent = rememberPick(recent, category);
    }
    expect(isBlocked(recent, "Music")).toBe(false);
  });

  it("reopens the pool rather than dead-ending on a tiny category list", () => {
    const tiny: readonly TriviaCategory[] = ["Science", "Sports", "Movies"];
    const offers = offerCategories(["Science", "Sports", "Movies"], () => 0.4, tiny);
    expect(offers).toHaveLength(3);
    expect(new Set(offers).size).toBe(3);
  });
});
