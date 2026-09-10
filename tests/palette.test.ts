import { describe, expect, it } from "vitest";
import { categoryHue, quizColor, quizRim, tierGlyph } from "../src/logic/palette";
import { TRIVIA_CATEGORIES } from "../src/types";

describe("brick palette", () => {
  it("gives every subject its own hue", () => {
    const hues = TRIVIA_CATEGORIES.map(categoryHue);
    expect(new Set(hues).size).toBe(TRIVIA_CATEGORIES.length);
  });

  it("paints the same subject differently at each tier", () => {
    const shades = [1, 2, 3].map((tier) => quizColor("Science", tier as 1 | 2 | 3));
    expect(new Set(shades).size).toBe(3);
  });

  it("keeps two subjects apart at the same tier", () => {
    expect(quizColor("Science", 2)).not.toBe(quizColor("History", 2));
  });

  it("makes the brutal rim the loudest", () => {
    expect(quizRim("Science", 3)).toContain("0.95");
    expect(quizRim("Science", 1)).toContain("0.45");
  });

  it("gives each tier a glyph you can read without colour", () => {
    expect(tierGlyph(1)).toBe("?");
    expect(tierGlyph(2)).toBe("??");
    expect(tierGlyph(3)).toBe("!?");
  });
});
