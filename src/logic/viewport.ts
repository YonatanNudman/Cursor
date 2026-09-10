export interface ViewportPort {
  height: number;
  width: number;
  offsetTop: number;
  offsetLeft?: number;
}

export interface ViewportFallback {
  innerHeight: number;
  innerWidth: number;
}

export interface FrameBox {
  height: number;
  width: number;
  top: number;
  left: number;
}

export interface FrameTarget {
  visualViewport: (ViewportPort & Pick<EventTarget, "addEventListener" | "removeEventListener">) | null;
  innerHeight: number;
  innerWidth: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** Visible phone frame, including Safari/Chrome chrome and the on-screen keyboard. */
export function frameBox(port: ViewportPort | null | undefined, fallback: ViewportFallback): FrameBox {
  return {
    height: Math.max(1, Math.round(port?.height ?? fallback.innerHeight)),
    width: Math.max(1, Math.round(port?.width ?? fallback.innerWidth)),
    top: Math.max(0, Math.round(port?.offsetTop ?? 0)),
    left: Math.max(0, Math.round(port?.offsetLeft ?? 0)),
  };
}

export function applyFrameBox(root: CSSStyleDeclaration, box: FrameBox): void {
  root.setProperty("--frame-h", `${box.height}px`);
  root.setProperty("--frame-w", `${box.width}px`);
  root.setProperty("--vv-top", `${box.top}px`);
  root.setProperty("--vv-left", `${box.left}px`);
}

export function bindViewportFrame(target: FrameTarget, root: CSSStyleDeclaration): () => void {
  const apply = (): void => {
    applyFrameBox(root, frameBox(target.visualViewport, target));
  };
  let rotateWait: ReturnType<typeof setTimeout> | undefined;
  const onRotate = (): void => {
    apply();
    if (rotateWait !== undefined) clearTimeout(rotateWait);
    rotateWait = setTimeout(apply, 280);
  };
  apply();
  target.visualViewport?.addEventListener("resize", apply);
  target.visualViewport?.addEventListener("scroll", apply);
  target.addEventListener("orientationchange", onRotate);
  target.addEventListener("resize", apply);
  return () => {
    if (rotateWait !== undefined) clearTimeout(rotateWait);
    target.visualViewport?.removeEventListener("resize", apply);
    target.visualViewport?.removeEventListener("scroll", apply);
    target.removeEventListener("orientationchange", onRotate);
    target.removeEventListener("resize", apply);
  };
}
