import { QUESTIONS } from "../data/questions";
import {
  AIM_UP,
  aimAt,
  applyEffect,
  attachHooks,
  clearAim,
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
import { QUIZ_COOLDOWN_MS, canQueueQuiz } from "../logic/quiz-gate";
import {
  brickPoints,
  formatScore,
  isMilestone,
  streakLabel,
  streakMultiplier,
  waveClearBonus,
} from "../logic/score";
import { preferFresh, readBest, readSeen, rememberSeen, writeBest } from "../logic/seen";
import { readSettings, writeSettings, type RunSettings } from "../logic/settings";
import {
  allDifficulties,
  difficulty,
  type DifficultyName,
  type DifficultyPreset,
} from "../logic/difficulty";
import {
  createTriviaSession,
  drawQuestion,
  gradeAnswer,
  orderedChoices,
  type TriviaSession,
} from "../logic/trivia";
import { assertNever, type Effect, type ScoreCard, type Screen, type TriviaQuestion } from "../types";
import { clear, el } from "./html";

const COACHED_KEY = "mindbreaker.coached";

const HOSTS = [
  "The wall wants a word with you.",
  "Pop quiz from a broken brick.",
  "Don't whiff this one.",
  "The table just got academic.",
  "Answer it. The board is listening.",
];

export class App {
  private screen: Screen = "play";
  private best = readBest(window.localStorage);
  private settings: RunSettings = readSettings(window.localStorage);
  private result: ScoreCard | null = null;
  private stopLoop: (() => void) | null = null;
  private unbind: (() => void) | null = null;
  private world: BreakerWorld | null = null;
  private boardHost: HTMLElement | null = null;
  private paused = false;
  private asking = false;

  constructor(private readonly root: HTMLElement) {
    this.render();
  }

  private go(screen: Screen): void {
    this.teardown();
    this.screen = screen;
    this.render();
  }

  private teardown(): void {
    this.world = null;
    this.boardHost = null;
    this.paused = false;
    this.asking = false;
    this.stopLoop?.();
    this.stopLoop = null;
    this.unbind?.();
    this.unbind = null;
  }

  private render(): void {
    clear(this.root);
    switch (this.screen) {
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

  private preset(): DifficultyPreset {
    return difficulty(this.settings.difficulty);
  }

  private playRun(): void {
    const preset = this.preset();
    let wave = 1;
    let score = 0;
    let lives: number = preset.lives;
    let settled = false;
    const session = createTriviaSession(preferFresh(QUESTIONS, readSeen(window.localStorage)));
    const askedThisRun: string[] = [];
    const quizQueue: TriviaQuestion[] = [];
    let asking = false;
    let wavePending = false;
    let quizReadyAt = 0;
    let bricksSinceQuiz = 0;

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
      const world = attachHooks(
        createWorld(width, height, buildLevel(spec), lives, (5.4 + wave * 0.3) * preset.ballSpeed, preset.tableBalls),
        {
        onBrickHit: (brick, broke) => {
          if (!broke) {
            sound.brick();
            return;
          }
          score +=
            brickPoints(brick.maxHp, brick.kind) *
            preset.weight *
            streakMultiplier(session.streak);
          hud.score.textContent = formatScore(score);
          bricksSinceQuiz += 1;
          sound.break();
          if (brick.kind === "quiz") {
            const ready = performance.now() >= quizReadyAt;
            if (canQueueQuiz(asking, quizQueue.length, ready, bricksSinceQuiz)) {
              const question = drawQuestion(session, wave);
              if (question) {
                bricksSinceQuiz = 0;
                askedThisRun.push(question.id);
                quizQueue.push(question);
                maybeAsk(world);
              }
            }
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
          wavePending = true;
          if (!asking) finishWave(world);
        },
      });
      lives = world.lives;
      this.world = world;
      paintBalls(hud.balls, lives);
      hud.wave.textContent = String(wave);
      this.bindBreaker(hud.canvas, hud.board, world);
    };

    const maybeAsk = (world: BreakerWorld): void => {
      if (asking || quizQueue.length === 0) return;
      const question = quizQueue.shift();
      if (!question) return;
      asking = true;
      this.asking = true;
      world.paused = true;
      showQuiz(hud.board, question, session, world, (correct, effect, points) => {
        const before = score;
        score += points * preset.weight;
        const broken = applyEffect(world, effect, performance.now());
        for (const brick of broken) {
          score +=
            brickPoints(brick.maxHp, brick.kind) *
            preset.weight *
            streakMultiplier(session.streak);
        }
        const gained = score - before;
        lives = world.lives;
        paintBalls(hud.balls, lives);
        hud.score.textContent = formatScore(score);
        hud.streak.textContent = String(session.streak);
        paintCombo(hud.combo, session.streak);
        if (correct) {
          floatPoints(hud.board, `+${formatScore(gained)}`, "good");
          if (isMilestone(session.streak)) celebrate(hud.board, session.streak);
        }
        if (world.lives <= 0) {
          asking = false;
          this.asking = false;
          finish("The question took the last ball", `${session.correct} right, ${session.missed} wrong.`);
          return;
        }
        banner(hud.board, effect.tone, effect.headline, effect.detail, () => {
          asking = false;
          this.asking = false;
          quizReadyAt = performance.now() + QUIZ_COOLDOWN_MS;
          if (wavePending) {
            finishWave(world);
            return;
          }
          if (!this.paused) world.paused = false;
          maybeAsk(world);
        });
        void correct;
      });
    };

    const finishWave = (world: BreakerWorld): void => {
      if (!wavePending || asking) return;
      wavePending = false;
      quizQueue.length = 0;
      score += waveClearBonus(wave, world.lives) * preset.weight;
      lives = preset.lifePerWave ? Math.min(12, world.lives + 1) : world.lives;
      sound.win();
      wave += 1;
      hud.wave.textContent = String(wave);
      hud.score.textContent = formatScore(score);
      banner(hud.board, "good", `Wave ${wave - 1} cleared`, "The next wall brought more questions.", () => {
        startWave();
      });
    };

    startWave();

    if (!localStorage.getItem(COACHED_KEY)) {
      const hint = el("div", { class: "coach" }, [
        el("b", {}, ["Hold to aim"]),
        el("small", {}, ["Release to fire. Then drag to move the paddle."]),
      ]);
      hud.board.append(hint);
      const dismiss = (): void => {
        hint.remove();
        try {
          localStorage.setItem(COACHED_KEY, "1");
        } catch {
          /* private mode, show it again next time */
        }
      };
      hud.board.addEventListener("pointerdown", dismiss, { once: true });
      window.setTimeout(dismiss, 6000);
    }
  }

  private mountPlay(): {
    board: HTMLElement;
    canvas: HTMLCanvasElement;
    score: HTMLElement;
    wave: HTMLElement;
    streak: HTMLElement;
    combo: HTMLElement;
    balls: HTMLElement;
  } {
    const score = el("b", {}, ["0"]);
    const wave = el("b", {}, ["1"]);
    const streak = el("b", {}, ["0"]);
    const combo = el("div", { class: "combo" });
    const balls = el("div", { class: "balls" });
    const canvas = el("canvas");
    const board = el("div", { class: "board" }, [canvas]);
    this.boardHost = board;
    this.root.append(
      el("div", { class: "play" }, [
        el("div", { class: "hud" }, [
          el("div", { class: "stat" }, ["Score", score]),
          el("div", { class: "stat" }, ["Wave", wave]),
          el("div", { class: "stat" }, ["Streak", streak]),
          combo,
          balls,
        ]),
        board,
        el("div", { class: "foot" }, [
          el("span", { class: "level-tag" }, [this.preset().label]),
          button("ghost tiny", "Pause", () => this.openPause()),
        ]),
      ]),
    );
    return { board, canvas, score, wave, streak, combo, balls };
  }

  private renderResult(): void {
    const card = this.result;
    if (!card) {
      this.go("play");
      return;
    }
    const asked = card.correct + card.missed;
    const accuracy = asked > 0 ? Math.round((card.correct / asked) * 100) : 0;
    const beat = card.score >= this.best && card.score > 0;
    this.root.append(
      el("div", { class: "screen result" }, [
        el("p", { class: "kicker" }, [beat ? "New best" : "Run over"]),
        el("h2", {}, [card.title]),
        el("p", {}, [card.detail]),
        el("p", { class: "big" }, [formatScore(card.score)]),
        el("div", { class: "tally" }, [
          stat("Wave", String(card.wave)),
          stat("Right", String(card.correct)),
          stat("Accuracy", asked > 0 ? `${accuracy}%` : "--"),
          stat("Best", formatScore(this.best)),
        ]),
        this.levelPicker(),
        el("div", { class: "actions" }, [
          button("solid cta", "Play again", () => this.go("play")),
        ]),
      ]),
    );
  }

  /** Difficulty lives where you actually choose it: after a loss, and on pause. */
  private levelPicker(): HTMLElement {
    const row = el("div", { class: "levels" });
    const paint = (): void => {
      clear(row);
      for (const level of allDifficulties()) {
        const on = level.name === this.settings.difficulty;
        const chip = button(on ? "level on" : "level", "", () => {
          this.patchSettings({ difficulty: level.name });
          paint();
        });
        chip.append(el("b", {}, [level.label]), el("small", {}, [level.blurb]));
        row.append(chip);
      }
    };
    paint();
    return row;
  }

  private openPause(): void {
    const world = this.world;
    if (!world || this.paused) return;
    this.paused = true;
    world.paused = true;
    const overlay = el("div", { class: "overlay" });
    const close = (): void => {
      overlay.remove();
      this.paused = false;
      if (!this.asking) world.paused = false;
    };
    overlay.append(
      el("div", { class: "panel" }, [
        el("h3", {}, ["Paused"]),
        this.levelPicker(),
        el("p", { class: "note" }, ["Changing the level starts a fresh run."]),
        el("div", { class: "actions" }, [
          button("solid", "Resume", close),
          button("ghost", "Restart", () => {
            overlay.remove();
            this.paused = false;
            this.go("play");
          }),
        ]),
      ]),
    );
    this.boardHost?.append(overlay);
  }

  private patchSettings(partial: Partial<RunSettings>): void {
    this.settings = writeSettings(window.localStorage, { ...this.settings, ...partial });
  }

  private picker<T extends number>(
    label: string,
    values: readonly T[],
    current: T,
    onPick: (value: T) => void,
    format: (value: T) => string = String,
  ): HTMLElement {
    const row = el("div", { class: "picker" }, [el("span", { class: "picker-label" }, [label])]);
    const chips = el("div", { class: "chips" });
    const paint = (): void => {
      clear(chips);
      for (const value of values) {
        const chip = button(value === current ? "chip on" : "chip", format(value), () => {
          current = value;
          onPick(value);
          paint();
        });
        chips.append(chip);
      }
    };
    paint();
    row.append(chips);
    return row;
  }

  private bindBreaker(
    canvas: HTMLCanvasElement,
    board: HTMLElement,
    world: BreakerWorld,
  ): void {
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
    const pointY = (event: PointerEvent): number => {
      const rect = canvas.getBoundingClientRect();
      return ((event.clientY - rect.top) / rect.height) * world.height;
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

    // Two gestures on one surface, decided by whether a ball is waiting. Holding
    // with a ball on the paddle draws a shot and releasing fires it; once the
    // ball is loose the same drag steers the paddle.
    let aiming = false;

    const onMove = (event: PointerEvent): void => {
      if (world.paused) {
        release();
        return;
      }
      event.preventDefault();
      if (aiming) {
        aimAt(world, pointX(event), pointY(event));
        return;
      }
      movePaddle(world, pointX(event));
    };

    const onDown = (event: PointerEvent): void => {
      if (world.paused) return;
      event.preventDefault();
      sound.resume();
      pointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      if (world.balls.some((ball) => ball.stuck)) {
        aiming = true;
        aimAt(world, pointX(event), pointY(event));
        return;
      }
      movePaddle(world, pointX(event));
    };

    const onUp = (): void => {
      if (aiming) {
        aiming = false;
        if (world.aim === null) {
          // A tap with no drag still fires, straight up.
          launchBalls(world, AIM_UP);
        } else {
          launchBalls(world);
        }
        sound.resume();
      }
      release();
    };

    const onCancel = (): void => {
      aiming = false;
      clearAim(world);
      release();
    };

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
    canvas.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", scale);

    let last = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      if (world.paused) release();
      // Real time. Difficulty changes how fast the ball is, not how fast the
      // clock runs, so physics stays stable at every level.
      const frame = Math.min(0.033, (now - last) / 1000);
      last = now;
      const steps = Math.max(1, Math.ceil(frame / 0.016));
      const slice = frame / steps;
      for (let i = 0; i < steps; i += 1) {
        stepWorld(world, slice, now);
      }
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
      canvas.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", scale);
    };
  }
}

function stat(label: string, value: string): HTMLElement {
  return el("div", { class: "tally-cell" }, [el("small", {}, [label]), el("b", {}, [value])]);
}

function button(kind: string, label: string, onClick: () => void): HTMLButtonElement {
  const btn = el("button", { class: kind, type: "button" }, [label]);
  btn.addEventListener("click", onClick);
  return btn;
}

function paintBalls(node: HTMLElement, lives: number): void {
  clear(node);
  if (lives > 8) {
    node.append(el("span", { class: "ball" }), el("span", { class: "ball-count" }, [`×${lives}`]));
    return;
  }
  const max = Math.max(4, lives);
  for (let i = 0; i < max; i += 1) {
    node.append(el("span", { class: i < lives ? "ball" : "ball gone" }));
  }
}

function paintCombo(node: HTMLElement, streak: number): void {
  const multiplier = streakMultiplier(streak);
  clear(node);
  if (multiplier <= 1) {
    node.className = "combo";
    return;
  }
  node.className = `combo on tier-${multiplier}`;
  node.append(
    el("b", {}, [`\u00d7${multiplier}`]),
    el("small", {}, [streakLabel(streak)]),
  );
}

/** A number that leaps off the board and fades. Pure reward, no information. */
function floatPoints(host: HTMLElement, text: string, tone: "good" | "bad"): void {
  const pop = el("div", { class: `pop ${tone}` }, [text]);
  host.append(pop);
  window.setTimeout(() => pop.remove(), 900);
}

function celebrate(host: HTMLElement, streak: number): void {
  const flash = el("div", { class: "milestone" }, [
    el("b", {}, [`${streak} IN A ROW`]),
    el("small", {}, [streakLabel(streak)]),
  ]);
  host.append(flash);
  window.setTimeout(() => flash.remove(), 1000);
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
  done: (correct: boolean, effect: Effect, points: number) => void,
): void {
  const drawn = orderedChoices(question);
  let locked = false;
  let left = 14;
  const bar = el("i");
  const overlay = el("div", { class: "overlay" });
  const buttons: HTMLButtonElement[] = drawn.labels.map((label, index) => {
    const btn: HTMLButtonElement = button("choice", label, () => finish(index, btn));
    return btn;
  });
  const finish = (choice: number, btn?: HTMLButtonElement): void => {
    if (locked) return;
    locked = true;
    window.clearInterval(timer);
    const result = gradeAnswer(session, { ...question, answer: drawn.answer }, choice);
    if (btn) btn.classList.add(result.correct ? "good" : "bad");
    // Always show which one was right. Being punished without being told the
    // answer is the least satisfying way to lose a question.
    if (!result.correct) {
      buttons[drawn.answer]?.classList.add("reveal");
    }
    for (const other of buttons) other.disabled = true;
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
    window.setTimeout(
      () => {
        overlay.remove();
        done(result.correct, effect, result.points);
      },
      result.correct ? 420 : 1150,
    );
  };

  overlay.append(
    el("div", { class: "panel" }, [
      el("p", { class: "meta" }, [`${HOSTS[Math.floor(Math.random() * HOSTS.length)]}  ·  ${question.category}`]),
      el("h2", {}, [question.question]),
      el("div", { class: "choices" }, buttons),
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
