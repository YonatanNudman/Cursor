import { describe, expect, it } from "vitest";
import {
  beatsRecord,
  betterRecord,
  emptyRecord,
  formatHolder,
  formatReach,
  parseRecord,
  readLocalRecord,
  sanitizeName,
  writeLocalRecord,
} from "../src/logic/record";

describe("world record", () => {
  it("strips junk from names and caps them", () => {
    expect(sanitizeName("  Ada <b>Lovelace</b> !! ")).toBe("Ada Lovelace");
    expect(sanitizeName("A".repeat(40))).toHaveLength(16);
    expect(sanitizeName(";;;")).toBe("");
  });

  it("parses a stored plaque and ignores trash", () => {
    expect(parseRecord({ name: "Ken", score: 1200.9, wave: 4, correct: 3, at: 9 })).toEqual({
      name: "Ken",
      score: 1200,
      wave: 4,
      correct: 3,
      at: 9,
    });
    expect(parseRecord('prefix {"name":"Ada","score":10,"wave":2,"correct":1,"at":1}')?.name).toBe(
      "Ada",
    );
    expect(parseRecord({ name: "x", score: -1, wave: 1, correct: 0 })).toBeNull();
    expect(parseRecord("nope")).toBeNull();
  });

  it("only counts a pass when the score is strictly higher", () => {
    const held = { name: "Ada", score: 500, wave: 3, correct: 2, at: 1 };
    expect(beatsRecord(501, held)).toBe(true);
    expect(beatsRecord(500, held)).toBe(false);
    expect(beatsRecord(0, emptyRecord())).toBe(false);
    expect(beatsRecord(1, emptyRecord())).toBe(true);
  });

  it("keeps the farther run, then the first named holder", () => {
    const ada = { name: "Ada", score: 800, wave: 5, correct: 4, at: 10 };
    const ken = { name: "Ken", score: 900, wave: 6, correct: 5, at: 20 };
    expect(betterRecord(ada, ken)).toEqual(ken);
    expect(betterRecord(ada, { ...ken, score: 800, at: 20 }).name).toBe("Ada");
  });

  it("says who holds it and how far they got", () => {
    expect(formatHolder(emptyRecord())).toBe("Open table");
    expect(formatReach(emptyRecord())).toBe("Nobody has claimed it yet");
    const held = { name: "Ada", score: 1200, wave: 7, correct: 9, at: 1 };
    expect(formatHolder(held)).toBe("Ada");
    expect(formatReach(held)).toBe("Wave 7 · 1,200 · 9 right");
  });

  it("remembers the plaque on this phone", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    const saved = writeLocalRecord(storage, {
      name: "Ada",
      score: 40,
      wave: 2,
      correct: 1,
      at: 3,
    });
    expect(readLocalRecord(storage)).toEqual(saved);
  });
});
