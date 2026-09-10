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
  it("starts on a losable cannon table", () => {
    expect(defaultSettings()).toEqual({
      difficulty: "normal",
      mode: "cannon",
      questionFloor: 0,
      categories: [],
      cannonAmmo: 30,
      playSpeed: 1,
    });
  });

  it("round-trips chosen table options and rejects junk", () => {
    const storage = memoryStorage();
    writeSettings(storage, {
      difficulty: "brutal",
      mode: "paddle",
      questionFloor: 3,
      categories: ["Science", "Tech"],
      cannonAmmo: 50,
      playSpeed: 4,
    });
    expect(readSettings(storage)).toEqual({
      difficulty: "brutal",
      mode: "paddle",
      questionFloor: 3,
      categories: ["Science", "Tech"],
      cannonAmmo: 50,
      playSpeed: 4,
    });
    writeSettings(storage, { difficulty: "bogus" as never } as never);
    const next = readSettings(storage);
    expect(next.difficulty).toBe("normal");
    expect(next.mode).toBe("cannon");
  });

  it("survives a corrupt store", () => {
    const storage = memoryStorage();
    storage.setItem("mindbreaker.settings", "{not json");
    expect(readSettings(storage).difficulty).toBe("normal");
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
