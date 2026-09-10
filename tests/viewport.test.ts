import { describe, expect, it, vi } from "vitest";
import { applyFrameBox, bindViewportFrame, frameBox } from "../src/logic/viewport";

describe("visible phone frame", () => {
  it("uses the visual viewport when the browser chrome eats the page", () => {
    expect(
      frameBox(
        { height: 640.4, width: 374.6, offsetTop: 47.2, offsetLeft: 12.8 },
        { innerHeight: 800, innerWidth: 390 },
      ),
    ).toEqual({ height: 640, width: 375, top: 47, left: 13 });
  });

  it("falls back to the window when visualViewport is missing", () => {
    expect(frameBox(null, { innerHeight: 667, innerWidth: 375 })).toEqual({
      height: 667,
      width: 375,
      top: 0,
      left: 0,
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
      { height: 720, width: 360, top: 12, left: 4 },
    );
    expect(props.get("--frame-h")).toBe("720px");
    expect(props.get("--frame-w")).toBe("360px");
    expect(props.get("--vv-top")).toBe("12px");
    expect(props.get("--vv-left")).toBe("4px");
  });

  it("remeasures after orientationchange once the new frame settles", () => {
    vi.useFakeTimers();
    const listeners = new Map<string, Array<() => void>>();
    let height = 667;
    const target = {
      visualViewport: {
        get height() {
          return height;
        },
        width: 375,
        offsetTop: 0,
        offsetLeft: 0,
        addEventListener(type: string, listener: () => void) {
          listeners.set(`vv:${type}`, [...(listeners.get(`vv:${type}`) ?? []), listener]);
        },
        removeEventListener() {},
      },
      get innerHeight() {
        return height;
      },
      innerWidth: 375,
      addEventListener(type: string, listener: () => void) {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener() {},
    };
    const props = new Map<string, string>();
    const stop = bindViewportFrame(
      target,
      {
        setProperty: (name: string, value: string) => {
          props.set(name, value);
        },
      } as CSSStyleDeclaration,
    );
    expect(props.get("--frame-h")).toBe("667px");
    height = 375;
    for (const listener of listeners.get("orientationchange") ?? []) listener();
    expect(props.get("--frame-h")).toBe("375px");
    height = 390;
    vi.advanceTimersByTime(280);
    expect(props.get("--frame-h")).toBe("390px");
    stop();
    vi.useRealTimers();
  });
});
