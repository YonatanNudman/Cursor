import { describe, expect, it } from "vitest";
import { defaultSettings, readSettings, writeSettings } from "../src/logic/settings";
import { ballsSpawned } from "../src/logic/effects";

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
  it("starts on normal so a first run can actually be lost", () => {
    expect(defaultSettings()).toEqual({ difficulty: "normal" });
  });

  it("round-trips a chosen difficulty and rejects junk", () => {
    const storage = memoryStorage();
    writeSettings(storage, { difficulty: "brutal" });
    expect(readSettings(storage)).toEqual({ difficulty: "brutal" });
    writeSettings(storage, { difficulty: "bogus" as never });
    expect(readSettings(storage)).toEqual({ difficulty: "normal" });
  });

  it("survives a corrupt store", () => {
    const storage = memoryStorage();
    storage.setItem("mindbreaker.settings", "{not json");
    expect(readSettings(storage)).toEqual({ difficulty: "normal" });
  });
});

describe("ball dumps", () => {
  it("spawns more live balls for louder rewards", () => {
    expect(ballsSpawned("multiball")).toBe(2);
    expect(ballsSpawned("tripleBall")).toBe(3);
    expect(ballsSpawned("ballStorm")).toBe(5);
    expect(ballsSpawned("extraLife")).toBe(0);
  });
});
