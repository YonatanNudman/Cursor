import { assertNever } from "./types";

type Tone = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
};

export const GOOF_KINDS = [
  "fart",
  "honk",
  "boing",
  "bonk",
  "thump",
  "trombone",
  "airhorn",
  "scratch",
  "whistle",
  "quack",
  "rimshot",
  "crickets",
  "squeak",
  "whoosh",
] as const;

export type GoofKind = (typeof GOOF_KINDS)[number];

export function pickGoof(rng: () => number = Math.random, last: GoofKind | null = null): GoofKind {
  const pool = last ? GOOF_KINDS.filter((kind) => kind !== last) : [...GOOF_KINDS];
  return pool[Math.floor(rng() * pool.length)] ?? "fart";
}

export class Soundboard {
  private ctx: AudioContext | null = null;
  private lastGoofAt = 0;
  private lastKind: GoofKind | null = null;
  enabled = true;

  private context(): AudioContext | null {
    if (!this.enabled || typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  resume(): void {
    void this.context()?.resume();
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) this.resume();
    return this.enabled;
  }

  private beep(tones: Tone[]): void {
    const ctx = this.context();
    if (!ctx) return;
    let at = ctx.currentTime;
    for (const tone of tones) {
      this.blip(ctx, at, tone);
      at += tone.duration * 0.72;
    }
  }

  private blip(ctx: AudioContext, at: number, tone: Tone): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type ?? "square";
    osc.frequency.setValueAtTime(tone.freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.05, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + tone.duration + 0.02);
  }

  private sweep(start: number, end: number, duration: number, type: OscillatorType, gain = 0.06): void {
    const ctx = this.context();
    if (!ctx) return;
    const at = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(start, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + duration + 0.03);
  }

  private noise(duration: number, gain: number, lowpass: number, highpass = 80): void {
    const ctx = this.context();
    if (!ctx) return;
    const at = ctx.currentTime;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = highpass;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(lowpass, at);
    lp.frequency.exponentialRampToValueAtTime(Math.max(40, lowpass * 0.35), at + duration);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    src.connect(hp);
    hp.connect(lp);
    lp.connect(amp);
    amp.connect(ctx.destination);
    src.start(at);
    src.stop(at + duration + 0.02);
  }

  paddle(): void {
    this.beep([{ freq: 220, duration: 0.06, type: "triangle" }]);
  }

  brick(): void {
    this.beep([{ freq: 440, duration: 0.05, type: "square", gain: 0.04 }]);
  }

  break(): void {
    this.beep([
      { freq: 520, duration: 0.05, type: "square" },
      { freq: 320, duration: 0.08, type: "triangle" },
    ]);
  }

  letter(): void {
    this.beep([
      { freq: 660, duration: 0.07, type: "sine" },
      { freq: 880, duration: 0.09, type: "sine" },
    ]);
  }

  miss(): void {
    this.beep([{ freq: 140, duration: 0.18, type: "sawtooth", gain: 0.03 }]);
  }

  correct(): void {
    this.beep([
      { freq: 523, duration: 0.08, type: "sine" },
      { freq: 659, duration: 0.08, type: "sine" },
      { freq: 784, duration: 0.12, type: "sine" },
    ]);
  }

  wrong(): void {
    this.beep([
      { freq: 196, duration: 0.1, type: "square" },
      { freq: 130, duration: 0.16, type: "square" },
    ]);
  }

  win(): void {
    this.beep([
      { freq: 523, duration: 0.1, type: "triangle" },
      { freq: 659, duration: 0.1, type: "triangle" },
      { freq: 784, duration: 0.1, type: "triangle" },
      { freq: 1046, duration: 0.18, type: "triangle" },
    ]);
  }

  lose(): void {
    this.beep([
      { freq: 247, duration: 0.12, type: "sawtooth", gain: 0.03 },
      { freq: 196, duration: 0.12, type: "sawtooth", gain: 0.03 },
      { freq: 130, duration: 0.22, type: "sawtooth", gain: 0.03 },
    ]);
  }

  /** A punchline, not a loop. Skips if one just played. */
  maybeGoof(chance: number, now = typeof performance !== "undefined" ? performance.now() : 0): GoofKind | null {
    if (now - this.lastGoofAt < 2400) return null;
    if (Math.random() >= chance) return null;
    return this.goof();
  }

  goof(kind: GoofKind = pickGoof(Math.random, this.lastKind)): GoofKind {
    this.lastKind = kind;
    this.lastGoofAt = typeof performance !== "undefined" ? performance.now() : 0;
    this.playGoof(kind);
    return kind;
  }

  private playGoof(kind: GoofKind): void {
    switch (kind) {
      case "fart":
        this.noise(0.28, 0.11, 220, 40);
        this.sweep(140, 48, 0.32, "triangle", 0.07);
        break;
      case "honk":
        this.beep([
          { freq: 392, duration: 0.16, type: "square", gain: 0.07 },
          { freq: 330, duration: 0.22, type: "square", gain: 0.07 },
        ]);
        break;
      case "boing":
        this.sweep(720, 180, 0.28, "sine", 0.08);
        this.beep([{ freq: 240, duration: 0.08, type: "triangle", gain: 0.04 }]);
        break;
      case "bonk":
        this.beep([
          { freq: 180, duration: 0.07, type: "square", gain: 0.08 },
          { freq: 90, duration: 0.12, type: "triangle", gain: 0.06 },
        ]);
        break;
      case "thump":
        this.sweep(90, 38, 0.22, "sine", 0.12);
        this.noise(0.12, 0.05, 180, 30);
        break;
      case "trombone":
        this.beep([
          { freq: 196, duration: 0.18, type: "sawtooth", gain: 0.05 },
          { freq: 175, duration: 0.16, type: "sawtooth", gain: 0.05 },
          { freq: 147, duration: 0.28, type: "sawtooth", gain: 0.05 },
        ]);
        break;
      case "airhorn":
        this.beep([
          { freq: 370, duration: 0.22, type: "sawtooth", gain: 0.06 },
          { freq: 311, duration: 0.28, type: "sawtooth", gain: 0.06 },
        ]);
        break;
      case "scratch":
        this.noise(0.16, 0.07, 2800, 400);
        this.sweep(1800, 220, 0.18, "sawtooth", 0.04);
        break;
      case "whistle":
        this.sweep(880, 1760, 0.22, "sine", 0.05);
        this.sweep(1760, 990, 0.2, "sine", 0.04);
        break;
      case "quack":
        this.beep([
          { freq: 310, duration: 0.07, type: "square", gain: 0.06 },
          { freq: 240, duration: 0.1, type: "square", gain: 0.05 },
        ]);
        this.noise(0.08, 0.03, 900, 200);
        break;
      case "rimshot":
        this.noise(0.05, 0.08, 4000, 800);
        this.beep([
          { freq: 200, duration: 0.05, type: "square", gain: 0.05 },
          { freq: 140, duration: 0.08, type: "triangle", gain: 0.04 },
        ]);
        break;
      case "crickets":
        this.beep([
          { freq: 4100, duration: 0.04, type: "square", gain: 0.025 },
          { freq: 3900, duration: 0.04, type: "square", gain: 0.025 },
          { freq: 4200, duration: 0.04, type: "square", gain: 0.025 },
          { freq: 4000, duration: 0.05, type: "square", gain: 0.02 },
        ]);
        break;
      case "squeak":
        this.sweep(1400, 2400, 0.09, "sine", 0.045);
        this.sweep(2200, 1600, 0.08, "sine", 0.04);
        break;
      case "whoosh":
        this.noise(0.24, 0.06, 1600, 200);
        this.sweep(420, 160, 0.22, "triangle", 0.03);
        break;
      default:
        assertNever(kind);
    }
  }
}

export const sound = new Soundboard();
