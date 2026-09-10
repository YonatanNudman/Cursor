import { QUESTIONS } from "../data/questions";
import {
  AIM_UP,
  MAX_LIVES,
  aimAt,
  applyStake,
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
import { sound } from "../audio";
import { buildLevel, descendBricks, liftBricks, onlyNumbersLeft, specForPlan } from "../logic/bricks";
import { QUIZ_COOLDOWN_MS, canQueueQuiz } from "../logic/quiz-gate";
import { levelBonus, levelBrief, levelPlan, type LevelPlan } from "../logic/levels";
import { categoryChip, tierGlyph } from "../logic/palette";
import { PICK_TIERS, offerCategories, rememberPick } from "../logic/picks";
import { TIER_LABELS, stakeFor, tierReward, type Stake } from "../logic/stakes";
import { brickPoints, formatScore, isMilestone, streakLabel, streakMultiplier } from "../logic/score";
import { preferFresh, readBest, readSeen, rememberSeen, writeBest } from "../logic/seen";
import {
  PLAY_SPEEDS,
  modeHint,
  modeLabel,
  readSettings,
  writeSettings,
  type PlaySpeed,
  type RunSettings,
} from "../logic/settings";
import { allDifficulties, difficulty, type DifficultyPreset } from "../logic/difficulty";
import {
  createTriviaSession,
  drawQuestion,
  gradeAnswer,
  orderedChoices,
  type QuestionWant,
  type TriviaSession,
} from "../logic/trivia";
import { assertNever, type Difficulty, type ScoreCard, type Screen, type TriviaCategory, type TriviaQuestion } from "../types";
import { clear, el } from "./html";

const COACHED_KEY = "mindbreaker.coached";

/** A question in the queue, with the promise its brick made about it. */
interface Pending {
  question: TriviaQuestion;
  tier: Difficulty;
}

export class App {
  private screen: Screen = "setup";
  private best = readBest(window.localStorage);
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
  private timeouts: number[] = [];
  private quizCancel: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {
    this.render();
  }

  private go(screen: Screen): void {
    this.teardown();
    this.screen = screen;
    this.render();
  }

  private later(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      this.timeouts = this.timeouts.filter((item) => item !== id);
      fn();
    }, ms);
    this.timeouts.push(id);
    return id;
  }

  private flash(
    host: HTMLElement,
    tone: "good" | "bad",
    title: string,
    detail: string,
    then: () => void,
    ms = 1100,
  ): void {
    const overlay = el("div", { class: "overlay" }, [
      el("div", { class: `panel ${tone}` }, [el("h3", {}, [title]), el("p", {}, [detail])]),
    ]);
    host.append(overlay);
    this.later(() => {
      overlay.remove();
      then();
    }, ms);
  }

  private teardown(): void {
    for (const id of this.timeouts) window.clearTimeout(id);
    this.timeouts = [];
    this.quizCancel?.();
    this.quizCancel = null;
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

  private preset(): DifficultyPreset {
    return difficulty(this.settings.difficulty);
  }

  private renderSetup(): void {
    this.root.append(
      el("div", { class: "screen setup" }, [
        el("div", { class: "sheet" }, [
          el("p", { class: "kicker" }, ["Mindbreaker"]),
          el("h1", { class: "title" }, ["Answer or", el("span", {}, [" lose a life"])]),
          el("p", { class: "lede" }, [
            "Coloured bricks are questions. The hue is the subject, the glyph is the stake: ? risks one life, ?? risks two, !? risks three. Star bricks let you pick your fight.",
          ]),
          el("p", { class: "best" }, [formatScore(this.best), el("small", {}, ["Best"])]),
          this.modePicker(),
          this.levelPicker(),
        ]),
        el("div", { class: "actions" }, [button("solid cta", "Play", () => this.go("play"))]),
      ]),
    );
  }

  private playRun(): void {
    const preset = this.preset();
    const settings = this.settings;
    this.playSpeed = settings.playSpeed;
    let level = 1;
    let plan: LevelPlan = levelPlan(1, preset);
    let score = 0;
    let lives: number = preset.lives;
    let settled = false;
    const session = createTriviaSession(preferFresh(QUESTIONS, readSeen(window.localStorage)));
    const askedThisRun: string[] = [];
    const queue: Pending[] = [];
    let recentPicks: TriviaCategory[] = [];
    let asking = false;
    let levelPending = false;
    let quizReadyAt = 0;

    const hud = this.mountPlay();

    const paintAmmo = (world: BreakerWorld): void => {
      if (!hud.ammo) return;
      hud.ammo.textContent = String(world.ammoLeft);
    };
    const paintScore = (): void => {
      hud.score.textContent = formatScore(score);
      hud.streak.textContent = String(session.streak);
      paintCombo(hud.combo, session.streak);
    };

    const finish = (title: string, detail: string): void => {
      if (settled) return;
      settled = true;
      rememberSeen(window.localStorage, askedThisRun);
      this.best = writeBest(window.localStorage, score);
      this.result = { score, wave: level, correct: session.correct, missed: session.missed, title, detail };
      sound.lose();
      this.go("result");
    };
    this.endRun = finish;

    /**
     * Buying the wall back off the floor. The bill is the level's drop rate, so
     * a deep level where the wall falls five rows a volley lets you survive one
     * breach, not ten.
     */
    const breach = (world: BreakerWorld): boolean => {
      const cost = plan.descent;
      lives -= cost;
      world.lives = Math.max(0, lives);
      paintLives(hud.lives, world.lives);
      if (world.lives <= 0) {
        lives = 0;
        world.paused = true;
        finish("The wall reached the floor", `Level ${level} — ${plan.name}. ${session.correct} right, ${session.missed} wrong.`);
        return false;
      }
      liftBricks(world.bricks, 2);
      world.shake = 16;
      pulse(hud.board, "bad");
      floatPoints(hud.board, `BREACH \u2212${cost} LIFE${cost === 1 ? "" : "S"}`, "bad");
      sound.wrong();
      return true;
    };

    const startLevel = (): void => {
      this.stopLoop?.();
      this.unbind?.();
      const frame = hud.board.getBoundingClientRect();
      const width = Math.max(320, Math.floor(frame.width));
      const height = Math.max(360, Math.floor(frame.height));
      plan = levelPlan(level, preset, width);
      const world = attachHooks(
        createWorld(
          width,
          height,
          buildLevel(specForPlan(plan, width, height)),
          lives,
          5.6 * plan.ballSpeed,
          { mode: settings.mode, magazine: plan.magazine },
        ),
        {
          onBrickHit: (brick, broke) => {
            if (!broke) {
              sound.brick();
              return;
            }
            score += brickPoints(brick.maxHp, brick.kind) * preset.weight * streakMultiplier(session.streak);
            paintScore();
            sound.break();
            sound.maybeGoof(0.06);
            if (brick.kind === "pick") {
              openPick(world);
              return;
            }
            if (brick.kind === "quiz") {
              const ready = performance.now() >= quizReadyAt;
              if (canQueueQuiz(asking, queue.length, ready)) {
                enqueue(world, { tier: brick.tier, category: brick.category });
              }
            }
            trySweep(world);
          },
          onBallLost: () => {
            if (settled || world.cleared) return;
            sound.miss();
            sound.maybeGoof(0.3);
            lives = world.lives;
            paintLives(hud.lives, lives);
            pulse(hud.board, "bad");
            if (world.lives <= 0) {
              world.paused = true;
              finish("Out of lives", `Level ${level} — ${plan.name}. ${session.correct} right, ${session.missed} wrong.`);
            }
          },
          onBoardClear: () => {
            levelPending = true;
            world.paused = true;
            if (!asking) finishLevel(world);
          },
          onVolleyEnd: () => {
            paintAmmo(world);
            if (world.cleared || levelPending) {
              if (!asking) finishLevel(world);
              return;
            }
            if (trySweep(world)) return;
            const { reachedFloor } = descendBricks(world.bricks, world.paddle.y - 6, plan.descent);
            world.shake = 10;
            floatPoints(hud.board, "WALL DROPS", "bad");
            sound.maybeGoof(0.3);
            if (reachedFloor && !breach(world)) return;
            restockCannon(world, plan.magazine);
            paintAmmo(world);
          },
        },
      );
      lives = world.lives;
      this.world = world;
      paintLives(hud.lives, lives);
      paintAmmo(world);
      hud.level.textContent = String(level);
      hud.tag.textContent = plan.boss ? `${plan.name} · BOSS` : plan.name;
      hud.tag.className = plan.boss ? "level-tag boss" : "level-tag";
      this.bindBreaker(hud.canvas, hud.board, world, paintAmmo);
    };

    const enqueue = (world: BreakerWorld, want: QuestionWant): void => {
      const question = drawQuestion(session, want);
      if (!question) return;
      askedThisRun.push(question.id);
      queue.push({ question, tier: want.tier ?? question.difficulty });
      maybeAsk(world);
    };

    /** Star brick: choose the subject, then choose how much to risk. */
    const openPick = (world: BreakerWorld): void => {
      if (asking) return;
      asking = true;
      this.asking = true;
      world.paused = true;
      const overlay = el("div", { class: "overlay" });
      const body = el("div", { class: "sheet" });
      const close = (want: QuestionWant | null): void => {
        overlay.remove();
        asking = false;
        this.asking = false;
        if (want) {
          enqueue(world, want);
          if (!asking && !this.paused) world.paused = false;
          return;
        }
        if (!this.paused) world.paused = false;
      };

      const askTier = (category: TriviaCategory): void => {
        recentPicks = rememberPick(recentPicks, category);
        clear(body);
        body.append(
          el("p", { class: "meta" }, ["How much are you betting?"]),
          el("h3", {}, [category]),
          el(
            "div",
            { class: "pick-grid" },
            PICK_TIERS.map((tier) => {
              const card = button(`pick tier-${tier}`, "", () => close({ tier, category }));
              card.append(
                el("b", {}, [`${tierGlyph(tier)} ${TIER_LABELS[tier]}`]),
                el("small", {}, [tierReward(tier)]),
              );
              return card;
            }),
          ),
        );
      };

      const offers = offerCategories(recentPicks);
      body.append(
        el("p", { class: "meta" }, ["Star brick \u2605 \u00b7 pick your subject"]),
        el("h3", {}, ["Three on offer"]),
        el(
          "div",
          { class: "pick-grid" },
          offers.map((category) => {
            const card = button("pick", "", () => askTier(category));
            card.style.setProperty("--hue", categoryChip(category));
            card.append(el("b", {}, [category]));
            return card;
          }),
        ),
        el("p", { class: "note" }, ["Subjects you just played are held back, so the run keeps moving."]),
      );
      overlay.append(el("div", { class: "panel" }, [body]));
      hud.board.append(overlay);
      sound.letter();
    };

    const maybeAsk = (world: BreakerWorld): void => {
      if (asking || queue.length === 0) return;
      const next = queue.shift();
      if (!next) return;
      asking = true;
      this.asking = true;
      world.paused = true;
      this.quizCancel = showQuiz(hud.board, next, session, (correct, stake) => {
        const before = score;
        score += stake.score * preset.weight;
        applyStake(world, stake, { tier: next.tier });
        const gained = score - before;
        lives = world.lives;
        paintLives(hud.lives, lives);
        paintScore();
        pulse(hud.board, stake.tone);
        if (correct) {
          floatPoints(hud.board, `+${formatScore(gained)}`, "good");
          if (isMilestone(session.streak)) celebrate(hud.board, session.streak);
        }
        if (world.lives <= 0) {
          asking = false;
          this.asking = false;
          finish("The question took your last life", `${session.correct} right, ${session.missed} wrong.`);
          return;
        }
        this.flash(hud.board, stake.tone, stake.headline, stake.detail, () => {
          asking = false;
          this.asking = false;
          this.quizCancel = null;
          quizReadyAt = performance.now() + QUIZ_COOLDOWN_MS;
          if (levelPending) {
            finishLevel(world);
            return;
          }
          if (!this.paused) world.paused = false;
          if (trySweep(world)) return;
          maybeAsk(world);
        });
      }, (fn, ms) => {
        this.later(fn, ms);
      });
    };

    const trySweep = (world: BreakerWorld): boolean => {
      if (asking || this.paused || world.cleared || levelPending) return false;
      if (!onlyNumbersLeft(world.bricks)) return false;
      if (!beginSweep(world)) return false;
      paintAmmo(world);
      floatPoints(hud.board, "BURN THE REST", "good");
      sound.maybeGoof(0.4);
      return true;
    };

    const finishLevel = (world: BreakerWorld): void => {
      if (!levelPending || asking) return;
      levelPending = false;
      queue.length = 0;
      world.paused = true;
      score += levelBonus(plan, world.lives) * preset.weight;
      lives = preset.lifePerLevel ? Math.min(MAX_LIVES, world.lives + 1) : world.lives;
      sound.win();
      const cleared = plan;
      level += 1;
      hud.level.textContent = String(level);
      paintScore();
      const next = levelPlan(level, preset);
      this.flash(
        hud.board,
        "good",
        `${cleared.name} cleared`,
        `Level ${level}: ${next.name}. ${levelBrief(next)}`,
        () => {
          if (settled) return;
          startLevel();
        },
        1500,
      );
    };

    startLevel();
    this.flash(hud.board, "good", plan.name, levelBrief(plan), () => undefined, 1400);

    if (!localStorage.getItem(COACHED_KEY)) {
      const cannon = settings.mode === "cannon";
      const hint = el("div", { class: "coach" }, [
        el("b", {}, [cannon ? "Hold to aim the cannon" : "Hold to aim"]),
        el("small", {}, [
          cannon
            ? "Release to empty the magazine. The wall drops when it runs dry."
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
    level: HTMLElement;
    streak: HTMLElement;
    combo: HTMLElement;
    lives: HTMLElement;
    ammo: HTMLElement | null;
    tag: HTMLElement;
  } {
    const score = el("b", {}, ["0"]);
    const level = el("b", {}, ["1"]);
    const streak = el("b", {}, ["0"]);
    const combo = el("div", { class: "combo" });
    const lives = el("div", { class: "lives" });
    const ammo = this.settings.mode === "cannon" ? el("b", {}, ["0"]) : null;
    const tag = el("span", { class: "level-tag" }, ["Warm Up"]);
    const canvas = el("canvas");
    const board = el("div", { class: "board" }, [canvas]);
    this.boardHost = board;
    const hudBits = [
      el("div", { class: "stat" }, ["Score", score]),
      el("div", { class: "stat" }, ["Level", level]),
      el("div", { class: "stat" }, ["Streak", streak]),
    ];
    if (ammo) hudBits.push(el("div", { class: "stat" }, ["Shots", ammo]));
    hudBits.push(combo, lives);
    this.root.append(
      el("div", { class: "play" }, [
        el("div", { class: "hud" }, hudBits),
        board,
        el("div", { class: "foot" }, [tag, button("ghost tiny", "Pause", () => this.openPause())]),
      ]),
    );
    return { board, canvas, score, level, streak, combo, lives, ammo, tag };
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
    this.root.append(
      el("div", { class: "screen result" }, [
        el("div", { class: "sheet" }, [
          el("p", { class: "kicker" }, [beat ? "New best" : "Run over"]),
          el("h2", {}, [card.title]),
          el("p", {}, [card.detail]),
          el("p", { class: "big" }, [formatScore(card.score)]),
          el("div", { class: "tally" }, [
            stat("Level", String(card.wave)),
            stat("Right", String(card.correct)),
            stat("Accuracy", asked > 0 ? `${accuracy}%` : "--"),
            stat("Best", formatScore(this.best)),
          ]),
          this.modePicker(),
          this.levelPicker(),
        ]),
        el("div", { class: "actions" }, [
          button("solid cta", "Play again", () => this.go("play")),
          button("ghost", "Change table", () => this.go("setup")),
        ]),
      ]),
    );
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
        });
        chip.append(el("b", {}, [modeLabel(mode)]), el("small", {}, [modeHint(mode)]));
        row.append(chip);
      }
    };
    paint();
    return row;
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

  private speedPicker(): HTMLElement {
    return this.picker("Speed", PLAY_SPEEDS, this.playSpeed, (value: PlaySpeed) => {
      this.playSpeed = value;
      this.patchSettings({ playSpeed: value });
    }, (value) => `${value}\u00d7`);
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
        el("div", { class: "sheet" }, [el("h3", {}, ["Paused"]), this.speedPicker()]),
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
        sound.maybeGoof(0.14);
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

    let last = performance.now();
    let lastGoofTick = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      if (world.paused) release();
      if (!world.paused && now - lastGoofTick > 16000) {
        lastGoofTick = now;
        sound.maybeGoof(0.3);
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

function stat(label: string, value: string): HTMLElement {
  return el("div", { class: "tally-cell" }, [el("small", {}, [label]), el("b", {}, [value])]);
}

function button(kind: string, label: string, onClick: () => void): HTMLButtonElement {
  const btn = el("button", { class: kind, type: "button" }, [label]);
  btn.addEventListener("click", onClick);
  return btn;
}

function paintLives(node: HTMLElement, lives: number): void {
  clear(node);
  const max = Math.max(4, Math.min(MAX_LIVES, lives));
  for (let i = 0; i < max; i += 1) {
    node.append(el("span", { class: i < lives ? "life" : "life gone" }));
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

/** The whole board answers back: green rim for a win, red rim for a loss. */
function pulse(host: HTMLElement, tone: "good" | "bad"): void {
  const veil = el("div", { class: `verdict ${tone}` });
  host.append(veil);
  window.setTimeout(() => veil.remove(), 620);
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

const HOSTS = [
  "The wall wants a word with you.",
  "Pop quiz from a broken brick.",
  "Don't whiff this one.",
  "The table just got academic.",
  "Answer it. The board is listening.",
];

function showQuiz(
  host: HTMLElement,
  pending: Pending,
  session: TriviaSession,
  done: (correct: boolean, stake: Stake) => void,
  schedule: (fn: () => void, ms: number) => void,
): () => void {
  const { question, tier } = pending;
  const drawn = orderedChoices(question);
  let locked = false;
  let left = 14;
  const bar = el("i");
  const overlay = el("div", { class: `overlay quiz tier-${tier}` });
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
    if (!result.correct) buttons[drawn.answer]?.classList.add("reveal");
    for (const other of buttons) other.disabled = true;
    if (result.correct) {
      sound.correct();
    } else {
      sound.wrong();
    }
    sound.maybeGoof(0.45);
    const stake = stakeFor(tier, result.correct, result.streak);
    schedule(() => {
      overlay.remove();
      done(result.correct, stake);
    }, result.correct ? 460 : 1250);
  };

  const chip = el("span", { class: "cat-chip" }, [question.category]);
  chip.style.setProperty("--hue", categoryChip(question.category));
  overlay.append(
    el("div", { class: "panel" }, [
      el("div", { class: "sheet" }, [
        el("p", { class: "meta" }, [HOSTS[Math.floor(Math.random() * HOSTS.length)]!]),
        el("div", { class: "quiz-head" }, [
          chip,
          el("span", { class: `tier-badge tier-${tier}` }, [`${tierGlyph(tier)} ${TIER_LABELS[tier]}`]),
          el("span", { class: "stake-line" }, [tierReward(tier)]),
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

  return () => {
    window.clearInterval(timer);
    if (locked) return;
    locked = true;
    overlay.remove();
  };
}
