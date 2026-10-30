import { GROUND_Y, W, H, FONT_B, FONT_L, UI } from '../core/const';
import { Save } from '../core/save';
import { playBgm, sfx } from '../core/audio';
import { abilityById } from '../data/abilities';
import { stageById, type StageDef, type Arena } from '../data/stages';
import { THEMES, type Theme } from '../art/bg';
import { Combat, type Fighter, type HitInfo, type HitboxOpts } from '../battle/combat';
import { FxKit } from '../battle/fxkit';
import { Player, type Keys } from '../battle/player';
import { Enemy, spawnEnemy } from '../battle/enemies';
import { Boss, spawnBoss } from '../battle/bosses';
import { Projectile, type ProjOpts } from '../battle/proj';
import { mix } from '../art/pixel';

type Phase = 'roam' | 'arena' | 'clear' | 'dead';

export class BattleScene extends Phaser.Scene {
  stage!: StageDef;
  theme!: Theme;
  player!: Player;
  enemies: Enemy[] = [];
  projs: Projectile[] = [];
  combat!: Combat;
  fx!: FxKit;
  keys!: Keys;
  phase: Phase = 'roam';
  arenaIdx = 0;
  arena: Arena | null = null;
  waveIdx = 0;
  waveDelay = 0;
  boss: Boss | null = null;
  bossSpawned = false;
  bounds = { left: 0, right: 0 };
  stopUntil = 0;
  frozen = false;
  goldEarned = 0;
  kills = 0;
  combo = 0;
  comboT = 0;
  maxCombo = 0;
  startTime = 0;
  elapsed = 0;
  ground!: Phaser.GameObjects.Rectangle;
  platforms!: Phaser.Physics.Arcade.StaticGroup;
  platCollider!: Phaser.Physics.Arcade.Collider;
  dropT = 0;
  layers: { t: Phaser.GameObjects.TileSprite; f: number }[] = [];
  goArrow?: Phaser.GameObjects.Container;
  private lastHitSfx = 0;

  constructor() { super('Battle'); }

  init(data: { stageId: string }) {
    this.stage = stageById(data.stageId ?? '1-1');
    this.theme = THEMES.forest;
    this.enemies = []; this.projs = [];
    this.phase = 'roam'; this.arenaIdx = 0; this.arena = null; this.waveIdx = 0; this.boss = null; this.bossSpawned = false;
    this.stopUntil = 0; this.frozen = false; this.goldEarned = 0; this.kills = 0; this.combo = 0; this.maxCombo = 0; this.elapsed = 0;
    this.layers = [];
  }

  create() {
    const L = this.stage.length;
    const k = this.theme.key;
    this.cameras.main.setBackgroundColor(this.theme.sky[0]);
    this.cameras.main.fadeIn(300, 7, 6, 13);
    // parallax layers (screen space, scrolled by camera)
    this.add.image(0, 0, `bg_sky_${k}`).setOrigin(0).setScrollFactor(0).setDepth(-10);
    const lay = (key: string, y: number, h: number, f: number, d: number, alpha = 1) => {
      const t = this.add.tileSprite(0, y, W, h, key).setOrigin(0).setScrollFactor(0).setDepth(d).setAlpha(alpha);
      this.layers.push({ t, f });
    };
    lay(`bg_far_${k}`, H - 250, 200, 0.12, -9);
    lay(`bg_mid_${k}`, H - 260, 210, 0.3, -8);
    // floating dust/light motes in the air
    this.add.particles(0, 0, 'p1', {
      x: { min: 0, max: W }, y: { min: 0, max: GROUND_Y }, lifespan: 4000, speedX: { min: -6, max: 6 }, speedY: { min: -10, max: 4 },
      alpha: { start: 0, end: 0.8, ease: 'Sine.easeInOut' }, tint: [0xfff0b0, 0xc8ffd8], frequency: 120, blendMode: 'ADD',
    }).setScrollFactor(0).setDepth(-7);
    lay(`bg_near_${k}`, -40, 300, 0.6, -6, 1);
    // ground
    this.add.tileSprite(0, GROUND_Y - 1, L, 70, `ground_${k}`).setOrigin(0).setDepth(20);
    this.ground = this.add.rectangle(L / 2, GROUND_Y + 30, L + 400, 60, 0x000000, 0);
    this.physics.add.existing(this.ground, true);
    this.platforms = this.physics.add.staticGroup();
    for (const [x, y, n] of this.stage.platforms) {
      const img = this.add.tileSprite(x, y, n * 32, 14, `plat_${k}`).setOrigin(0).setDepth(21);
      const body = this.platforms.create(x + n * 16, y + 4, undefined) as Phaser.Physics.Arcade.Sprite;
      body.setVisible(false).setDisplaySize(n * 32, 8).refreshBody();
      const b = body.body as Phaser.Physics.Arcade.StaticBody;
      b.checkCollision.down = false; b.checkCollision.left = false; b.checkCollision.right = false;
      this.add.image(x + n * 16, y + 18, 'shadowOval').setTint(0x000000).setAlpha(0.2).setScale(n * 1.3, 1).setDepth(19);
      void img;
    }
    // foreground grass
    this.add.tileSprite(0, GROUND_Y + 34, L, 26, `fg_${k}`).setOrigin(0).setDepth(70).setAlpha(0.9);
    // end gate
    const gx = L - 60;
    this.add.image(gx, GROUND_Y - 40, 'glow').setTint(0xfff0b0).setBlendMode(Phaser.BlendModes.ADD).setScale(2.2, 3).setDepth(15).setAlpha(0.6);
    this.add.particles(gx, GROUND_Y - 10, 'p2', { speedY: { min: -60, max: -20 }, speedX: { min: -10, max: 10 }, lifespan: 1400, x: { min: -20, max: 20 }, tint: [0xfff0b0, 0xffd166], alpha: { start: 1, end: 0 }, frequency: 80, blendMode: 'ADD' }).setDepth(16);

    this.physics.world.setBounds(0, -200, L, H + 400);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.physics.world.gravity.y = 900;

    this.fx = new FxKit(this);
    this.combat = new Combat(this);
    this.player = new Player(this, 80);
    this.player.spr.setCollideWorldBounds(true);
    this.physics.add.collider(this.player.spr, this.ground);
    this.platCollider = this.physics.add.collider(this.player.spr, this.platforms, undefined, () => this.dropT <= 0 && this.player.body.velocity.y >= 0);
    this.bounds = { left: 0, right: L };

    const cam = this.cameras.main;
    cam.setBounds(0, 0, L, H);
    cam.startFollow(this.player.spr, true, 0.12, 0.12, -40, 40);
    cam.setDeadzone(60, 120);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const k2 = (...codes: number[]) => codes.map((c) => kb.addKey(c, true, false));
    this.keys = {
      left: k2(K.A, K.LEFT), right: k2(K.D, K.RIGHT), up: k2(K.W, K.UP), down: k2(K.S, K.DOWN),
      jump: k2(K.W, K.SPACE, K.UP), attack: [], dash: k2(K.SHIFT),
      s1: k2(K.Q), s2: k2(K.E), s3: k2(K.R), ult: k2(K.F),
    };
    // buffered presses: a tap is never lost even if pressed and released within one frame
    const codeToAction = new Map<number, keyof Keys>();
    (Object.keys(this.keys) as (keyof Keys)[]).forEach((a) => this.keys[a].forEach((key) => { if (!codeToAction.has(key.keyCode) || a === 'jump') codeToAction.set(key.keyCode, a); }));
    codeToAction.set(K.UP, 'jump');
    codeToAction.set(K.W, 'jump');
    // basic attack = left mouse button (holding it keeps the combo going)
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (!p.wasTouch && p.leftButtonDown()) this.buf.set('attack', this.time.now); });
    this.touch = { dx: 0, down: false, jumpHeld: false, attackHeld: false };
    this.buf.clear();
    kb.on('keydown', (e: KeyboardEvent) => { if (e.repeat) return; const a = codeToAction.get(e.keyCode); if (a) this.buf.set(a, this.time.now); });
    kb.on('keydown-ESC', () => this.pauseGame());
    kb.on('keydown-P', () => this.pauseGame());
    this.events.once('shutdown', () => { kb.removeAllListeners('keydown'); kb.removeAllListeners('keydown-ESC'); kb.removeAllListeners('keydown-P'); this.scene.stop('Hud'); });

    this.scene.launch('Hud', { battle: this });
    this.startTime = this.time.now;
    playBgm(this, this.stage.idx === 6 ? 'boss' : 'stage');
    this.banner(`${this.stage.id}  ${this.stage.name}`, this.stage.desc);
  }

  // ------------------------------------------------------------------ API used by combat/skills
  addProj(o: ProjOpts) { const p = new Projectile(this, o); this.projs.push(p); return p; }
  addEnemy(e: Enemy) {
    this.enemies.push(e);
    this.physics.add.collider(e.spr, this.ground);
    return e;
  }
  arenaBounds() { return this.bounds; }

  buf = new Map<keyof Keys, number>();
  /** True if the action was pressed within the buffer window (does not consume). */
  peek(a: keyof Keys) { const t = this.buf.get(a); return t !== undefined && this.time.now - t < 160; }
  /** Consumes a buffered press. */
  take(a: keyof Keys) { const ok = this.peek(a); this.buf.delete(a); return ok; }
  /** Left mouse button currently held. */
  get attackHeld() { const p = this.input.activePointer; return (p.isDown && !p.wasTouch && p.leftButtonDown()) || this.touch.attackHeld; }
  /** On-screen controls state (written by the HUD on touch devices). */
  touch = { dx: 0, down: false, jumpHeld: false, attackHeld: false };
  /** Presses an action as if its key had just been pressed. */
  press(a: keyof Keys) { this.buf.set(a, this.time.now); }

  hitstop(ms: number) { if (ms > 0) this.stopUntil = Math.max(this.stopUntil, this.time.now + ms); }

  onPlayerHit(t: Fighter, h: HitInfo, o: HitboxOpts) {
    const now = this.time.now;
    if (!o.noSpark) this.fx.hitspark(t.x + (Math.random() - 0.5) * 8, t.y + (Math.random() - 0.5) * 8, h.color, h.heavy || h.crit);
    if (now - this.lastHitSfx > 45) { sfx(this, h.heavy || h.crit ? 'hitHeavy' : 'hit', { vol: h.heavy ? 0.7 : 1 }); this.lastHitSfx = now; }
    if (o.hitstop) this.hitstop(h.crit ? o.hitstop * 1.4 : o.hitstop);
    if (h.heavy) this.fx.shake(0.005, 90);
    this.combo++; this.comboT = 2200; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.player.gainUlt(h.skill ? 0.7 : 1.6);
    this.player.hitCount++;
  }

  onEnemyDead(e: Enemy) {
    this.kills++;
    const gold = Math.round((e.isBoss ? 120 : e.elite ? 18 : 6) * (1 + 0.15 * (this.stage.lv - 1)));
    const n = Math.min(10, Math.ceil(gold / 6));
    for (let i = 0; i < n; i++) {
      const c = this.add.image(e.x, e.y, 'ic_gold').setDepth(40).setScale(0.8);
      const vx = (Math.random() - 0.5) * 160, vy = -120 - Math.random() * 120;
      let tx = c.x, ty = c.y;
      this.tweens.addCounter({ from: 0, to: 1, duration: 450, onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        tx = e.x + vx * t; ty = Math.min(GROUND_Y - 6, e.y + vy * t + 400 * t * t);
        c.setPosition(tx, ty);
      }, onComplete: () => {
        this.tweens.add({ targets: c, x: { getEnd: () => this.player.x }, y: { getEnd: () => this.player.y }, scale: 0.4, duration: 260 + i * 25, delay: 120, ease: 'Cubic.easeIn', onComplete: () => {
          c.destroy(); sfx(this, 'coin', { vol: 0.35 });
          this.goldEarned += Math.round(gold / n);
        } });
      } });
    }
    if (e.isBoss) {
      this.events.emit('boss', null);
      this.combat.boxes.filter((b) => b.o.team === 'e').forEach((b) => (b.dead = true));
      this.projs.filter((p) => p.o.team === 'e').forEach((p) => p.end('time'));
      // minions fall with their master
      this.time.delayedCall(250, () => {
        for (const m of this.enemies) if (m.alive && m !== e) m.die({ dmg: m.hp, dir: Math.sign(m.x - e.x) || 1, kbx: 0, kby: 0, stun: 0, crit: false, skill: true, pierce: true, heavy: true, freeze: 0, slow: 0, color: 0xffffff, srcX: e.x });
      });
    }
  }

  onPlayerDead() {
    if (this.phase === 'dead' || this.phase === 'clear') return;
    this.phase = 'dead';
    this.time.delayedCall(400, () => this.finish(false));
  }

  pauseGame() {
    if (this.phase === 'dead' || this.phase === 'clear' || this.frozen) return;
    sfx(this, 'click');
    this.scene.pause();
    this.scene.pause('Hud');
    this.scene.launch('Pause', { stageId: this.stage.id });
  }

  // ------------------------------------------------------------------ cinematic helpers
  banner(title: string, sub: string, color = UI.gold) {
    const c = this.add.container(W / 2, 70).setScrollFactor(0).setDepth(960);
    const band = this.add.rectangle(0, 0, W, 44, 0x0b0714, 0.75);
    const t1 = this.add.text(0, -8, title, { fontFamily: FONT_L, fontSize: '15px', color: '#' + color.toString(16), stroke: '#0b0714', strokeThickness: 4, resolution: 1 }).setOrigin(0.5);
    const t2 = this.add.text(0, 11, sub, { fontFamily: FONT_B, fontSize: '12px', color: '#d8d0f0', resolution: 1 }).setOrigin(0.5);
    const l1 = this.add.rectangle(0, -22, W, 1, color, 0.8), l2 = this.add.rectangle(0, 22, W, 1, color, 0.8);
    c.add([band, l1, l2, t1, t2]);
    c.setAlpha(0); band.setScale(1, 0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this.tweens.add({ targets: band, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t1, x: { from: -40, to: 0 }, duration: 400, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 2000, duration: 400, onComplete: () => c.destroy() });
  }

  cutIn(abilityId: string, skillName: string, cb: () => void) {
    const a = abilityById(abilityId);
    this.frozen = true;
    this.physics.world.pause();
    this.enemies.forEach((e) => e.spr.anims.pause());
    sfx(this, 'equip');
    sfx(this, 'swingHeavy', { rate: 0.6 });
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(970);
    const dark = this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0);
    const band = this.add.container(0, H / 2);
    const stripes: Phaser.GameObjects.Rectangle[] = [];
    [[-46, 6, a.fx2], [-36, 72, a.fx], [40, 6, a.fx2]].forEach(([y, h, col]) => {
      const r = this.add.rectangle(W / 2, y as number, W + 40, h as number, col as number, (h as number) > 10 ? 0.9 : 1);
      stripes.push(r);
    });
    const inner = this.add.rectangle(W / 2, 0, W + 40, 60, mix(a.fx, 0x0b0714, 0.55), 1);
    band.add([...stripes, inner]);
    band.setRotation(-0.08);
    const hero = this.add.image(-160, H / 2 + 6, 'heroBig_' + a.id).setScale(1.3).setRotation(-0.08);
    const glow = this.add.image(W * 0.3, H / 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(a.fx).setScale(5, 2).setAlpha(0.6);
    const name = this.add.text(W + 200, H / 2 - 12, skillName, { fontFamily: FONT_L, fontSize: '15px', color: '#ffffff', stroke: '#0b0714', strokeThickness: 5, resolution: 1 }).setOrigin(0.5).setScale(2.2).setRotation(-0.08);
    const sub = this.add.text(W + 200, H / 2 + 22, `${a.en} ULTIMATE`, { fontFamily: FONT_B, fontSize: '12px', color: '#' + mix(a.fx, 0xffffff, 0.5).toString(16), stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5).setRotation(-0.08);
    c.add([dark, glow, band, hero, name, sub]);
    band.setScale(1, 0);
    this.tweens.add({ targets: band, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: hero, x: W * 0.28, duration: 260, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [name], x: W * 0.64, duration: 260, delay: 60, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [sub], x: W * 0.64, duration: 260, delay: 120, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: hero, x: W * 0.33, duration: 700, delay: 260 });
    this.fx.speedLines(0xffffff, 700, 26);
    this.time.delayedCall(950, () => {
      this.tweens.add({ targets: [hero, name, sub], x: '-=' + (W + 300), duration: 220, ease: 'Cubic.easeIn' });
      this.tweens.add({ targets: band, scaleY: 0, duration: 220, delay: 80 });
      this.tweens.add({ targets: [dark, glow], alpha: 0, duration: 260, delay: 60, onComplete: () => c.destroy() });
      this.time.delayedCall(150, () => {
        this.frozen = false;
        this.physics.world.resume();
        this.enemies.forEach((e) => e.alive && e.frozen <= 0 && e.spr.anims.resume());
        cb();
      });
    });
  }

  showGo() {
    if (this.goArrow) return;
    const c = this.add.container(W - 60, H / 2 - 30).setScrollFactor(0).setDepth(900);
    const t = this.add.text(0, 0, 'GO ▶', { fontFamily: FONT_L, fontSize: '15px', color: '#ffd166', stroke: '#0b0714', strokeThickness: 4, resolution: 1 }).setOrigin(0.5);
    c.add(t);
    this.tweens.add({ targets: c, x: W - 48, duration: 300, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: t, alpha: 0.4, duration: 300, yoyo: true, repeat: -1 });
    this.goArrow = c;
  }

  // ------------------------------------------------------------------ arena flow
  startArena(a: Arena) {
    this.phase = 'arena';
    this.arena = a;
    this.waveIdx = 0;
    this.bossSpawned = false;
    this.waveDelay = 600;
    this.goArrow?.destroy(); this.goArrow = undefined;
    const right = a.boss === 'tree' ? a.x + W - 110 : a.x + W;
    this.bounds = { left: a.x, right };
    this.physics.world.setBounds(a.x, -200, W, H + 400);
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(a.x + W / 2, H / 2, 450, 'Cubic.easeInOut', false, (_c, p) => {
      if (p >= 1) { cam.setBounds(a.x, 0, W, H); }
    });
    this.lockWalls(a.x, right);
    sfx(this, 'confirm2', { rate: 0.8 });
  }

  wallFx: Phaser.GameObjects.GameObject[] = [];
  lockWalls(l: number, r: number) {
    this.wallFx.forEach((o) => o.destroy());
    this.wallFx = [];
    for (const x of [l + 3, r - 3]) {
      const w = this.add.image(x, GROUND_Y - 80, 'beam').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff4d6d).setDisplaySize(10, 200).setAlpha(0).setDepth(60);
      this.tweens.add({ targets: w, alpha: 0.5, duration: 300 });
      this.tweens.add({ targets: w, displayWidth: 14, duration: 500, yoyo: true, repeat: -1 });
      this.wallFx.push(w);
    }
  }

  spawnWave() {
    const a = this.arena!;
    const wave = a.waves[this.waveIdx];
    let n = 0;
    for (const sp of wave) {
      for (let i = 0; i < sp.n; i++) {
        const side = (n % 3 === 2) ? -1 : 1;
        const x = side > 0 ? a.x + W - 60 - (n % 3) * 34 - Math.random() * 20 : a.x + 50 + Math.random() * 30;
        const delay = n * 160;
        this.time.delayedCall(delay, () => {
          if (this.phase !== 'arena') return;
          this.addEnemy(spawnEnemy(this, sp.t, x, this.stage.lv, sp.elite));
        });
        n++;
      }
    }
    this.events.emit('wave', this.waveIdx + 1, a.waves.length);
  }

  spawnBossNow() {
    const a = this.arena!;
    this.bossSpawned = true;
    const x = a.boss === 'tree' ? a.x + W - 64 : a.x + W - 140;
    this.time.delayedCall(400, () => {
      const b = spawnBoss(this, a.boss!, x, this.stage.lv);
      this.addEnemy(b);
      this.boss = b;
      this.events.emit('boss', b);
      this.fx.shake(0.01, 400);
      sfx(this, 'hitHeavy', { rate: 0.5 });
      this.banner(b.title, a.label === '보스' ? 'BOSS' : 'MID BOSS', a.label === '보스' ? 0xff5a3a : 0xffd166);
      if (a.boss === 'tree') playBgm(this, 'boss');
    });
  }

  endArena() {
    this.phase = 'roam';
    this.arena = null;
    this.arenaIdx++;
    this.boss = null;
    this.events.emit('boss', null);
    this.bounds = { left: 0, right: this.stage.length };
    this.physics.world.setBounds(0, -200, this.stage.length, H + 400);
    this.wallFx.forEach((o) => this.tweens.add({ targets: o, alpha: 0, duration: 300, onComplete: () => o.destroy() }));
    this.wallFx = [];
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.stage.length, H);
    cam.startFollow(this.player.spr, true, 0.12, 0.12, -40, 40);
    sfx(this, 'confirm');
    const lastBoss = this.arenaIdx >= this.stage.arenas.length && this.stage.arenas[this.stage.arenas.length - 1].boss === 'tree';
    if (lastBoss) { this.time.delayedCall(1200, () => this.finish(true)); return; }
    this.showGo();
  }

  // ------------------------------------------------------------------ results
  finish(win: boolean) {
    if (win) { if (this.phase === 'clear') return; this.phase = 'clear'; }
    this.player.body.setVelocity(0, 0);
    const time = Math.round(this.elapsed / 1000);
    const hpRatio = this.player.hp / this.player.maxHp;
    const par = 120 + this.stage.idx * 25;
    const stars = win ? 1 + (hpRatio >= 0.5 ? 1 : 0) + (time <= par ? 1 : 0) : 0;
    let gold = this.goldEarned;
    let gems = 0;
    let first = false;
    if (win) {
      gold += Math.round(this.stage.gold * (1 + 0.15 * (stars - 1)));
      first = !Save.d.cleared[this.stage.id];
      gems = first ? this.stage.firstGems : this.stage.gems;
      Save.d.cleared[this.stage.id] = Math.max(Save.d.cleared[this.stage.id] ?? 0, stars);
    } else gold = Math.round(gold * 0.5);
    Save.d.gold += gold;
    Save.d.gems += gems;
    Save.write();
    if (win) {
      sfx(this, 'reveal');
      this.player.play('jump');
      this.player.body.setVelocityY(-260);
      this.fx.burst(this.player.x, this.player.y, { tex: 'star4', n: 20, color: [0xffd166, 0xffffff], speed: [60, 200] });
    }
    this.time.delayedCall(win ? 900 : 300, () => {
      this.scene.pause('Hud');
      this.scene.launch('Result', { win, stars, gold, gems, first, time, par, kills: this.kills, combo: this.maxCombo, hp: hpRatio, stageId: this.stage.id });
      this.scene.pause();
    });
  }

  // ------------------------------------------------------------------ main loop
  update(_t: number, dtRaw: number) {
    const dt = Math.min(dtRaw, 34);
    for (const l of this.layers) l.t.tilePositionX = this.cameras.main.scrollX * l.f;
    if (this.frozen) return;
    const now = this.time.now;
    const stopped = now < this.stopUntil;
    if (stopped) {
      if (!this.physics.world.isPaused) { this.physics.world.pause(); this.player.spr.anims.pause(); this.enemies.forEach((e) => e.spr.anims.pause()); }
      return;
    } else if (this.physics.world.isPaused) {
      this.physics.world.resume();
      this.player.spr.anims.resume();
      this.enemies.forEach((e) => e.alive && e.frozen <= 0 && e.spr.anims.resume());
    }
    if (this.phase !== 'clear' && this.phase !== 'dead') this.elapsed += dt;
    if (this.dropT > 0) this.dropT -= dt;
    if ((this.keys.down.some((k) => k.isDown) || this.touch.down) && this.peek('jump') && this.player.onGround && this.player.spr.y < GROUND_Y - 4) {
      this.take('jump'); this.dropT = 260; this.player.body.setVelocityY(60);
    }
    if (this.phase !== 'clear') this.player.update(dt, this.keys);
    // clamp to arena walls
    const p = this.player.spr;
    if (p.x < this.bounds.left + 10) { p.x = this.bounds.left + 10; if (this.player.body.velocity.x < 0) this.player.body.setVelocityX(0); }
    if (p.x > this.bounds.right - 10) { p.x = this.bounds.right - 10; if (this.player.body.velocity.x > 0) this.player.body.setVelocityX(0); }
    for (const e of this.enemies) e.update(dt);
    for (const pr of this.projs) pr.update(dt);
    this.projs = this.projs.filter((x) => !x.dead);
    this.combat.update(dt);
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    // flow
    if (this.phase === 'roam') {
      const next = this.stage.arenas[this.arenaIdx];
      if (next && p.x > next.x + W * 0.45) this.startArena(next);
      if (!next && p.x > this.stage.length - 80) this.finish(true);
    } else if (this.phase === 'arena' && this.arena) {
      const a = this.arena;
      const alive = this.enemies.some((e) => e.alive);
      if (!alive) {
        this.waveDelay -= dt;
        if (this.waveDelay <= 0) {
          if (this.waveIdx < a.waves.length) { this.spawnWave(); this.waveIdx++; this.waveDelay = 900; }
          else if (a.boss && !this.bossSpawned) { this.spawnBossNow(); this.waveDelay = 1500; }
          else this.endArena();
        }
      } else this.waveDelay = Math.max(this.waveDelay, 700);
    }
  }
}
