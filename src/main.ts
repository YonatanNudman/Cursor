import { App } from "./ui/app";
import "./style.css";

const root = document.querySelector("#app");
if (!root) {
  throw new Error("Mindbreaker needs #app");
}

new App(root as HTMLElement);
