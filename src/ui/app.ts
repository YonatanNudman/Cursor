import { QUESTIONS } from "../data/questions";
import {
  applyEffect,
  attachHooks,
  createWorld,
  drawWorld,
  launchBalls,
  movePaddle,
  stepWorld,
  type BreakerWorld,
} from "../game/breaker";
import { sound } from "../audio";
import { aliveBricks, buildLevel, waveSpec } from "../logic/bricks";
import { pickEffect } from "../logic/effects";
import { brickPoints, formatScore, waveClearBonus } from "../logic/score";
import { preferFresh, readBest, readSeen, rememberSeen, writeBest } from "../logic/seen";
import {
  createTriviaSession,
  drawQuestion,
  gradeAnswer,
  orderedChoices,
  type TriviaSession,
} from "../logic/trivia";
import { assertNever, type Effect, type ScoreCard, type Screen, type TriviaQuestion } from "../types";
import { clear, el } from "./html";

const HOSTS = [
  "The wall wants a word with you.",
  "Pop quiz from a broken brick.",
  "Don't whiff this one.",
  "The table just got academic.",
  "Answer it. The board is listening.",
];

export class App {
  private screen: Screen = "title";
  private best = readBest(window.localStorage);
  private result: ScoreCard | null = null;
  private stopLoop: (() => void) | null = null;
  private unbind: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {
    this.render();
  }

  private go(screen: Screen): void {
    this.teardown();
    this.screen = screen;
    this.render();
  }

  private teardown(): void {
    this.stopLoop?.();
    this.stopLoop = null;
    this.unbind?.();
    this.unbind = null;
  }

  private render(): void {
    clear(this.root);
    switch (this.screen) {
      case "title":
        this.renderTitle();
        break;
      case "play":
        this.playRun();
        break;
      case "result":
        this.renderResult();
        break;
      default:
        assertNever(this.screen);
    }
  }

  private renderTitle(): void {
    const screen = el("div", { class: "screen" }, [
      el("p", { class: "kicker" }, ["One table. Many questions."]),
      el("h1", { class: "title" }, ["Mind", el("span", {}, ["breaker"])]),
      el("p", { class: "lede" }, [
        "Break pink question bricks. A right answer rewrites the table — extra balls, a wider paddle, a fireball. A wrong one makes the wall meaner.",
      ]),
      el("div", { class: "best" }, [el("small", {}, ["Best run"]), formatScore(this.best)]),
      el("div", { class: "rules" }, [
        el("p", {}, [el("b", {}, ["Pink ?"]), " — trivia. Eighteen sections, hundreds of questions. No repeats until the bank is empty."]),
        el("p", {}, [el("b", {}, ["Numbers"]), " — hits left. Some bricks take a beating."]),
        el("p", {}, [el("b", {}, ["Balls"]), " — you only get a few. Drag to aim. Tap to launch."]),
      ]),
      el("div", { class: "actions" }, [
        button("solid", "Play", () => {
          sound.resume();
          this.go("play");
        }),
      ]),
    ]);
    this.root.append(screen);
  }

  private playRun(): void {
    let wave = 1;
    let score = 0;
    let lives = 4;
    let settled = false;
    const session = createTriviaSession(preferFresh(QUESTIONS, readSeen(window.localStorage)));
    const askedThisRun: string[] = [];
    const quizQueue: TriviaQuestion[] = [];
    let asking = false;

    const hud = this.mountPlay();
    const finish = (title: string, detail: string): void => {
      if (settled) return;
      settled = true;
      rememberSeen(window.localStorage, askedThisRun);
      this.best = writeBest(window.localStorage, score);
      this.result = {
        score,
        wave,
        correct: session.correct,
        missed: session.missed,
        title,
        detail,
      };
      this.go("result");
    };

    const startWave = (): void => {
      this.stopLoop?.();
      this.unbind?.();
      const frame = hud.board.getBoundingClientRect();
      const width = Math.max(320, Math.floor(frame.width));
      const height = Math.max(360, Math.floor(frame.height));
      const spec = waveSpec(wave, width, height);
      const world = attachHooks(createWorld(width, height, buildLevel(spec), lives, 4.6 + wave * 0.22), {
        onBrickHit: (brick, broke) => {
          if (!broke) {
            sound.brick();
            return;
          }
          score += brickPoints(brick.maxHp, brick.kind);
          hud.score.textContent = formatScore(score);
          if (brick.kind === "quiz") {
            sound.break();
            const question = drawQuestion(session);
            if (question) {
              askedThisRun.push(question.id);
              quizQueue.push(question);
              maybeAsk(world);
            }
          } else {
            sound.break();
          }
        },
        onBallLost: () => {
          sound.miss();
          lives = world.lives;
          paintBalls(hud.balls, lives);
          if (world.lives <= 0) {
            world.paused = true;
            finish("Out of balls", `You reached wave ${wave}. ${session.correct} right, ${session.missed} wrong.`);
          }
        },
        onBoardClear: () => {
          score += waveClearBonus(wave, world.lives);
          lives = Math.min(6, world.lives + 1);
          sound.win();
          wave += 1;
          hud.wave.textContent = String(wave);
          hud.score.textContent = formatScore(score);
          banner(hud.board, "good", `Wave ${wave - 1} cleared`, "The next wall brought more questions.", () => {
            startWave();
          });
        },
      });
      lives = world.lives;
      paintBalls(hud.balls, lives);
      hud.wave.textContent = String(wave);
      this.bindBreaker(hud.canvas, hud.board, world);
    };

    const maybeAsk = (world: BreakerWorld): void => {
      if (asking || quizQueue.length === 0) return;
      const question = quizQueue.shift();
      if (!question) return;
      asking = true;
      world.paused = true;
      showQuiz(hud.board, question, session, world, (correct, effect) => {
        const broken = applyEffect(world, effect, performance.now());
        for (const brick of broken) {
          if (brick.kind === "quiz") {
            const extra = drawQuestion(session);
            if (extra) {
              askedThisRun.push(extra.id);
              quizQueue.push(extra);
            }
          } else {
            score += brickPoints(brick.maxHp, "hp");
          }
        }
        lives = world.lives;
        paintBalls(hud.balls, lives);
        hud.score.textContent = formatScore(score);
        hud.streak.textContent = String(session.streak);
        if (world.lives <= 0) {
          asking = false;
          finish("The question took the last ball", `${session.correct} right, ${session.missed} wrong.`);
          return;
        }
        banner(hud.board, effect.tone, effect.headline, effect.detail, () => {
          asking = false;
          world.paused = false;
          maybeAsk(world);
        });
        void correct;
      });
    };

    startWave();
  }

  private mountPlay(): {
    board: HTMLElement;
    canvas: HTMLCanvasElement;
    score: HTMLElement;
    wave: HTMLElement;
    streak: HTMLElement;
    balls: HTMLElement;
  } {
    const score = el("b", {}, ["0"]);
    const wave = el("b", {}, ["1"]);
    const streak = el("b", {}, ["0"]);
    const balls = el("div", { class: "balls" });
    const canvas = el("canvas");
    const board = el("div", { class: "board" }, [canvas]);
    this.root.append(
      el("div", { class: "play" }, [
        el("div", { class: "hud" }, [
          el("div", { class: "stat" }, ["Score", score]),
          el("div", { class: "stat" }, ["Wave", wave]),
          el("div", { class: "stat" }, ["Streak", streak]),
          balls,
        ]),
        board,
        el("div", { class: "foot" }, [
          el("span", {}, ["Pink ? = trivia  ·  numbers = hits"]),
          button("ghost tiny", "Quit", () => this.go("title")),
        ]),
      ]),
    );
    return { board, canvas, score, wave, streak, balls };
  }

  private renderResult(): void {
    const card = this.result;
    if (!card) {
      this.go("title");
      return;
    }
    this.root.append(
      el("div", { class: "screen result" }, [
        el("p", { class: "kicker" }, [card.missed + card.correct > 0 ? "Table over" : "Walked away"]),
        el("h2", {}, [card.title]),
        el("p", {}, [card.detail]),
        el("p", { class: "big" }, [formatScore(card.score)]),
        el("p", { class: "kicker" }, [`Best ${formatScore(this.best)}  ·  wave ${card.wave}`]),
        el("div", { class: "actions" }, [
          button("solid", "One more run", () => this.go("play")),
          button("ghost", "Home", () => this.go("title")),
        ]),
      ]),
    );
  }

  private bindBreaker(canvas: HTMLCanvasElement, board: HTMLElement, world: BreakerWorld): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = (): void => {
      const ratio = window.devicePixelRatio || 1;
      const rect = board.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    scale();

    const pointX = (event: PointerEvent): number => {
      const rect = canvas.getBoundingClientRect();
      return ((event.clientX - rect.left) / rect.width) * world.width;
    };

    let pointerId: number | null = null;
    const release = (): void => {
      if (pointerId === null) return;
      try {
        canvas.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
      pointerId = null;
    };

    const onMove = (event: PointerEvent): void => {
      if (world.paused) {
        release();
        return;
      }
      event.preventDefault();
      movePaddle(world, pointX(event));
    };
    const onDown = (event: PointerEvent): void => {
      if (world.paused) return;
      event.preventDefault();
      sound.resume();
      movePaddle(world, pointX(event));
      launchBalls(world);
      pointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
    };
    const onUp = (): void => release();
    const onKey = (event: KeyboardEvent): void => {
      if (world.paused) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        launchBalls(world);
      }
      if (event.key === "ArrowLeft") movePaddle(world, world.paddle.x + world.paddle.w / 2 - 32);
      if (event.key === "ArrowRight") movePaddle(world, world.paddle.x + world.paddle.w / 2 + 32);
    };

    canvas.addEventListener("pointermove", onMove, { passive: false });
    canvas.addEventListener("pointerdown", onDown, { passive: false });
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", scale);

    let last = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      if (world.paused) release();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      stepWorld(world, dt, now);
      drawWorld(ctx, world, now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    this.stopLoop = () => cancelAnimationFrame(raf);
    this.unbind = () => {
      release();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", scale);
    };
  }
}

function button(kind: string, label: string, onClick: () => void): HTMLButtonElement {
  const btn = el("button", { class: kind, type: "button" }, [label]);
  btn.addEventListener("click", onClick);
  return btn;
}

function paintBalls(node: HTMLElement, lives: number): void {
  clear(node);
  const max = Math.max(4, lives);
  for (let i = 0; i < max; i += 1) {
    node.append(el("span", { class: i < lives ? "ball" : "ball gone" }));
  }
}

function banner(host: HTMLElement, tone: "good" | "bad", title: string, detail: string, then: () => void): void {
  const overlay = el("div", { class: "overlay" }, [
    el("div", { class: `panel ${tone}` }, [el("h3", {}, [title]), el("p", {}, [detail])]),
  ]);
  host.append(overlay);
  window.setTimeout(() => {
    overlay.remove();
    then();
  }, 1100);
}

function showQuiz(
  host: HTMLElement,
  question: TriviaQuestion,
  session: TriviaSession,
  world: BreakerWorld,
  done: (correct: boolean, effect: Effect) => void,
): void {
  const drawn = orderedChoices(question);
  let locked = false;
  let left = 14;
  const bar = el("i");
  const overlay = el("div", { class: "overlay" });
  const finish = (choice: number, btn?: HTMLButtonElement): void => {
    if (locked) return;
    locked = true;
    window.clearInterval(timer);
    const result = gradeAnswer(session, { ...question, answer: drawn.answer }, choice);
    if (btn) btn.classList.add(result.correct ? "good" : "bad");
    if (result.correct) sound.correct();
    else sound.wrong();
    const now = performance.now();
    const effect = pickEffect(result.correct, result.streak, {
      lives: world.lives,
      bricksAlive: aliveBricks(world.bricks).length,
      ballsInPlay: world.balls.length,
      alreadyWobbly: now < world.wobbleUntil,
      alreadyFireball: now < world.fireballUntil,
    });
    window.setTimeout(() => {
      overlay.remove();
      done(result.correct, effect);
    }, 420);
  };

  overlay.append(
    el("div", { class: "panel" }, [
      el("p", { class: "meta" }, [`${HOSTS[Math.floor(Math.random() * HOSTS.length)]}  ·  ${question.category}`]),
      el("h2", {}, [question.question]),
      el("div", { class: "choices" },
        drawn.labels.map((label, index) => {
          const btn = button("choice", label, () => finish(index, btn));
          return btn;
        }),
      ),
      el("div", { class: "timer" }, [bar]),
    ]),
  );
  host.append(overlay);

  const timer = window.setInterval(() => {
    left -= 1;
    bar.style.width = `${(left / 14) * 100}%`;
    if (left <= 0) finish(-1);
  }, 1000);
}
