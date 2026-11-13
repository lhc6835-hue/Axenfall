// Every sound is synthesised on the fly: filtered noise bursts and short oscillators.

type OscType = OscillatorType;

class Sfx {
  ctx: AudioContext | null = null;
  master!: GainNode;
  comp!: DynamicsCompressorNode;
  noiseBuf!: AudioBuffer;
  enabled = true;
  volume = 0.7;
  private last = new Map<string, number>();

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 6;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? this.volume : 0;
  }

  /** limit how often a named sound may retrigger */
  private gate(name: string, ms: number) {
    const now = performance.now();
    const l = this.last.get(name) ?? 0;
    if (now - l < ms) return false;
    this.last.set(name, now);
    return true;
  }

  private ok() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  noise(o: { dur: number; type?: BiquadFilterType; f0: number; f1?: number; q?: number; gain: number; attack?: number; delay?: number }) {
    if (!this.ok()) return;
    const c = this.ctx!, t = c.currentTime + (o.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = c.createGain();
    const a = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.05);
  }

  tone(o: { type?: OscType; f0: number; f1?: number; dur: number; gain: number; attack?: number; delay?: number; detune?: number }) {
    if (!this.ok()) return;
    const c = this.ctx!, t = c.currentTime + (o.delay ?? 0);
    const osc = c.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  // ---------- game sounds ----------
  shot(kind: string) {
    if (!this.gate('shot', kind === 'smg' || kind === 'minigun' ? 45 : 20)) return;
    switch (kind) {
      case 'pistol':
        this.noise({ dur: 0.12, type: 'lowpass', f0: 5000, f1: 600, gain: 0.5 });
        this.tone({ type: 'square', f0: 220, f1: 60, dur: 0.07, gain: 0.25 });
        break;
      case 'revolver':
        this.noise({ dur: 0.22, type: 'lowpass', f0: 4000, f1: 300, gain: 0.7 });
        this.tone({ type: 'sawtooth', f0: 160, f1: 40, dur: 0.12, gain: 0.35 });
        break;
      case 'smg':
        this.noise({ dur: 0.07, type: 'bandpass', f0: 2600, f1: 900, q: 0.8, gain: 0.45 });
        this.tone({ type: 'square', f0: 300, f1: 90, dur: 0.04, gain: 0.15 });
        break;
      case 'shotgun':
        this.noise({ dur: 0.35, type: 'lowpass', f0: 3000, f1: 150, gain: 0.9 });
        this.tone({ type: 'sawtooth', f0: 110, f1: 35, dur: 0.2, gain: 0.45 });
        break;
      case 'sniper':
        this.noise({ dur: 0.45, type: 'lowpass', f0: 7000, f1: 200, gain: 0.9 });
        this.tone({ type: 'sawtooth', f0: 140, f1: 30, dur: 0.3, gain: 0.5 });
        this.noise({ dur: 0.6, type: 'bandpass', f0: 900, f1: 300, q: 2, gain: 0.15, delay: 0.05 });
        break;
      case 'minigun':
        this.noise({ dur: 0.06, type: 'bandpass', f0: 1800, f1: 700, q: 1, gain: 0.4 });
        this.tone({ type: 'square', f0: 180, f1: 70, dur: 0.035, gain: 0.12 });
        break;
      case 'railgun':
        this.tone({ type: 'sawtooth', f0: 1800, f1: 80, dur: 0.5, gain: 0.35 });
        this.tone({ type: 'sine', f0: 90, f1: 30, dur: 0.5, gain: 0.6 });
        this.noise({ dur: 0.5, type: 'highpass', f0: 3000, f1: 600, gain: 0.4 });
        break;
    }
  }

  charge(dur: number) {
    this.tone({ type: 'sine', f0: 300, f1: 1600, dur, gain: 0.12, attack: dur * 0.8 });
  }

  click(pitch = 1) {
    if (!this.gate('click' + pitch, 30)) return;
    this.tone({ type: 'square', f0: 1400 * pitch, f1: 700 * pitch, dur: 0.03, gain: 0.12 });
    this.noise({ dur: 0.03, type: 'highpass', f0: 4000, gain: 0.15 });
  }
  clack() {
    this.tone({ type: 'square', f0: 500, f1: 250, dur: 0.05, gain: 0.15 });
    this.noise({ dur: 0.06, type: 'bandpass', f0: 2500, q: 3, gain: 0.25 });
  }
  shell() {
    if (!this.gate('shell', 40)) return;
    this.tone({ type: 'triangle', f0: 3200 + Math.random() * 800, dur: 0.06, gain: 0.05 });
  }
  spin() {
    this.noise({ dur: 0.25, type: 'bandpass', f0: 600, f1: 1800, q: 4, gain: 0.08, attack: 0.05 });
  }

  swing(kind: string) {
    const heavy = kind === 'greatsword' || kind === 'scythe';
    const quick = kind === 'dagger' || kind === 'rapier';
    this.noise({
      dur: heavy ? 0.3 : quick ? 0.1 : 0.18,
      type: 'bandpass',
      f0: heavy ? 500 : quick ? 2500 : 1200,
      f1: heavy ? 1500 : quick ? 5000 : 3500,
      q: 1.5,
      gain: heavy ? 0.4 : 0.28,
      attack: 0.02,
    });
    if (kind === 'katana') this.tone({ type: 'sine', f0: 3200, f1: 2600, dur: 0.25, gain: 0.05 });
  }
  sheathe() {
    this.tone({ type: 'square', f0: 2200, f1: 1800, dur: 0.04, gain: 0.12 });
    this.tone({ type: 'sine', f0: 4200, dur: 0.15, gain: 0.04, delay: 0.01 });
  }

  slashHit(heavy = false) {
    if (!this.gate('slashhit', 30)) return;
    this.noise({ dur: heavy ? 0.25 : 0.12, type: 'lowpass', f0: heavy ? 1800 : 3500, f1: 200, gain: heavy ? 0.7 : 0.45 });
    this.tone({ type: 'sine', f0: heavy ? 120 : 200, f1: 50, dur: heavy ? 0.18 : 0.08, gain: 0.4 });
  }

  bulletHit() {
    if (!this.gate('bhit', 35)) return;
    this.noise({ dur: 0.05, type: 'bandpass', f0: 1500, q: 1.2, gain: 0.18 });
  }

  kill() {
    if (!this.gate('kill', 40)) return;
    this.noise({ dur: 0.18, type: 'lowpass', f0: 2500, f1: 200, gain: 0.3 });
    this.tone({ type: 'square', f0: 140, f1: 45, dur: 0.12, gain: 0.18 });
  }

  parry(perfect: boolean) {
    // metallic clang: several inharmonic partials with fast decay plus a crack of noise
    const base = perfect ? 1250 : 1050;
    for (const [m, g] of [[1, 0.28], [2.76, 0.16], [5.4, 0.1], [8.93, 0.06]] as const)
      this.tone({ type: 'sine', f0: base * m, f1: base * m * 0.985, dur: perfect ? 0.9 : 0.55, gain: g });
    this.tone({ type: 'triangle', f0: base * 0.5, dur: 0.3, gain: 0.2 });
    this.noise({ dur: 0.08, type: 'highpass', f0: 3000, gain: 0.6 });
    this.tone({ type: 'sine', f0: 140, f1: 40, dur: 0.25, gain: 0.6 });
    if (perfect) this.tone({ type: 'sine', f0: base * 2, f1: base * 2.02, dur: 1.2, gain: 0.06, delay: 0.05 });
  }

  reflect() {
    this.tone({ type: 'square', f0: 900, f1: 1800, dur: 0.08, gain: 0.08 });
  }

  hurt() {
    this.noise({ dur: 0.2, type: 'lowpass', f0: 1200, f1: 100, gain: 0.6 });
    this.tone({ type: 'sawtooth', f0: 180, f1: 60, dur: 0.2, gain: 0.3 });
  }

  dash() {
    this.noise({ dur: 0.18, type: 'bandpass', f0: 800, f1: 2400, q: 1, gain: 0.25, attack: 0.02 });
  }

  gem() {
    if (!this.gate('gem', 25)) return;
    this.tone({ type: 'sine', f0: 1300 + Math.random() * 300, f1: 1900, dur: 0.06, gain: 0.06 });
  }
  coin() {
    if (!this.gate('coin', 40)) return;
    this.tone({ type: 'square', f0: 1568, dur: 0.05, gain: 0.06 });
    this.tone({ type: 'square', f0: 2093, dur: 0.12, gain: 0.06, delay: 0.05 });
  }
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.14, gain: 0.08, delay: i * 0.07 }));
  }
  warn() {
    this.tone({ type: 'sawtooth', f0: 220, dur: 0.5, gain: 0.15 });
    this.tone({ type: 'sawtooth', f0: 233, dur: 0.5, gain: 0.15 });
  }
  enemyShot() {
    if (!this.gate('eshot', 60)) return;
    this.tone({ type: 'triangle', f0: 600, f1: 300, dur: 0.08, gain: 0.07 });
  }
  slam() {
    this.noise({ dur: 0.4, type: 'lowpass', f0: 800, f1: 60, gain: 0.8 });
    this.tone({ type: 'sine', f0: 90, f1: 30, dur: 0.35, gain: 0.6 });
  }
  ui() {
    this.tone({ type: 'square', f0: 880, dur: 0.04, gain: 0.05 });
  }
  buy() {
    [784, 1175, 1568].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.12, gain: 0.1, delay: i * 0.05 }));
    this.noise({ dur: 0.15, type: 'highpass', f0: 5000, gain: 0.08, delay: 0.1 });
  }
  deny() {
    this.tone({ type: 'square', f0: 180, dur: 0.12, gain: 0.08 });
    this.tone({ type: 'square', f0: 140, dur: 0.15, gain: 0.08, delay: 0.08 });
  }
}

export const sfx = new Sfx();
