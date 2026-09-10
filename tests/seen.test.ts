import { describe, expect, it } from "vitest";
import { preferFresh, rememberSeen } from "../src/logic/seen";

describe("preferFresh", () => {
  it("keeps unseen questions ahead of ones already asked", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(preferFresh(items, ["a", "c"]).map((item) => item.id)).toEqual(["b"]);
  });

  it("recycles the full set only after every id has been seen", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(preferFresh(items, ["a", "b"])).toEqual(items);
  });
});

describe("rememberSeen", () => {
  it("stores a long history so a fat bank does not wrap in a week", () => {
    const storage = new Map<string, string>();
    const api = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };
    rememberSeen(api, Array.from({ length: 400 }, (_, i) => `q-${i}`));
    const saved = JSON.parse(api.getItem("mindbreaker.seen-ids") ?? "[]") as string[];
    expect(saved.length).toBe(400);
  });
});
