// Sample-based audio. Sound effects are decoded once into AudioBuffers and played
// through Web Audio; background music streams through <audio> elements so it can
// start before the whole file has downloaded. Credits: public/audio/CREDITS.md.

const SFX = [
  'shot_pistol', 'shot_revolver', 'shot_smg', 'shot_shotgun', 'shot_sniper', 'shot_minigun',
  'mag_out', 'mag_in', 'slide', 'cyl_open', 'shell_in', 'cyl_close', 'cyl_spin',
  'smg_out', 'smg_in', 'smg_bolt', 'pump_back', 'pump_fwd', 'shell_load',
  'bolt_up', 'bolt_back', 'bolt_fwd', 'bolt_down', 'clip', 'box_out', 'box_in', 'belt',
  'swing_s1', 'swing_s2', 'swing_s3', 'swing_m1', 'swing_m2', 'swing_m3', 'swing_h1', 'swing_h2',
  'blade', 'parry', 'parry_perfect', 'sheathe', 'hit1', 'hit2', 'hit3', 'hit_h1', 'hit_h2', 'hurt',
  'casing1', 'casing2', 'ui', 'ui_back', 'deny', 'buy', 'coin', 'levelup', 'heal', 'victory', 'defeat',
  'kill1', 'kill2', 'kill3', 'bhit1', 'bhit2', 'slam', 'slam2', 'eshot1', 'eshot2', 'rail', 'charge',
  'reflect', 'gem1', 'gem2', 'dash', 'click', 'boss', 'start',
  'shot_derringer', 'shot_lever', 'shot_rifle', 'shot_dbarrel', 'shot_cannon', 'shot_musket', 'shot_laser', 'shot_laser2',
  'explode', 'explode2', 'vent', 'cool', 'ignite', 'lever', 'gate', 'ar_out', 'ar_in', 'ar_bolt', 'breech',
  'break_open', 'break_shut', 'shell_breech', 'hammer', 'flint',
] as const;
export type SfxName = (typeof SFX)[number];
export type Track = 'lobby' | 'battle' | 'boss1' | 'boss2';

interface PlayOpts {
  vol?: number;
  rate?: number;
  /** random +/- spread applied to rate */
  jitter?: number;
  delay?: number;
  /** minimum ms between two plays of this name */
  gate?: number;
  /** maximum simultaneous voices of this name */
  max?: number;
}

const BASE = 'audio/';

class Sfx {
  ctx: AudioContext | null = null;
  master!: GainNode;
  bufs = new Map<string, AudioBuffer>();
  enabled = true;
  musicOn = true;
  volume = 0.8;
  musicVolume = 0.45;
  private last = new Map<string, number>();
  private voices = new Map<string, number>();
  private loading = false;

  // ---- music ----
  private decks: HTMLAudioElement[] = [];
  private live = 0;
  private track: Track | null = null;
  private duck = 1;
  private duckT = 0;
  private fade = 1;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.kickMusic();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(comp).connect(this.ctx.destination);
    this.load();
    this.kickMusic();
  }

  private async load() {
    if (this.loading || !this.ctx) return;
    this.loading = true;
    const ctx = this.ctx;
    await Promise.all(
      SFX.map(async (n) => {
        try {
          const r = await fetch(`${BASE}sfx/${n}.mp3`);
          if (!r.ok) return;
          const b = await ctx.decodeAudioData(await r.arrayBuffer());
          this.bufs.set(n, b);
        } catch {
          /* a missing clip just stays silent */
        }
      }),
    );
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
  }
  setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v));
  }
  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? this.volume : 0;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!on) for (const d of this.decks) d.pause();
    else this.kickMusic();
  }

  play(name: SfxName | readonly SfxName[], o: PlayOpts = {}) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const n = typeof name === 'string' ? name : name[Math.floor(Math.random() * name.length)];
    const key = typeof name === 'string' ? name : name[0];
    const now = performance.now();
    if (o.gate && now - (this.last.get(key) ?? -1e9) < o.gate) return;
    if ((this.voices.get(key) ?? 0) >= (o.max ?? 6)) return;
    const buf = this.bufs.get(n);
    if (!buf) return;
    this.last.set(key, now);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const j = o.jitter ?? 0.04;
    src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * j);
    const g = this.ctx.createGain();
    g.gain.value = o.vol ?? 1;
    src.connect(g).connect(this.master);
    this.voices.set(key, (this.voices.get(key) ?? 0) + 1);
    src.onended = () => this.voices.set(key, Math.max(0, (this.voices.get(key) ?? 1) - 1));
    src.start(this.ctx.currentTime + (o.delay ?? 0));
  }

  // ---------------- music ----------------
  music(t: Track | null) {
    if (t === this.track) return;
    this.track = t;
    if (!this.decks.length) {
      for (let i = 0; i < 2; i++) {
        const a = new Audio();
        a.loop = true;
        a.preload = 'auto';
        a.volume = 0;
        this.decks.push(a);
      }
    }
    // crossfade: the old deck fades out in update(), the new one fades in
    this.live = 1 - this.live;
    const d = this.decks[this.live];
    d.pause();
    if (t) {
      d.src = `${BASE}bgm/${t}.mp3`;
      d.currentTime = 0;
      d.volume = 0;
      this.kickMusic();
    }
    this.fade = 0;
  }

  private kickMusic() {
    if (!this.musicOn || !this.track) return;
    const d = this.decks[this.live];
    if (d && d.paused) d.play().catch(() => undefined);
  }

  /** briefly pull the music down under a big hit */
  duckMusic(amount: number, time: number) {
    this.duck = Math.min(this.duck, 1 - amount);
    this.duckT = Math.max(this.duckT, time);
  }

  update(dt: number) {
    if (!this.decks.length) return;
    this.fade = Math.min(1, this.fade + dt / 0.9);
    if (this.duckT > 0) this.duckT -= dt;
    else this.duck = Math.min(1, this.duck + dt * 2.5);
    const v = this.musicOn ? this.musicVolume * this.duck : 0;
    const inD = this.decks[this.live], outD = this.decks[1 - this.live];
    inD.volume = Math.max(0, Math.min(1, v * this.fade));
    outD.volume = Math.max(0, Math.min(1, v * (1 - this.fade)));
    if (this.fade >= 1 && !outD.paused) outD.pause();
  }

  // ---------------- game sounds ----------------
  shot(kind: string) {
    switch (kind) {
      case 'pistol': return this.play('shot_pistol', { vol: 0.7, gate: 30 });
      case 'revolver': return this.play('shot_revolver', { vol: 0.85, gate: 30 });
      case 'smg': return this.play('shot_smg', { vol: 0.5, gate: 55, jitter: 0.08, max: 4 });
      case 'shotgun': return this.play('shot_shotgun', { vol: 0.95, gate: 40 });
      case 'sniper': return this.play('shot_sniper', { vol: 1, gate: 40 });
      case 'minigun': return this.play('shot_minigun', { vol: 0.42, gate: 38, jitter: 0.1, max: 5 });
      case 'railgun':
        this.play('rail', { vol: 1 });
        this.play('slam', { vol: 0.45, rate: 1.4 });
        return;
      case 'derringer': return this.play('shot_derringer', { vol: 0.7, gate: 30 });
      case 'lever': return this.play('shot_lever', { vol: 0.85, gate: 30 });
      case 'rifle': return this.play('shot_rifle', { vol: 0.6, gate: 40, jitter: 0.06, max: 4 });
      case 'laser': return this.play(['shot_laser', 'shot_laser2'], { vol: 0.45, gate: 50, jitter: 0.08, max: 4 });
      case 'dbarrel': return this.play('shot_dbarrel', { vol: 1, gate: 40 });
      case 'cannon':
        this.play('shot_cannon', { vol: 1, rate: 0.82, gate: 40, jitter: 0.02 });
        this.play('slam2', { vol: 0.35, rate: 0.8 });
        return;
      case 'musket':
        this.play('shot_musket', { vol: 1, rate: 0.9, gate: 40 });
        this.play('slam', { vol: 0.4, rate: 1.2 });
        return;
      case 'launcher': return this.play('slam2', { vol: 0.8, rate: 0.7, gate: 40 });
    }
  }
  charge() {
    this.play('charge', { vol: 0.6, jitter: 0 });
  }
  /** named reload / action foley */
  foley(n: SfxName, vol = 0.8, rate = 1) {
    this.play(n, { vol, rate, gate: 25, jitter: 0.03 });
  }
  click(pitch = 1) {
    this.play('click', { vol: 0.5, rate: pitch, gate: 25 });
  }
  clack() {
    this.play('slide', { vol: 0.7, gate: 25 });
  }
  shell() {
    this.play(['casing1', 'casing2'], { vol: 0.35, gate: 45, jitter: 0.15, max: 4 });
  }
  spin() {
    this.play(['swing_s1', 'swing_s2', 'swing_s3'], { vol: 0.35, rate: 1.5, gate: 60 });
  }
  explode() {
    this.play(['explode', 'explode2'], { vol: 0.95, gate: 50, max: 3 });
    this.play('slam', { vol: 0.5, gate: 50, max: 2 });
    this.duckMusic(0.3, 0.15);
  }
  swing(kind: string) {
    switch (kind) {
      case 'saber': return this.play(['swing_s1', 'swing_s2', 'swing_s3'], { vol: 0.8, rate: 1.05 });
      case 'cleaver': return this.play(['swing_m1', 'swing_m2', 'swing_m3'], { vol: 0.9, rate: 0.75 });
      case 'katar': return this.play(['swing_s1', 'swing_s2', 'swing_s3'], { vol: 0.7, rate: 1.45, gate: 30 });
      case 'spear': return this.play(['swing_m1', 'swing_m2', 'swing_m3'], { vol: 0.9, rate: 1.25 });
      case 'nodachi':
        this.play(['swing_h1', 'swing_h2'], { vol: 0.9, rate: 1.05 });
        this.play('blade', { vol: 0.3, rate: 1.05 });
        return;
      case 'twinblade': return this.play(['swing_m1', 'swing_m2', 'swing_m3'], { vol: 0.75, rate: 1.35, gate: 40 });
      case 'whip':
        this.play(['swing_h1', 'swing_h2'], { vol: 0.85, rate: 1.35 });
        this.play('click', { vol: 0.5, rate: 0.9, delay: 0.04 });
        this.play('click', { vol: 0.4, rate: 1.1, delay: 0.09 });
        return;
      case 'plasma':
        this.play(['swing_m1', 'swing_m2', 'swing_m3'], { vol: 0.8, rate: 1.5 });
        this.play('ignite', { vol: 0.35, rate: 1.6 });
        return;
    }
    if (kind === 'greatsword' || kind === 'scythe') this.play(['swing_h1', 'swing_h2'], { vol: 0.9, rate: kind === 'scythe' ? 1.15 : 0.9 });
    else if (kind === 'longsword' || kind === 'katana') this.play(['swing_m1', 'swing_m2', 'swing_m3'], { vol: 0.85, rate: kind === 'katana' ? 1.15 : 1 });
    else this.play(['swing_s1', 'swing_s2', 'swing_s3'], { vol: 0.8, rate: kind === 'rapier' ? 1.3 : 1.15 });
    if (kind === 'katana') this.play('blade', { vol: 0.35, rate: 1.2 });
  }
  sheathe() {
    this.play('sheathe', { vol: 0.32, rate: 1.25 });
    this.play('click', { vol: 0.6, rate: 1.3, delay: 0.06 });
  }
  slashHit(heavy = false) {
    if (heavy) this.play(['hit_h1', 'hit_h2'], { vol: 0.9, gate: 30, max: 3 });
    else this.play(['hit1', 'hit2', 'hit3'], { vol: 0.7, gate: 30, max: 3 });
  }
  bulletHit() {
    this.play(['bhit1', 'bhit2'], { vol: 0.6, gate: 35, jitter: 0.15, max: 3 });
  }
  kill() {
    this.play(['kill1', 'kill2', 'kill3'], { vol: 0.55, gate: 40, jitter: 0.12, max: 4 });
  }
  /** `soft`: a reflected bullet, quieter so a volley of them doesn't pile up */
  parry(perfect: boolean, soft = false) {
    // clean blade ring, sat just above the gunshots; PERFECT rings longer rather than brighter
    const g = soft ? 0.6 : 1;
    if (perfect) this.play('parry_perfect', { vol: 0.75 * g, jitter: 0.015, gate: soft ? 110 : 60, max: 2 });
    else this.play('parry', { vol: 0.66 * g, jitter: 0.03, gate: soft ? 110 : 60, max: 2 });
    this.duckMusic(perfect ? 0.6 : 0.35, perfect ? 0.35 : 0.15);
  }
  reflect() {
    this.play('reflect', { vol: 0.45, gate: 50 });
  }
  hurt() {
    this.play('hurt', { vol: 0.9, gate: 80 });
    this.duckMusic(0.3, 0.12);
  }
  dash() {
    this.play('dash', { vol: 0.6, rate: 1.1 });
  }
  gem() {
    this.play(['gem1', 'gem2'], { vol: 0.35, gate: 30, jitter: 0.12, max: 3 });
  }
  coin() {
    this.play('coin', { vol: 0.45, gate: 45, jitter: 0.1, max: 3 });
  }
  levelUp() {
    this.play('levelup', { vol: 0.7, jitter: 0 });
  }
  heal() {
    this.play('heal', { vol: 0.6, jitter: 0 });
  }
  bossAppear() {
    this.play('boss', { vol: 0.75, jitter: 0 });
    this.duckMusic(0.7, 2.5);
  }
  runStart() {
    this.play('start', { vol: 0.5, jitter: 0 });
  }
  warn() {
    this.play('charge', { vol: 0.5, rate: 0.6, jitter: 0, gate: 200 });
  }
  enemyShot() {
    this.play(['eshot1', 'eshot2'], { vol: 0.35, gate: 70, max: 3 });
  }
  slam() {
    this.play('slam', { vol: 0.8, gate: 60, max: 2 });
    this.play('slam2', { vol: 0.6, gate: 60, max: 2 });
  }
  ui() {
    this.play('ui', { vol: 0.5, jitter: 0, gate: 40 });
  }
  buy() {
    this.play('buy', { vol: 0.7, jitter: 0 });
  }
  deny() {
    this.play('deny', { vol: 0.6, jitter: 0, gate: 120 });
  }
  victory() {
    this.play('victory', { vol: 0.8, jitter: 0 });
  }
  defeat() {
    this.play('defeat', { vol: 0.8, jitter: 0 });
  }
}

export const sfx = new Sfx();
