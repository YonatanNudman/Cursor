import { describe, expect, it } from "vitest";
import {
  aliveBricks,
  armorBricks,
  brickMetrics,
  buildLevel,
  cellFilled,
  descendBricks,
  dropRow,
  hitBrick,
  hpForCell,
  liftBricks,
  onlyNumbersLeft,
  specForPlan,
} from "../src/logic/bricks";
import { difficulty } from "../src/logic/difficulty";
import { LAYOUTS, levelPlan } from "../src/logic/levels";

function cycle(values: number[]): () => number {
  let i = 0;
  return () => {
    const value = values[i % values.length]!;
    i += 1;
    return value;
  };
}

describe("hpForCell", () => {
  it("keeps hit points inside the requested band", () => {
    const rng = cycle([0.1, 0.9, 0.4]);
    for (let row = 0; row < 5; row += 1) {
      const hp = hpForCell(row, 5, 1, 4, rng);
      expect(hp).toBeGreaterThanOrEqual(1);
      expect(hp).toBeLessThanOrEqual(4);
    }
  });
});

describe("cellFilled", () => {
  it("gives every layout a playable, distinct footprint", () => {
    const rows = 6;
    const cols = 7;
    const prints = new Map<string, string>();
    for (const layout of LAYOUTS) {
      let print = "";
      let filled = 0;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const on = cellFilled(layout, row, col, rows, cols);
          print += on ? "#" : ".";
          if (on) filled += 1;
        }
      }
      expect(filled, `${layout} is empty`).toBeGreaterThanOrEqual(6);
      prints.set(layout, print);
    }
    // No two layouts may draw the same wall, or levels would look repeated.
    expect(new Set(prints.values()).size).toBe(LAYOUTS.length);
  });

  it("leaves a gap somewhere in every layout except the solid wall", () => {
    for (const layout of LAYOUTS) {
      let holes = 0;
      for (let row = 0; row < 6; row += 1) {
        for (let col = 0; col < 7; col += 1) {
          if (!cellFilled(layout, row, col, 6, 7)) holes += 1;
        }
      }
      if (layout === "wall") expect(holes).toBe(0);
      else expect(holes, layout).toBeGreaterThan(0);
    }
  });
});

describe("buildLevel", () => {
  it("plants question bricks carrying a tier and a subject", () => {
    const bricks = buildLevel(
      {
        rows: 4,
        cols: 6,
        width: 600,
        height: 400,
        padding: 10,
        offsetY: 12,
        quizRatio: 0.4,
        minHp: 1,
        maxHp: 3,
      },
      cycle([0.2, 0.8, 0.1, 0.55, 0.33]),
    );
    expect(bricks).toHaveLength(24);
    const quizzes = bricks.filter((brick) => brick.kind === "quiz");
    expect(quizzes.length).toBeGreaterThanOrEqual(8);
    expect(quizzes.every((brick) => brick.hp === 1)).toBe(true);
    expect(quizzes.every((brick) => brick.tier !== undefined)).toBe(true);
    expect(quizzes.every((brick) => brick.category !== undefined)).toBe(true);
  });

  it("honours the layout mask instead of always filling the grid", () => {
    const spec = {
      rows: 4,
      cols: 6,
      width: 600,
      height: 400,
      padding: 10,
      offsetY: 12,
      quizRatio: 0.3,
      minHp: 1,
      maxHp: 2,
    };
    const solid = buildLevel(spec, () => 0.4);
    const carved = buildLevel({ ...spec, layout: "split" }, () => 0.4);
    expect(carved.length).toBeLessThan(solid.length);
  });

  it("plants the star bricks a plan asks for", () => {
    const plan = levelPlan(5, difficulty("normal"));
    expect(plan.picks).toBeGreaterThan(0);
    const bricks = buildLevel(specForPlan(plan, 390, 640), () => 0.4);
    expect(bricks.filter((brick) => brick.kind === "pick")).toHaveLength(plan.picks);
  });

  it("keeps every brick inside the board it was given", () => {
    const plan = levelPlan(7, difficulty("hard"));
    const spec = specForPlan(plan, 390, 700);
    const { brickW } = brickMetrics(spec);
    for (const brick of buildLevel(spec, () => 0.5)) {
      expect(brick.x).toBeGreaterThanOrEqual(spec.padding - 0.001);
      expect(brick.x + brickW).toBeLessThanOrEqual(390 - spec.padding + 0.001);
    }
  });
});

describe("hitBrick and armor", () => {
  it("needs multiple hits, then can be armored back up", () => {
    const brick = buildLevel(
      {
        rows: 1,
        cols: 1,
        width: 100,
        height: 80,
        padding: 0,
        offsetY: 0,
        quizRatio: 0,
        minHp: 3,
        maxHp: 3,
      },
      () => 0,
    ).find((item) => item.kind === "hp")!;
    expect(hitBrick(brick)).toEqual({ broke: false, hp: 2 });
    armorBricks([brick]);
    expect(brick.hp).toBe(3);
    expect(hitBrick(brick).broke).toBe(false);
  });

  it("never armors a question brick, so its price stays one hit", () => {
    const quiz = {
      id: "q",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      hp: 1,
      maxHp: 1,
      kind: "quiz" as const,
      alive: true,
    };
    armorBricks([quiz]);
    expect(quiz.hp).toBe(1);
  });
});

describe("dropRow", () => {
  it("adds a new row without killing the old wall", () => {
    const bricks = buildLevel(specForPlan(levelPlan(1, difficulty("normal")), 390, 640), () => 0.3);
    const before = aliveBricks(bricks).length;
    const next = dropRow(bricks, 390, () => 0.2, 3);
    expect(aliveBricks(next).length).toBeGreaterThan(before);
    const fresh = next.slice(bricks.length).filter((brick) => brick.kind === "quiz");
    expect(fresh.every((brick) => brick.tier === 3)).toBe(true);
  });
});

describe("onlyNumbersLeft", () => {
  it("is false while a question or star brick is still standing", () => {
    const bricks = [
      { id: "n", x: 0, y: 0, w: 10, h: 10, hp: 2, maxHp: 2, kind: "hp" as const, alive: true },
      { id: "q", x: 20, y: 0, w: 10, h: 10, hp: 1, maxHp: 1, kind: "quiz" as const, alive: true },
    ];
    expect(onlyNumbersLeft(bricks)).toBe(false);
    bricks[1]!.alive = false;
    expect(onlyNumbersLeft(bricks)).toBe(true);
  });
});

describe("descendBricks", () => {
  it("drops the surviving wall and flags a floor crash", () => {
    const bricks = buildLevel(specForPlan(levelPlan(1, difficulty("normal")), 390, 640), () => 0.3);
    const top = Math.min(...aliveBricks(bricks).map((brick) => brick.y));
    const missed = descendBricks(bricks, 10_000);
    expect(missed.reachedFloor).toBe(false);
    expect(Math.min(...aliveBricks(bricks).map((brick) => brick.y))).toBeGreaterThan(top);
    const crash = descendBricks(bricks, 40);
    expect(crash.reachedFloor).toBe(true);
  });

  it("parks the wall on the danger line instead of sliding through it", () => {
    // A brick below the paddle can never be hit, so the level could never end.
    const bricks = buildLevel(specForPlan(levelPlan(1, difficulty("normal")), 390, 640), () => 0.3);
    const dangerY = 300;
    for (let volley = 0; volley < 20; volley += 1) {
      descendBricks(bricks, dangerY, 5);
      for (const brick of aliveBricks(bricks)) {
        expect(brick.y + brick.h).toBeLessThanOrEqual(dangerY);
      }
    }
  });

  it("reports a floor crash once the wall cannot fall the whole way", () => {
    const bricks = buildLevel(specForPlan(levelPlan(1, difficulty("normal")), 390, 640), () => 0.3);
    let crashed = false;
    for (let volley = 0; volley < 30 && !crashed; volley += 1) {
      crashed = descendBricks(bricks, 300, 2).reachedFloor;
    }
    expect(crashed).toBe(true);
    // And it keeps reporting, so the breach tax applies every volley after.
    expect(descendBricks(bricks, 300, 2).reachedFloor).toBe(true);
  });

  it("drops further when the level asks for more rows a volley", () => {
    const spec = specForPlan(levelPlan(1, difficulty("normal")), 390, 640);
    const slow = buildLevel(spec, () => 0.3);
    const fast = buildLevel(spec, () => 0.3);
    descendBricks(slow, 10_000, 1);
    descendBricks(fast, 10_000, 3);
    expect(Math.min(...aliveBricks(fast).map((b) => b.y))).toBeGreaterThan(
      Math.min(...aliveBricks(slow).map((b) => b.y)),
    );
  });
});

describe("liftBricks", () => {
  it("buys back headroom when a life is spent on a breach", () => {
    const bricks = buildLevel(specForPlan(levelPlan(1, difficulty("normal")), 390, 640), () => 0.3);
    descendBricks(bricks, 10_000, 6);
    const low = Math.max(...aliveBricks(bricks).map((brick) => brick.y));
    liftBricks(bricks, 3);
    expect(Math.max(...aliveBricks(bricks).map((brick) => brick.y))).toBeLessThan(low);
  });

  it("never lifts the wall off the top of the board", () => {
    const bricks = buildLevel(specForPlan(levelPlan(1, difficulty("normal")), 390, 640), () => 0.3);
    liftBricks(bricks, 40);
    expect(Math.min(...aliveBricks(bricks).map((brick) => brick.y))).toBeGreaterThanOrEqual(10);
  });
});
