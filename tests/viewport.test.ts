import { describe, expect, it } from "vitest";
import { applyFrameBox, frameBox } from "../src/logic/viewport";

describe("visible phone frame", () => {
  it("uses the visual viewport when the browser chrome eats the page", () => {
    expect(
      frameBox({ height: 640.4, width: 374.6, offsetTop: 47.2 }, { innerHeight: 800, innerWidth: 390 }),
    ).toEqual({ height: 640, width: 375, top: 47 });
  });

  it("falls back to the window when visualViewport is missing", () => {
    expect(frameBox(null, { innerHeight: 667, innerWidth: 375 })).toEqual({
      height: 667,
      width: 375,
      top: 0,
    });
  });

  it("writes CSS custom properties the layout shell reads", () => {
    const props = new Map<string, string>();
    applyFrameBox(
      {
        setProperty: (name: string, value: string) => {
          props.set(name, value);
        },
      } as CSSStyleDeclaration,
      { height: 720, width: 360, top: 12 },
    );
    expect(props.get("--frame-h")).toBe("720px");
    expect(props.get("--frame-w")).toBe("360px");
    expect(props.get("--vv-top")).toBe("12px");
  });
});
