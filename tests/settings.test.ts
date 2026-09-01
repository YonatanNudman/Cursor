import { describe, expect, it } from "vitest";
import { defaultSettings, parseBalls, parseSpeed, parseTable, readSettings, writeSettings } from "../src/logic/settings";
import { ballsSpawned } from "../src/logic/effects";

describe("settings", () => {
  it("defaults to 2x with a fuller rack", () => {
    expect(defaultSettings()).toEqual({ speed: 2, balls: 5, table: 1 });
    expect(parseSpeed("nope")).toBe(2);
    expect(parseBalls(99)).toBe(5);
    expect(parseTable(4)).toBe(1);
  });

  it("keeps legal speed and ball picks", () => {
    expect(parseSpeed(4)).toBe(4);
    expect(parseBalls(9)).toBe(9);
    expect(parseTable(3)).toBe(3);
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    writeSettings(storage, { speed: 3, balls: 7, table: 3 });
    expect(readSettings(storage)).toEqual({ speed: 3, balls: 7, table: 3 });
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
