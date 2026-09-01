import { QUESTIONS } from "../data/questions";
import { WORDS } from "../data/words";
import {
  attachHooks,
  createWorld,
  drawWorld,
  launchBalls,
  movePaddle,
  smashBoard,
  stepWorld,
  widenPaddle,
  type BreakerWorld,
} from "../game/breaker";
import { sound } from "../audio";
import { aliveBricks, buildLevel, classicBreakerStage, stageForCircuit } from "../logic/bricks";
import { formatScore, readScores, wordClearBonus, writeScore, brickPoints, letterPoints, boardClearBonus } from "../logic/score";
import {
  createTriviaSession,
  drawQuestion,
  gradeAnswer,
  orderedChoices,
  triviaAccuracy,
  type TriviaSession,
} from "../logic/trivia";
import { createPuzzle, displayWord, guessLetter, pickWord, remainingLetters } from "../logic/word";
import { assertNever, type Mode, type Puzzle, type ScoreCard, type Screen, type TriviaQuestion } from "../types";
import { clear, el } from "./html";

const FIELD = { w: 900, h: 540 };
const TRIVIA_ROUND = 10;
const CIRCUIT_STAGES = 5;

export class App {
  private screen: Screen = "home";
  private scores = readScores(window.localStorage);
  private soundOn = true;
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
      case "home":
        this.renderHome();
        break;
      case "how":
        this.renderHow();
        break;
      case "mix":
        this.renderMix();
        break;
      case "trivia":
        this.renderTrivia();
        break;
      case "word":
        this.renderWord();
        break;
      case "breaker":
        this.renderBreaker();
        break;
      case "result":
        this.renderResult();
        break;
      default:
        assertNever(this.screen);
    }
  }

  private renderHome(): void {
    const best = Math.max(this.scores.mix, this.scores.trivia, this.scores.word, this.scores.breaker);
    const shell = el("div", { class: "shell" }, [
      el("div", { class: "topbar" }, [
        el("div", {}, [
          el("p", { class: "brand-kicker" }, ["Arcade for restless brains"]),
          el("h1", { class: "brand-title" }, ["Mind", el("span", {}, ["breaker"])]),
          el("p", { class: "lede" }, [
            "Brick-breaker with stubborn multi-hit bricks and a short stack of balls. Trivia from every shelf. Letter-by-letter word hunts. Play them apart, or mash them into one run.",
          ]),
        ]),
        el("div", { class: "score-stack" }, [
          el("small", {}, ["Best saved score"]),
          el("strong", {}, [formatScore(best)]),
        ]),
      ]),
      el("div", { class: "modes" }, [
        this.modeCard("mix", "01", "The Circuit", "Break letter bricks to guess the word. Quiz bricks buy you another ball. Limited lives, rising walls."),
        this.modeCard("trivia", "02", "Trivia Mix", "Science, sports, movies, food, art, tech — every kind of question in one sprint."),
        this.modeCard("word", "03", "Letter Play", "A category, a blank word, and one letter at a time. Six misses and the lights go out."),
        this.modeCard("breaker", "04", "Brick Yard", "Some bricks fall in one hit. Some take a beating. You only get so many balls."),
      ]),
      el("div", { class: "toolbar" }, [
        button("ghost", "How it works", () => this.go("how")),
        button("ghost", this.soundOn ? "Sound on" : "Sound off", (btn) => {
          this.soundOn = sound.toggle();
          btn.textContent = this.soundOn ? "Sound on" : "Sound off";
        }),
      ]),
    ]);
    this.root.append(shell);
  }

  private modeCard(mode: Mode, tag: string, title: string, copy: string): HTMLButtonElement {
    const card = el("button", { class: `mode-card ${mode}`, type: "button" }, [
      el("p", { class: "tag" }, [tag]),
      el("h2", {}, [title]),
      el("p", {}, [copy]),
    ]);
    card.addEventListener("click", () => {
      sound.resume();
      this.go(mode);
    });
    return card;
  }

  private renderHow(): void {
    const shell = el("div", { class: "shell" }, [
      el("p", { class: "brand-kicker" }, ["House rules"]),
      el("h1", { class: "brand-title" }, ["Three games, one parlor"]),
      el("div", { class: "how-grid" }, [
        article("Brick Yard", "Aim with the mouse, finger, or arrows. Space or click launches. Darker bricks need more hits. Drop the last ball and the board wins."),
        article("Trivia Mix", "Ten questions, mixed categories, a ticking bar. Streaks pay. There is no category you can hide in."),
        article("Letter Play", "Guess letters like the old word games. The category is the only hint. Six missed letters end the round."),
      ]),
      el("div", { class: "how-card", style: "margin-top:16px" }, [
        el("h3", {}, ["The Circuit"]),
        el("p", {}, [
          "A secret word sits above the bricks. Letter tiles guess that letter when they break. Pink question tiles freeze the table for trivia — a right answer can hand you another ball, stretch the paddle, reveal a letter, or chip every brick at once. Finish the word or clear the wall to climb five stages.",
        ]),
      ]),
      el("div", { class: "toolbar" }, [button("solid", "Back to the parlor", () => this.go("home"))]),
    ]);
    this.root.append(shell);
  }

  private renderMix(): void {
    this.playCircuit();
  }

  private playCircuit(): void {
    let stage = 1;
    let score = 0;
    let lives = 4;
    const usedWords = new Set<string>();
    const session = createTriviaSession(QUESTIONS);

    const playStage = (): void => {
      this.teardown();
      const spec = stageForCircuit(stage);
      const entry = pickUnusedWord(spec.difficulty, usedWords);
      const puzzle = createPuzzle(entry);
      const bricks = buildLevel({
        rows: spec.rows,
        cols: spec.cols,
        width: FIELD.w,
        height: FIELD.h,
        padding: 18,
        offsetY: 18,
        word: puzzle.word,
        quizCount: spec.quizCount,
        minHp: spec.minHp,
        maxHp: spec.maxHp,
        decoys: spec.decoys,
      });
      const world = attachHooks(createWorld(FIELD.w, FIELD.h, bricks, lives, 5.1 + stage * 0.25), {
        onBrickHit: (brick, broke) => {
          if (!broke) {
            sound.brick();
            return;
          }
          score += brickPoints(brick.maxHp, brick.kind);
          if (brick.kind === "letter" && brick.letter) {
            this.applyLetter(puzzle, brick.letter, (pts) => {
              score += pts;
            });
            if (remainingLetters(puzzle).length === 0) {
              finishStage("word");
            }
          } else if (brick.kind === "quiz") {
            openQuiz();
          } else {
            sound.break();
          }
          hud.word.textContent = spaced(displayWord(puzzle));
          hud.score.textContent = formatScore(score);
        },
        onBallLost: () => {
          sound.miss();
          lives = world.lives;
          paintBalls(hud.balls, lives, 6);
          if (world.lives <= 0) {
            finishRun(false, "The last ball rolled off the table.");
          }
        },
        onBoardClear: () => {
          if (remainingLetters(puzzle).length > 0) {
            for (const letter of remainingLetters(puzzle)) {
              guessLetter(puzzle, letter);
            }
          }
          score += boardClearBonus(world.lives);
          finishStage("board");
        },
      });
      lives = world.lives;

      let settled = false;
      const finishStage = (why: "word" | "board"): void => {
        if (settled) return;
        settled = true;
        world.paused = true;
        score += wordClearBonus(world.lives, aliveBricks(world.bricks).length);
        lives = Math.min(6, world.lives + 1);
        sound.win();
        if (stage >= CIRCUIT_STAGES) {
          finishRun(true, why === "word" ? "You pulled every letter out of the wall." : "You flattened the last wall.");
          return;
        }
        stage += 1;
        banner(frame, `Stage ${stage - 1} cleared. Next wall incoming.`, () => playStage());
      };

      const finishRun = (won: boolean, detail: string): void => {
        if (won === false && settled) return;
        settled = true;
        world.paused = true;
        if (!won) sound.lose();
        this.finish("mix", {
          mode: "mix",
          score,
          won,
          title: won ? "Circuit complete" : "Circuit cut short",
          detail: `${detail} The word was ${puzzle.word}.`,
        });
      };

      const openQuiz = (): void => {
        world.paused = true;
        const question = drawQuestion(session) ?? QUESTIONS[0]!;
        showQuiz(frame, question, (correct) => {
          if (correct) {
            score += 100;
            const reward = pickReward(world, puzzle);
            applyReward(world, puzzle, reward);
            hud.word.textContent = spaced(displayWord(puzzle));
            if (remainingLetters(puzzle).length === 0) {
              finishStage("word");
              return;
            }
          }
          lives = world.lives;
          paintBalls(hud.balls, lives, 6);
          hud.score.textContent = formatScore(score);
          world.paused = false;
        });
      };

      const { frame, hud, canvas } = this.mountBoard({
        kicker: `Circuit  ·  stage ${stage}/${CIRCUIT_STAGES}`,
        category: puzzle.category,
        word: spaced(displayWord(puzzle)),
        score,
        lives,
        maxLives: 6,
        hint: "Move to aim  ·  click / space to launch  ·  gold = letters  ·  pink = trivia",
      });
      this.bindBreaker(canvas, world);
    };

    playStage();
  }

  private renderBreaker(): void {
    let wave = 1;
    let score = 0;
    let lives = 5;

    const playWave = (): void => {
      this.teardown();
      const spec = classicBreakerStage(wave);
      const bricks = buildLevel({
        rows: spec.rows,
        cols: spec.cols,
        width: FIELD.w,
        height: FIELD.h,
        padding: 16,
        offsetY: 16,
        word: "",
        quizCount: 0,
        minHp: spec.minHp,
        maxHp: spec.maxHp,
        decoys: 0,
      });
      lives = Math.min(lives, spec.lives + 2);
      const world = attachHooks(createWorld(FIELD.w, FIELD.h, bricks, lives, 5 + wave * 0.3), {
        onBrickHit: (brick, broke) => {
          if (!broke) {
            sound.brick();
            return;
          }
          sound.break();
          score += brickPoints(brick.maxHp, "hp");
          hud.score.textContent = formatScore(score);
        },
        onBallLost: () => {
          sound.miss();
          lives = world.lives;
          paintBalls(hud.balls, lives, 6);
          if (world.lives <= 0) {
            world.paused = true;
            this.finish("breaker", {
              mode: "breaker",
              score,
              won: false,
              title: "Out of balls",
              detail: `You reached wave ${wave}. The thick bricks kept the last laugh.`,
            });
          }
        },
        onBoardClear: () => {
          score += boardClearBonus(world.lives);
          lives = Math.min(6, world.lives + 1);
          sound.win();
          wave += 1;
          banner(frame, `Wave ${wave - 1} down. The next wall is meaner.`, () => playWave());
        },
      });
      lives = world.lives;
      const { frame, hud, canvas } = this.mountBoard({
        kicker: `Brick Yard  ·  wave ${wave}`,
        category: "Limited balls",
        word: "CLEAR THE WALL",
        score,
        lives,
        maxLives: 6,
        hint: "Numbers are hit points  ·  darker / hotter bricks take more shots",
      });
      this.bindBreaker(canvas, world);
    };

    playWave();
  }

  private renderTrivia(): void {
    const session = createTriviaSession(QUESTIONS);
    let index = 0;
    let score = 0;
    let current: TriviaQuestion | null = drawQuestion(session);
    let timer: number | null = null;

    const shell = el("div", { class: "shell" });
    this.root.append(shell);

    const paint = (): void => {
      if (timer) window.clearInterval(timer);
      if (!current || index >= TRIVIA_ROUND) {
        this.finish("trivia", {
          mode: "trivia",
          score,
          won: triviaAccuracy(session) >= 0.6,
          title: triviaAccuracy(session) >= 0.6 ? "Brain still warm" : "Mixed bag",
          detail: `${session.correct} correct, ${session.missed} missed, across every kind of question.`,
        });
        return;
      }

      const drawn = orderedChoices(current);
      const question = current;
      let locked = false;
      let left = 18;
      clear(shell);
      const bar = el("i");
      const card = el("div", { class: "trivia-card" }, [
        el("p", { class: "progress" }, [`Question ${index + 1} / ${TRIVIA_ROUND}  ·  ${question.category}`]),
        el("h2", {}, [question.question]),
        el("div", { class: "choices" },
          drawn.labels.map((label, choice) => {
            const btn = button("choice", label, () => pick(choice, btn));
            return btn;
          }),
        ),
        el("div", { class: "timer" }, [bar]),
        el("div", { class: "toolbar" }, [button("ghost", "Leave table", () => this.go("home"))]),
      ]);
      shell.append(
        el("p", { class: "brand-kicker" }, ["Trivia mix"]),
        el("div", { class: "score-stack", style: "margin:8px 0 16px" }, [
          el("small", {}, ["Score / streak"]),
          el("strong", {}, [`${formatScore(score)}  ·  ${session.streak}`]),
        ]),
        card,
      );

      const pick = (choice: number, btn: HTMLButtonElement): void => {
        if (locked) return;
        locked = true;
        if (timer) window.clearInterval(timer);
        const result = gradeAnswer(session, { ...question, answer: drawn.answer }, choice);
        if (result.correct) {
          sound.correct();
          btn.classList.add("good");
          score += result.points;
        } else {
          sound.wrong();
          btn.classList.add("bad");
        }
        window.setTimeout(() => {
          index += 1;
          current = drawQuestion(session);
          paint();
        }, 650);
      };

      timer = window.setInterval(() => {
        left -= 1;
        bar.style.width = `${(left / 18) * 100}%`;
        if (left <= 0 && !locked) {
          locked = true;
          window.clearInterval(timer!);
          gradeAnswer(session, question, -1);
          sound.wrong();
          index += 1;
          current = drawQuestion(session);
          paint();
        }
      }, 1000);

      this.unbind = () => {
        if (timer) window.clearInterval(timer);
      };
    };

    paint();
  }

  private renderWord(): void {
    const entry = pickWord(WORDS, (Math.ceil(Math.random() * 3) || 1) as 1 | 2 | 3);
    const puzzle = createPuzzle(entry, 6);
    let score = 0;
    const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

    const shell = el("div", { class: "shell" });
    this.root.append(shell);

    const paint = (): void => {
      clear(shell);
      const keys = el("div", { class: "keys" });
      for (const row of rows) {
        const rowEl = el("div", { class: "key-row" });
        for (const letter of row) {
          const state = puzzle.guessed.has(letter) ? (puzzle.word.includes(letter) ? "hit" : "miss") : "";
          const key = el("button", { class: `key ${state}`, type: "button" }, [letter]);
          if (puzzle.guessed.has(letter)) key.disabled = true;
          key.addEventListener("click", () => guess(letter));
          rowEl.append(key);
        }
        keys.append(rowEl);
      }
      const balls = el("div", { class: "balls" });
      paintBalls(balls, puzzle.maxWrong - puzzle.wrong, puzzle.maxWrong);
      shell.append(
        el("p", { class: "brand-kicker" }, ["Letter play"]),
        el("div", { class: "hud" }, [
          el("div", { class: "stat" }, ["Score", el("b", {}, [formatScore(score)])]),
          el("div", { class: "word" }, [
            el("div", { class: "category" }, [puzzle.category]),
            el("div", { class: "word-face" }, [spaced(displayWord(puzzle))]),
          ]),
          balls,
        ]),
        keys,
        el("div", { class: "toolbar" }, [button("ghost", "Leave table", () => this.go("home"))]),
      );
    };

    const guess = (letter: string): void => {
      const result = guessLetter(puzzle, letter);
      if (result.already) return;
      if (result.hit) {
        sound.letter();
        score += letterPoints(true);
      } else {
        sound.wrong();
        score += letterPoints(false);
      }
      if (result.won) {
        score += 200 + (puzzle.maxWrong - puzzle.wrong) * 40;
        this.finish("word", {
          mode: "word",
          score,
          won: true,
          title: "Word cracked",
          detail: `${puzzle.word} — ${puzzle.wrong} miss${puzzle.wrong === 1 ? "" : "es"}.`,
        });
        return;
      }
      if (result.lost) {
        this.finish("word", {
          mode: "word",
          score,
          won: false,
          title: "Letters ran out",
          detail: `The word was ${puzzle.word}.`,
        });
        return;
      }
      paint();
    };

    const onKey = (event: KeyboardEvent): void => {
      if (/^[a-zA-Z]$/.test(event.key)) guess(event.key);
    };
    window.addEventListener("keydown", onKey);
    this.unbind = () => window.removeEventListener("keydown", onKey);
    paint();
  }

  private renderResult(): void {
    const card = this.result;
    if (!card) {
      this.go("home");
      return;
    }
    const shell = el("div", { class: "shell" }, [
      el("div", { class: "result-card" }, [
        el("p", { class: "brand-kicker" }, [card.won ? "Table win" : "Table over"]),
        el("h2", {}, [card.title]),
        el("p", {}, [card.detail]),
        el("p", { class: "big-score" }, [formatScore(card.score)]),
        el("p", { class: "progress" }, [`Best ${card.mode}: ${formatScore(this.scores[card.mode])}`]),
        el("div", { class: "toolbar" }, [
          button("solid", "Play that table again", () => this.go(card.mode)),
          button("ghost", "Back to the parlor", () => this.go("home")),
        ]),
      ]),
    ]);
    this.root.append(shell);
  }

  private finish(mode: Mode, card: ScoreCard): void {
    this.teardown();
    this.scores = writeScore(window.localStorage, mode, card.score);
    this.result = card;
    this.screen = "result";
    this.render();
  }

  private applyLetter(puzzle: Puzzle, letter: string, add: (points: number) => void): void {
    const result = guessLetter(puzzle, letter);
    if (result.already) return;
    add(letterPoints(result.hit));
    if (result.hit) sound.letter();
    else sound.wrong();
  }

  private mountBoard(opts: {
    kicker: string;
    category: string;
    word: string;
    score: number;
    lives: number;
    maxLives: number;
    hint: string;
  }): { frame: HTMLElement; hud: { word: HTMLElement; score: HTMLElement; balls: HTMLElement }; canvas: HTMLCanvasElement } {
    const score = el("b", {}, [formatScore(opts.score)]);
    const word = el("div", { class: "word-face" }, [opts.word]);
    const balls = el("div", { class: "balls" });
    paintBalls(balls, opts.lives, opts.maxLives);
    const canvas = el("canvas", { width: String(FIELD.w), height: String(FIELD.h) });
    const frame = el("div", { class: "board-frame" }, [canvas]);
    const shell = el("div", { class: "shell play-wrap" }, [
      el("p", { class: "brand-kicker stage" }, [opts.kicker]),
      el("div", { class: "hud" }, [
        el("div", { class: "stat" }, ["Score", score]),
        el("div", { class: "word" }, [el("div", { class: "category" }, [opts.category]), word]),
        balls,
      ]),
      frame,
      el("div", { class: "hint-bar" }, [
        el("span", {}, [opts.hint]),
        button("ghost", "Leave table", () => this.go("home")),
      ]),
      el("div", { class: "legend" }, [
        legend("#7ee0ff", "1 hit"),
        legend("#5ad0c6", "2 hits"),
        legend("#ffc24b", "3 hits"),
        legend("#ff8a4a", "4 hits"),
        legend("#ff5d5d", "5 hits"),
        legend("#ffe66d", "Letter"),
        legend("#ff6b9d", "Trivia"),
      ]),
    ]);
    this.root.append(shell);
    return { frame, hud: { word, score, balls }, canvas };
  }

  private bindBreaker(canvas: HTMLCanvasElement, world: BreakerWorld): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = FIELD.w * ratio;
      canvas.height = FIELD.h * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    scale();

    const pointX = (event: PointerEvent): number => {
      const rect = canvas.getBoundingClientRect();
      return ((event.clientX - rect.left) / rect.width) * world.width;
    };

    const onMove = (event: PointerEvent): void => movePaddle(world, pointX(event));
    const onDown = (event: PointerEvent): void => {
      sound.resume();
      movePaddle(world, pointX(event));
      launchBalls(world);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        launchBalls(world);
      }
      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        movePaddle(world, world.paddle.x + world.paddle.w / 2 - 28);
      }
      if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        movePaddle(world, world.paddle.x + world.paddle.w / 2 + 28);
      }
      if (event.key === "Escape") this.go("home");
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", scale);

    let last = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      stepWorld(world, dt, now);
      drawWorld(ctx, world);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    this.stopLoop = () => cancelAnimationFrame(raf);
    this.unbind = () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", scale);
    };
  }
}

function button(kind: string, label: string, onClick: (btn: HTMLButtonElement) => void): HTMLButtonElement {
  const btn = el("button", { class: kind, type: "button" }, [label]);
  btn.addEventListener("click", () => onClick(btn));
  return btn;
}

function article(title: string, copy: string): HTMLElement {
  return el("article", {}, [el("h3", {}, [title]), el("p", {}, [copy])]);
}

function legend(color: string, label: string): HTMLElement {
  const swatch = el("span", { class: "swatch" });
  swatch.style.background = color;
  return el("span", {}, [swatch, label]);
}

function spaced(value: string): string {
  return value.split("").join(" ").replace(/   /g, "   ");
}

function paintBalls(node: HTMLElement, lives: number, max: number): void {
  clear(node);
  for (let i = 0; i < max; i += 1) {
    node.append(el("span", { class: i < lives ? "ball" : "ball gone" }));
  }
}

function pickUnusedWord(difficulty: 1 | 2 | 3, used: Set<string>) {
  for (let i = 0; i < 12; i += 1) {
    const entry = pickWord(WORDS, difficulty);
    if (!used.has(entry.word)) {
      used.add(entry.word);
      return entry;
    }
  }
  const entry = pickWord(WORDS, difficulty);
  used.add(entry.word);
  return entry;
}

function pickReward(world: BreakerWorld, puzzle: Puzzle): "ball" | "widen" | "reveal" | "smash" {
  const options: Array<"ball" | "widen" | "reveal" | "smash"> = ["ball", "widen"];
  if (remainingLetters(puzzle).length > 0) options.push("reveal");
  if (aliveBricks(world.bricks).length > 4) options.push("smash");
  return options[Math.floor(Math.random() * options.length)]!;
}

function applyReward(world: BreakerWorld, puzzle: Puzzle, reward: "ball" | "widen" | "reveal" | "smash"): void {
  switch (reward) {
    case "ball":
      world.lives += 1;
      sound.correct();
      banner(worldHost(world), "Extra ball pocketed.");
      break;
    case "widen":
      widenPaddle(world, performance.now());
      sound.correct();
      banner(worldHost(world), "Paddle stretched.");
      break;
    case "reveal": {
      const next = remainingLetters(puzzle)[0];
      if (next) guessLetter(puzzle, next);
      sound.letter();
      banner(worldHost(world), `Letter gifted: ${next ?? ""}`);
      break;
    }
    case "smash": {
      const broken = smashBoard(world);
      for (const brick of broken) {
        if (brick.kind === "letter" && brick.letter) {
          guessLetter(puzzle, brick.letter);
        }
      }
      sound.break();
      banner(worldHost(world), "The whole wall took a chip.");
      break;
    }
    default:
      assertNever(reward);
  }
}

function worldHost(_world: BreakerWorld): HTMLElement | null {
  return document.querySelector(".board-frame");
}

function banner(host: HTMLElement | null, text: string, then?: () => void): void {
  if (!host) {
    then?.();
    return;
  }
  const overlay = el("div", { class: "overlay" }, [
    el("div", { class: "panel" }, [
      el("h3", {}, [text]),
      then ? button("solid", "Keep going", () => {
        overlay.remove();
        then();
      }) : el("p", { class: "progress" }, ["Back to the table"]),
    ]),
  ]);
  host.append(overlay);
  if (!then) {
    window.setTimeout(() => overlay.remove(), 900);
  }
}

function showQuiz(
  host: HTMLElement,
  question: TriviaQuestion,
  done: (correct: boolean) => void,
): void {
  const drawn = orderedChoices(question);
  let locked = false;
  const overlay = el("div", { class: "overlay" }, [
    el("div", { class: "panel" }, [
      el("p", { class: "meta" }, [`Trivia  ·  ${question.category}`]),
      el("h3", {}, [question.question]),
      el("div", { class: "choices" },
        drawn.labels.map((label, index) => {
          const btn = button("choice", label, () => {
            if (locked) return;
            locked = true;
            const correct = index === drawn.answer;
            btn.classList.add(correct ? "good" : "bad");
            if (correct) sound.correct();
            else sound.wrong();
            window.setTimeout(() => {
              overlay.remove();
              done(correct);
            }, 550);
          });
          return btn;
        }),
      ),
    ]),
  ]);
  host.append(overlay);
}
