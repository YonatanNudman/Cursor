import { describe, expect, it } from "vitest";
import { GOOF_KINDS, pickGoof, Soundboard } from "../src/audio";

describe("goof bag", () => {
  it("has a mixed bag and never repeats the last bit", () => {
    expect(GOOF_KINDS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(GOOF_KINDS).size).toBe(GOOF_KINDS.length);
    const seen = new Set<string>();
    let last: (typeof GOOF_KINDS)[number] | null = null;
    for (let i = 0; i < 40; i += 1) {
      const next = pickGoof(() => (i * 0.17) % 1, last);
      expect(GOOF_KINDS).toContain(next);
      if (last) expect(next).not.toBe(last);
      seen.add(next);
      last = next;
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("plays every kind without throwing when there is no audio device", () => {
    const board = new Soundboard();
    for (const kind of GOOF_KINDS) {
      expect(board.goof(kind)).toBe(kind);
    }
    expect(board.maybeGoof(0, 0)).toBeNull();
  });
});
