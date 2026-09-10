import { bindViewportFrame } from "./logic/viewport";
import { App } from "./ui/app";
import "./style.css";

bindViewportFrame(window, document.documentElement.style);

const root = document.querySelector("#app");
if (!root) {
  throw new Error("Mindbreaker needs #app");
}

new App(root as HTMLElement);
