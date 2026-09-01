type Tone = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
};

export class Soundboard {
  private ctx: AudioContext | null = null;
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
      at += tone.duration * 0.72;
    }
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
}

export const sound = new Soundboard();
