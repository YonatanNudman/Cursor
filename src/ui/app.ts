import { QUESTIONS } from "../data/questions";
import {
  AIM_UP,
  aimAt,
  applyEffect,
  attachHooks,
  beginSweep,
  clearAim,
  createWorld,
  drawWorld,
  launchBalls,
  movePaddle,
  restockCannon,
  stepWorld,
  type BreakerWorld,
} from "../game/breaker";
import { sound, type GoofKind } from "../audio";
import { aliveBricks, buildLevel, descendBricks, onlyNumbersLeft, waveSpec } from "../logic/bricks";
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
import {
  beatsRecord,
  claimWorldRecord,
  formatHolder,
  formatReach,
  hasHolder,
  loadWorldRecord,
  readLocalRecord,
  type WorldRecord,
} from "../logic/record";
import { preferFresh, readBest, readSeen, rememberSeen, writeBest } from "../logic/seen";
import {
  CANNON_AMMO,
  PLAY_SPEEDS,
  QUESTION_FLOORS,
  START_WAVES,
  floorHint,
  floorLabel,
  modeHint,
  modeLabel,
  readSettings,
  toggleCategory,
  writeSettings,
  type CannonAmmo,
  type PlaySpeed,
  type QuestionFloor,
  type RunSettings,
  type StartWave,
} from "../logic/settings";
import { allDifficulties, difficulty, type DifficultyPreset } from "../logic/difficulty";
import {
  createTriviaSession,
  drawQuestion,
  filterBank,
  gradeAnswer,
  orderedChoices,
  type TriviaSession,
} from "../logic/trivia";
import {
  TRIVIA_CATEGORIES,
  assertNever,
  type Effect,
  type ScoreCard,
  type Screen,
  type TriviaQuestion,
} from "../types";
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
  private screen: Screen = "setup";
  private best = readBest(window.localStorage);
  private record: WorldRecord = readLocalRecord(window.localStorage);
  private claimedThisRun = false;
  private settings: RunSettings = readSettings(window.localStorage);
  private playSpeed: PlaySpeed = readSettings(window.localStorage).playSpeed;
  private result: ScoreCard | null = null;
  private stopLoop: (() => void) | null = null;
  private unbind: (() => void) | null = null;
  private world: BreakerWorld | null = null;
  private endRun: ((title: string, detail: string) => void) | null = null;
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
    this.endRun = null;
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
      case "setup":
        this.renderSetup();
        void this.refreshRecord();
        break;
      case "play":
        this.playRun();
        break;
      case "result":
        this.renderResult();
        void this.refreshRecord();
        break;
      default:
        assertNever(this.screen);
    }
  }

  private preset(): DifficultyPreset {
    return difficulty(this.settings.difficulty);
  }

  private renderSetup(): void {
    this.root.append(
      el("div", { class: "screen setup" }, [
        el("div", { class: "sheet" }, [
          el("p", { class: "kicker" }, ["Mindbreaker"]),
          el("h1", { class: "title" }, ["Pick a", el("span", {}, [" table"])]),
          el("p", { class: "lede" }, [
            "Cannon fires a magazine, then the wall drops. Paddle keeps the old fight. Harder questions pay more and thicken the numbered bricks.",
          ]),
          el("p", { class: "best" }, [
            formatScore(this.best),
            el("small", {}, ["Best"]),
          ]),
          this.recordPlaque(),
          this.modePicker(),
          this.levelPicker(),
          this.wavePicker(),
          this.floorPicker(),
          this.ammoPicker(),
          this.categoryPicker(),
        ]),
        el("div", { class: "actions" }, [button("solid cta", "Play", () => this.go("play"))]),
      ]),
    );
  }

  private playRun(): void {
    const preset = this.preset();
    const settings = this.settings;
    this.playSpeed = settings.playSpeed;
    let wave = settings.startWave;
    let score = 0;
    let lives: number = preset.lives;
    let settled = false;
    const bank = filterBank(QUESTIONS, settings.categories, settings.questionFloor);
    const session = createTriviaSession(preferFresh(bank, readSeen(window.localStorage)));
    const askedThisRun: string[] = [];
    const quizQueue: TriviaQuestion[] = [];
    let asking = false;
    let wavePending = false;
    let quizReadyAt = 0;
    let bricksSinceQuiz = 0;

    const hud = this.mountPlay();
    const paintAmmo = (world: BreakerWorld): void => {
      if (!hud.ammo) return;
      hud.ammo.textContent = String(world.ammoLeft);
    };

    this.claimedThisRun = false;

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
    this.endRun = finish;

    const startWave = (): void => {
      this.stopLoop?.();
      this.unbind?.();
      const frame = hud.board.getBoundingClientRect();
      const width = Math.max(320, Math.floor(frame.width));
      const height = Math.max(360, Math.floor(frame.height));
      const spec = waveSpec(
        wave,
        width,
        height,
        preset,
        settings.questionFloor,
        settings.mode,
        settings.cannonAmmo,
      );
      const wavePush = 0.2 + preset.weight * 0.05;
      const world = attachHooks(
        createWorld(
          width,
          height,
          buildLevel(spec),
          lives,
          (5.2 + wave * wavePush) * preset.ballSpeed,
          preset.tableBalls,
          { mode: settings.mode, magazine: settings.cannonAmmo },
        ),
        {
          onBrickHit: (brick, broke) => {
            if (!broke) {
              sound.brick();
              gagPop(hud.board, sound.maybeGoof(0.04));
              return;
            }
            score +=
              brickPoints(brick.maxHp, brick.kind) * preset.weight * streakMultiplier(session.streak);
            hud.score.textContent = formatScore(score);
            bricksSinceQuiz += 1;
            sound.break();
            gagPop(hud.board, sound.maybeGoof(0.08));
            if (brick.kind === "quiz") {
              const ready = performance.now() >= quizReadyAt;
              if (canQueueQuiz(asking, quizQueue.length, ready, bricksSinceQuiz)) {
                const question = drawQuestion(session, wave, Math.random, settings.questionFloor);
                if (question) {
                  bricksSinceQuiz = 0;
                  askedThisRun.push(question.id);
                  quizQueue.push(question);
                  maybeAsk(world);
                }
              }
            }
            trySweep(world);
          },
          onBallLost: () => {
            sound.miss();
            gagPop(hud.board, sound.maybeGoof(0.35));
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
          onVolleyEnd: () => {
            paintAmmo(world);
            if (world.cleared || wavePending) {
              if (!asking) finishWave(world);
              return;
            }
            if (trySweep(world)) return;
            const { reachedFloor } = descendBricks(world.bricks, world.paddle.y - 6);
            world.shake = 10;
            floatPoints(hud.board, "WALL DROPS", "bad");
            gagPop(hud.board, sound.maybeGoof(0.4));
            if (reachedFloor) {
              world.paused = true;
              finish("The wall reached the floor", `Wave ${wave}. ${session.correct} right, ${session.missed} wrong.`);
              return;
            }
            restockCannon(world, settings.cannonAmmo);
            paintAmmo(world);
          },
        },
      );
      lives = world.lives;
      this.world = world;
      paintBalls(hud.balls, lives);
      paintAmmo(world);
      hud.wave.textContent = String(wave);
      this.bindBreaker(hud.canvas, hud.board, world, paintAmmo);
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
            brickPoints(brick.maxHp, brick.kind) * preset.weight * streakMultiplier(session.streak);
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
          if (trySweep(world)) return;
          maybeAsk(world);
        });
        void correct;
      });
    };

    const trySweep = (world: BreakerWorld): boolean => {
      if (asking || this.paused || world.cleared || wavePending) return false;
      if (!onlyNumbersLeft(world.bricks)) return false;
      if (!beginSweep(world)) return false;
      paintAmmo(world);
      floatPoints(hud.board, "BURN THE REST", "good");
      gagPop(hud.board, sound.maybeGoof(0.55));
      return true;
    };

    const finishWave = (world: BreakerWorld): void => {
      if (!wavePending || asking) return;
      wavePending = false;
      quizQueue.length = 0;
      score += waveClearBonus(wave, world.lives) * preset.weight;
      lives = preset.lifePerWave ? Math.min(12, world.lives + 1) : world.lives;
      sound.win();
      gagPop(hud.board, sound.maybeGoof(0.45));
      wave += 1;
      hud.wave.textContent = String(wave);
      hud.score.textContent = formatScore(score);
      banner(hud.board, "good", `Wave ${wave - 1} cleared`, "The next wall brought more questions.", () => {
        startWave();
      });
    };

    startWave();

    if (!localStorage.getItem(COACHED_KEY)) {
      const cannon = settings.mode === "cannon";
      const hint = el("div", { class: "coach" }, [
        el("b", {}, [cannon ? "Hold to aim the cannon" : "Hold to aim"]),
        el("small", {}, [
          cannon
            ? "Release to empty the magazine. Rows drop when the volley ends."
            : "Release to fire. Then drag to move the paddle.",
        ]),
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
    ammo: HTMLElement | null;
  } {
    const score = el("b", {}, ["0"]);
    const wave = el("b", {}, [String(this.settings.startWave)]);
    const streak = el("b", {}, ["0"]);
    const combo = el("div", { class: "combo" });
    const balls = el("div", { class: "balls" });
    const ammo = this.settings.mode === "cannon" ? el("b", {}, [String(this.settings.cannonAmmo)]) : null;
    const canvas = el("canvas");
    const board = el("div", { class: "board" }, [canvas]);
    this.boardHost = board;
    const hudBits = [
      el("div", { class: "stat" }, ["Score", score]),
      el("div", { class: "stat" }, ["Wave", wave]),
      el("div", { class: "stat" }, ["Streak", streak]),
    ];
    if (ammo) hudBits.push(el("div", { class: "stat" }, ["Ammo", ammo]));
    hudBits.push(combo, balls);
    const footKids: HTMLElement[] = [
      el("span", { class: "level-tag" }, [`${modeLabel(this.settings.mode)} · ${this.preset().label}`]),
    ];
    if (this.settings.mode === "cannon") {
      footKids.push(this.speedPicker());
    }
    footKids.push(button("ghost tiny", "Pause", () => this.openPause()));
    this.root.append(
      el("div", { class: "play" }, [
        el("div", { class: "hud" }, hudBits),
        board,
        el("div", { class: "foot" }, footKids),
      ]),
    );
    return { board, canvas, score, wave, streak, combo, balls, ammo };
  }

  private renderResult(): void {
    const card = this.result;
    if (!card) {
      this.go("setup");
      return;
    }
    const asked = card.correct + card.missed;
    const accuracy = asked > 0 ? Math.round((card.correct / asked) * 100) : 0;
    const beat = card.score >= this.best && card.score > 0;
    const worldBeat = beatsRecord(card.score, this.record);
    const kicker = this.claimedThisRun
      ? "You hold it"
      : worldBeat
        ? "New world record"
        : beat
          ? "New best"
          : "Run over";
    const kids: HTMLElement[] = [
      el("p", { class: "kicker" }, [kicker]),
      el("h2", {}, [card.title]),
      el("p", {}, [card.detail]),
      el("p", { class: "big" }, [formatScore(card.score)]),
      el("div", { class: "tally" }, [
        stat("Wave", String(card.wave)),
        stat("Right", String(card.correct)),
        stat("Accuracy", asked > 0 ? `${accuracy}%` : "--"),
        stat("Best", formatScore(this.best)),
      ]),
      this.recordPlaque(),
    ];
    const claim = this.claimBox(card);
    if (claim) kids.push(claim);
    kids.push(
      this.modePicker(),
      this.levelPicker(),
      this.wavePicker(),
      this.floorPicker(),
      this.ammoPicker(),
    );
    this.root.append(
      el("div", { class: "screen result" }, [
        el("div", { class: "sheet" }, kids),
        el("div", { class: "actions" }, [
          button("solid cta", "Play again", () => this.go("play")),
          button("ghost", "Change table", () => this.go("setup")),
        ]),
      ]),
    );
  }

  private async refreshRecord(): Promise<void> {
    this.record = await loadWorldRecord(window.localStorage);
    this.paintRecordPlaques();
    if (this.screen !== "result" || !this.result || this.claimedThisRun) return;
    if (beatsRecord(this.result.score, this.record)) return;
    const stale = this.root.querySelector(".claim");
    if (!stale) return;
    stale.replaceWith(
      el("p", { class: "claim-note" }, [`${formatHolder(this.record)} already holds it.`]),
    );
  }

  private paintRecordPlaques(): void {
    for (const node of this.root.querySelectorAll<HTMLElement>(".world-plaque")) {
      paintWorldPlaque(node, this.record);
    }
  }

  private recordPlaque(): HTMLElement {
    const node = el("div", { class: "world-plaque" });
    paintWorldPlaque(node, this.record);
    return node;
  }

  private claimBox(card: ScoreCard): HTMLElement | null {
    if (this.claimedThisRun) {
      return el("p", { class: "claim-note held" }, ["Your name is on the table."]);
    }
    if (!beatsRecord(card.score, this.record)) return null;
    const box = el("div", { class: "claim" });
    const input = el("input", {
      class: "name-in",
      type: "text",
      maxlength: "16",
      placeholder: "Write your name",
      autocomplete: "nickname",
      enterkeyhint: "done",
      spellcheck: "false",
      "aria-label": "World record name",
    });
    const note = el("p", { class: "claim-note" }, ["You passed it. Put your name on the table."]);
    let busy = false;
    const submit = async (): Promise<void> => {
      if (busy) return;
      busy = true;
      go.disabled = true;
      const result = await claimWorldRecord(window.localStorage, {
        name: input.value,
        score: card.score,
        wave: card.wave,
        correct: card.correct,
      });
      this.record = result.record;
      switch (result.reason) {
        case "name":
          note.textContent = "Need a name to claim it.";
          input.focus();
          busy = false;
          go.disabled = false;
          return;
        case "beaten":
          note.textContent = `${formatHolder(result.record)} already holds ${formatScore(result.record.score)}.`;
          this.paintRecordPlaques();
          busy = false;
          go.disabled = false;
          return;
        case "ok":
          this.claimedThisRun = true;
          this.paintRecordPlaques();
          box.replaceWith(el("p", { class: "claim-note held" }, ["Your name is on the table."]));
          const headline = this.root.querySelector(".result .kicker");
          if (headline) headline.textContent = "You hold it";
          return;
        default:
          assertNever(result.reason);
      }
    };
    const go = button("solid", "Claim the record", () => {
      void submit();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    });
    box.append(note, input, go);
    return box;
  }

  private modePicker(): HTMLElement {
    const row = el("div", { class: "levels modes" });
    const paint = (): void => {
      clear(row);
      for (const mode of ["cannon", "paddle"] as const) {
        const on = mode === this.settings.mode;
        const chip = button(on ? "level on" : "level", "", () => {
          this.patchSettings({ mode });
          paint();
          this.refreshSetupExtras();
        });
        chip.append(el("b", {}, [modeLabel(mode)]), el("small", {}, [modeHint(mode)]));
        row.append(chip);
      }
    };
    paint();
    return row;
  }

  private refreshSetupExtras(): void {
    if (this.screen !== "setup" && this.screen !== "result") return;
    const ammo = this.root.querySelector(".ammo-picker");
    if (ammo instanceof HTMLElement) {
      ammo.style.display = this.settings.mode === "cannon" ? "" : "none";
    }
  }

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

  private floorPicker(): HTMLElement {
    const row = el("div", { class: "levels floors" });
    const paint = (): void => {
      clear(row);
      for (const floor of QUESTION_FLOORS) {
        const on = floor === this.settings.questionFloor;
        const chip = button(on ? "level on" : "level", "", () => {
          this.patchSettings({ questionFloor: floor });
          paint();
        });
        chip.append(el("b", {}, [floorLabel(floor)]), el("small", {}, [floorHint(floor)]));
        row.append(chip);
      }
    };
    paint();
    return el("div", { class: "picker-block" }, [el("span", { class: "picker-label" }, ["Questions"]), row]);
  }

  private wavePicker(): HTMLElement {
    return this.picker("Start wave", START_WAVES, this.settings.startWave, (value: StartWave) => {
      this.patchSettings({ startWave: value });
    }, (value) => `${value}`);
  }

  private ammoPicker(): HTMLElement {
    const wrap = this.picker("Cannon magazine", CANNON_AMMO, this.settings.cannonAmmo, (value: CannonAmmo) => {
      this.patchSettings({ cannonAmmo: value });
    }, (value) => `${value}`);
    wrap.classList.add("ammo-picker");
    if (this.settings.mode !== "cannon") wrap.style.display = "none";
    return wrap;
  }

  private categoryPicker(): HTMLElement {
    const row = el("div", { class: "chips cats" });
    const paint = (): void => {
      clear(row);
      const all = button(this.settings.categories.length === 0 ? "chip on" : "chip", "All", () => {
        this.patchSettings({ categories: [] });
        paint();
      });
      row.append(all);
      for (const category of TRIVIA_CATEGORIES) {
        const on = this.settings.categories.includes(category);
        const chip = button(on ? "chip on" : "chip", category, () => {
          this.patchSettings({ categories: toggleCategory(this.settings.categories, category) });
          paint();
        });
        row.append(chip);
      }
    };
    paint();
    return el("div", { class: "picker-block" }, [el("span", { class: "picker-label" }, ["Categories"]), row]);
  }

  private speedPicker(): HTMLElement {
    return this.picker("Speed", PLAY_SPEEDS, this.playSpeed, (value: PlaySpeed) => {
      this.playSpeed = value;
      this.patchSettings({ playSpeed: value });
    }, (value) => `${value}×`);
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
        el("div", { class: "sheet" }, [
          el("h3", {}, ["Paused"]),
          this.modePicker(),
          this.levelPicker(),
          this.wavePicker(),
          this.floorPicker(),
          this.ammoPicker(),
          this.speedPicker(),
          el("p", { class: "note" }, ["Changing the table starts a fresh run. Speed applies now."]),
        ]),
        el("div", { class: "actions" }, [
          button("solid", "Resume", close),
          button("ghost", "Restart", () => {
            overlay.remove();
            this.paused = false;
            this.go("play");
          }),
          button("ghost", "End run", () => {
            overlay.remove();
            this.paused = false;
            this.endRun?.("Cashed out", "You banked this score.");
          }),
          button("ghost", "Table", () => {
            overlay.remove();
            this.paused = false;
            this.go("setup");
          }),
        ]),
      ]),
    );
    this.boardHost?.append(overlay);
  }

  private patchSettings(partial: Partial<RunSettings>): void {
    this.settings = writeSettings(window.localStorage, { ...this.settings, ...partial });
    if (partial.playSpeed) this.playSpeed = partial.playSpeed;
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
    onAmmo?: (world: BreakerWorld) => void,
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

    let aiming = false;
    const canSteer = (): boolean => world.mode === "paddle" || !world.volleyActive;

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
      if (canSteer()) movePaddle(world, pointX(event));
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
      if (canSteer()) movePaddle(world, pointX(event));
    };

    const onUp = (): void => {
      if (aiming) {
        aiming = false;
        if (world.aim === null) {
          launchBalls(world, AIM_UP);
        } else {
          launchBalls(world);
        }
        onAmmo?.(world);
        sound.resume();
        if (firstShot) {
          firstShot = false;
          gagPop(board, sound.goof());
        } else {
          gagPop(board, sound.maybeGoof(0.16));
        }
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
        onAmmo?.(world);
      }
      if (world.mode === "paddle") {
        if (event.key === "ArrowLeft") movePaddle(world, world.paddle.x + world.paddle.w / 2 - 32);
        if (event.key === "ArrowRight") movePaddle(world, world.paddle.x + world.paddle.w / 2 + 32);
      }
    };

    canvas.addEventListener("pointermove", onMove, { passive: false });
    canvas.addEventListener("pointerdown", onDown, { passive: false });
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", scale);
    window.visualViewport?.addEventListener("resize", scale);

    let firstShot = true;
    let last = performance.now();
    let lastGoofTick = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      if (world.paused) release();
      if (!world.paused && now - lastGoofTick > 14000) {
        lastGoofTick = now;
        gagPop(board, sound.maybeGoof(0.38));
      }
      const frame = Math.min(0.033, (now - last) / 1000);
      last = now;
      const flying = world.volleyActive || world.balls.some((ball) => !ball.stuck);
      const clock = flying ? this.playSpeed : 1;
      const scaled = frame * clock;
      const steps = Math.max(1, Math.ceil(scaled / 0.016));
      const slice = scaled / steps;
      for (let i = 0; i < steps; i += 1) {
        stepWorld(world, slice, now);
      }
      if (world.mode === "cannon") onAmmo?.(world);
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
      window.visualViewport?.removeEventListener("resize", scale);
    };
  }
}

function paintWorldPlaque(node: HTMLElement, record: WorldRecord): void {
  clear(node);
  node.className = hasHolder(record) ? "world-plaque held" : "world-plaque";
  node.append(
    el("small", {}, ["World record"]),
    el("b", { class: "who" }, [formatHolder(record)]),
    el("span", { class: "reach" }, [formatReach(record)]),
  );
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
  node.append(el("b", {}, [`\u00d7${multiplier}`]), el("small", {}, [streakLabel(streak)]));
}

function gagPop(host: HTMLElement | null | undefined, kind: GoofKind | null): void {
  if (!host || !kind) return;
  const pop = el("div", { class: "pop gag" }, [kind.toUpperCase()]);
  host.append(pop);
  window.setTimeout(() => pop.remove(), 1800);
}

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
    if (!result.correct) {
      buttons[drawn.answer]?.classList.add("reveal");
    }
    for (const other of buttons) other.disabled = true;
    if (result.correct) {
      sound.correct();
      gagPop(host, sound.maybeGoof(0.42));
    } else {
      sound.wrong();
      gagPop(host, sound.maybeGoof(0.55));
    }
    const now = performance.now();
    const effect = pickEffect(
      result.correct,
      result.streak,
      {
        lives: world.lives,
        bricksAlive: aliveBricks(world.bricks).length,
        ballsInPlay: world.balls.length,
        alreadyWobbly: now < world.wobbleUntil,
        alreadyFireball: now < world.fireballUntil,
      },
      Math.random,
      question.difficulty,
    );
    window.setTimeout(
      () => {
        overlay.remove();
        done(result.correct, effect, result.points);
      },
      result.correct ? 420 : 1150,
    );
  };

  const tier = question.difficulty === 3 ? "Brutal" : question.difficulty === 2 ? "Hard" : "Easy";
  overlay.append(
    el("div", { class: "panel" }, [
      el("div", { class: "sheet" }, [
        el("p", { class: "meta" }, [
          `${HOSTS[Math.floor(Math.random() * HOSTS.length)]}  ·  ${question.category}  ·  ${tier}`,
        ]),
        el("h2", {}, [question.question]),
        el("div", { class: "choices" }, buttons),
        el("div", { class: "timer" }, [bar]),
      ]),
    ]),
  );
  host.append(overlay);

  const timer = window.setInterval(() => {
    left -= 1;
    bar.style.width = `${(left / 14) * 100}%`;
    if (left <= 0) finish(-1);
  }, 1000);
}
