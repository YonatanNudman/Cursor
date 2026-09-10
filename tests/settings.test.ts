import { describe, expect, it } from "vitest";
import { defaultSettings, readSettings, writeSettings } from "../src/logic/settings";

function memoryStorage() {
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  };
}

describe("settings", () => {
  it("asks only three questions on the setup screen", () => {
    expect(defaultSettings()).toEqual({
      difficulty: "normal",
      mode: "cannon",
      playSpeed: 1,
    });
  });

  it("round-trips chosen table options and rejects junk", () => {
    const storage = memoryStorage();
    writeSettings(storage, { difficulty: "brutal", mode: "paddle", playSpeed: 4 });
    expect(readSettings(storage)).toEqual({
      difficulty: "brutal",
      mode: "paddle",
      playSpeed: 4,
    });
    writeSettings(storage, { difficulty: "bogus" as never, playSpeed: 99 as never } as never);
    const next = readSettings(storage);
    expect(next.difficulty).toBe("normal");
    expect(next.mode).toBe("cannon");
    expect(next.playSpeed).toBe(1);
  });

  it("survives a corrupt store", () => {
    const storage = memoryStorage();
    storage.setItem("mindbreaker.settings", "{not json");
    expect(readSettings(storage).difficulty).toBe("normal");
  });
});
