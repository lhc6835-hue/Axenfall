// Reusable visual effects. Everything is tween/particle driven so it stays smooth at 60fps.
import { W, H, FONT_B } from '../core/const';
import { mix } from '../art/pixel';

type S = Phaser.Scene;
const ADD = Phaser.BlendModes.ADD;

export interface BurstOpts {
  tex?: string; n?: number; color?: number | number[]; speed?: [number, number]; life?: [number, number];
  scale?: [number, number]; angle?: [number, number]; gravity?: number; add?: boolean; depth?: number;
  alpha?: [number, number]; rotate?: boolean; drag?: number; spread?: number;
}

export class FxKit {
  depth = 50;
  constructor(public s: S) {}

  burst(x: number, y: number, o: BurstOpts = {}) {
    const em = this.s.add.particles(x, y, o.tex ?? 'p2', {
      speed: { min: o.speed?.[0] ?? 40, max: o.speed?.[1] ?? 160 },
      lifespan: { min: o.life?.[0] ?? 250, max: o.life?.[1] ?? 550 },
      scale: { start: o.scale?.[0] ?? 1, end: o.scale?.[1] ?? 0 },
      alpha: { start: o.alpha?.[0] ?? 1, end: o.alpha?.[1] ?? 0 },
      angle: { min: o.angle?.[0] ?? 0, max: o.angle?.[1] ?? 360 },
      gravityY: o.gravity ?? 0,
      rotate: o.rotate ? { min: 0, max: 360 } : 0,
      tint: o.color ?? 0xffffff,
      blendMode: o.add === false ? 'NORMAL' : 'ADD',
      emitting: false,
      ...(o.spread ? { emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, o.spread) } as Phaser.Types.GameObjects.Particles.EmitZoneData } : {}),
    });
    em.setDepth(o.depth ?? this.depth + 2);
    em.explode(o.n ?? 12);
    this.s.time.delayedCall((o.life?.[1] ?? 550) + 100, () => em.destroy());
    return em;
  }

  /** Continuous emitter that follows a target until stopped. */
  trail(target: { x: number; y: number }, o: BurstOpts & { freq?: number }) {
    const em = this.s.add.particles(0, 0, o.tex ?? 'p2', {
      follow: target as Phaser.Types.Math.Vector2Like,
      speed: { min: o.speed?.[0] ?? 5, max: o.speed?.[1] ?? 30 },
      lifespan: { min: o.life?.[0] ?? 200, max: o.life?.[1] ?? 400 },
      scale: { start: o.scale?.[0] ?? 1, end: o.scale?.[1] ?? 0 },
      alpha: { start: o.alpha?.[0] ?? 1, end: 0 },
      angle: { min: o.angle?.[0] ?? 0, max: o.angle?.[1] ?? 360 },
      gravityY: o.gravity ?? 0,
      tint: o.color ?? 0xffffff,
      blendMode: o.add === false ? 'NORMAL' : 'ADD',
      frequency: o.freq ?? 20,
      ...(o.spread ? { emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, o.spread) } as Phaser.Types.GameObjects.Particles.EmitZoneData } : {}),
    });
    em.setDepth(o.depth ?? this.depth + 1);
    return {
      em,
      stop: () => { em.stop(); this.s.time.delayedCall((o.life?.[1] ?? 400) + 50, () => em.destroy()); },
    };
  }

  /** Crescent slash arc. angle in radians, flip for direction. */
  slash(x: number, y: number, dir: number, color: number, o: { scale?: number; angle?: number; dur?: number; big?: boolean; thin?: number; depth?: number } = {}) {
    const sc = o.scale ?? 1;
    const key = o.big ? 'slashBig' : 'slash';
    const ang = o.angle ?? 0;
    const mk = (tint: number, k: number, alpha: number) => {
      const im = this.s.add.image(x, y, key).setBlendMode(ADD).setTint(tint).setAlpha(alpha).setDepth(o.depth ?? this.depth + 3);
      im.setFlipX(dir < 0).setRotation(dir < 0 ? -ang : ang).setScale(sc * 0.55 * k, sc * (o.thin ?? 1) * k);
      this.s.tweens.add({ targets: im, scaleX: sc * 1.12 * k, alpha: 0, duration: o.dur ?? 200, ease: 'Cubic.easeOut', onComplete: () => im.destroy() });
      return im;
    };
    mk(color, 1.08, 0.9);
    mk(mix(color, 0xffffff, 0.75), 0.9, 1);
  }

  ring(x: number, y: number, color: number, from: number, to: number, dur = 300, thin = false, depth?: number) {
    const r = this.s.add.image(x, y, thin ? 'ringThin' : 'ring').setBlendMode(ADD).setTint(color).setDepth(depth ?? this.depth + 2);
    r.setScale(from / 48);
    this.s.tweens.add({ targets: r, scale: to / 48, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
    return r;
  }

  glow(x: number, y: number, color: number, scale = 1, dur = 250, alpha = 1, depth?: number) {
    const g = this.s.add.image(x, y, 'glow').setBlendMode(ADD).setTint(color).setScale(scale).setAlpha(alpha).setDepth(depth ?? this.depth + 1);
    this.s.tweens.add({ targets: g, alpha: 0, scale: scale * 1.3, duration: dur, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
    return g;
  }

  hitspark(x: number, y: number, color: number, big = false) {
    const sp = this.s.add.image(x, y, 'hitspark').setBlendMode(ADD).setTint(mix(color, 0xffffff, 0.5)).setDepth(this.depth + 4);
    sp.setScale(big ? 1.6 : 0.9).setRotation(Math.random() * Math.PI);
    this.s.tweens.add({ targets: sp, scale: big ? 2.4 : 1.4, alpha: 0, duration: big ? 220 : 150, onComplete: () => sp.destroy() });
    this.burst(x, y, { tex: 'p2', n: big ? 14 : 7, color: [color, 0xffffff], speed: [80, big ? 260 : 180], life: [150, 320] });
  }

  flash(color = 0xffffff, alpha = 0.6, dur = 160) {
    const r = this.s.add.rectangle(0, 0, W, H, color, alpha).setOrigin(0).setScrollFactor(0).setDepth(900).setBlendMode(ADD);
    this.s.tweens.add({ targets: r, alpha: 0, duration: dur, onComplete: () => r.destroy() });
  }

  shake(intensity = 0.006, dur = 120) { this.s.cameras.main.shake(dur, intensity); }

  afterimage(sprite: Phaser.GameObjects.Sprite, color: number, dur = 220, alpha = 0.6) {
    const im = this.s.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY).setFlipX(sprite.flipX).setScale(sprite.scaleX, sprite.scaleY)
      .setTintFill(color).setAlpha(alpha).setBlendMode(ADD).setDepth(sprite.depth - 1);
    this.s.tweens.add({ targets: im, alpha: 0, duration: dur, onComplete: () => im.destroy() });
  }

  /** Jagged lightning bolt between two points; redraws a few times then fades. */
  lightning(x1: number, y1: number, x2: number, y2: number, color: number, width = 2, dur = 220) {
    const g = this.s.add.graphics().setDepth(this.depth + 5).setBlendMode(ADD);
    const draw = () => {
      g.clear();
      const segs = Math.max(4, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 14));
      const pts: [number, number][] = [[x1, y1]];
      const nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
      for (let i = 1; i < segs; i++) {
        const t = i / segs, off = (Math.random() - 0.5) * 18;
        pts.push([x1 + (x2 - x1) * t + (nx / nl) * off, y1 + (y2 - y1) * t + (ny / nl) * off]);
      }
      pts.push([x2, y2]);
      g.lineStyle(width + 4, color, 0.35).beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokePath();
      g.lineStyle(width, mix(color, 0xffffff, 0.7), 1).beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokePath();
    };
    draw();
    const ev = this.s.time.addEvent({ delay: 45, repeat: 3, callback: draw });
    this.s.tweens.add({ targets: g, alpha: 0, delay: dur * 0.5, duration: dur * 0.5, onComplete: () => { ev.remove(); g.destroy(); } });
  }

  /** Vertical beam (pillars, lightning strikes, light shafts). */
  beam(x: number, yTop: number, yBot: number, width: number, color: number, dur = 300) {
    const h = yBot - yTop;
    const b = this.s.add.image(x, yBot, 'beam').setOrigin(0.5, 1).setBlendMode(ADD).setTint(color).setDepth(this.depth + 3);
    b.setDisplaySize(width, h);
    const core = this.s.add.image(x, yBot, 'beam').setOrigin(0.5, 1).setBlendMode(ADD).setTint(0xffffff).setDepth(this.depth + 4);
    core.setDisplaySize(width * 0.4, h);
    this.s.tweens.add({ targets: [b, core], scaleX: 0, alpha: 0, duration: dur, ease: 'Cubic.easeIn', onComplete: () => { b.destroy(); core.destroy(); } });
    return b;
  }

  dust(x: number, y: number, n = 6, dir = 0) {
    this.burst(x, y, { tex: 'smoke', n, color: 0xd8c8b0, speed: [20, 70], life: [250, 500], scale: [0.6, 0.1], angle: dir > 0 ? [180, 250] : dir < 0 ? [-70, 0] : [190, 350], add: false, alpha: [0.7, 0] });
  }

  number(x: number, y: number, value: number, crit: boolean, color = 0xffffff) {
    const t = this.s.add.text(x, y, String(value), {
      fontFamily: FONT_B, fontSize: crit ? '15px' : '12px', color: '#' + (crit ? 0xffd166 : color).toString(16).padStart(6, '0'),
      stroke: '#0b0714', strokeThickness: 3, resolution: 1,
    }).setOrigin(0.5).setDepth(800);
    if (crit) t.setText(value + '!');
    t.setScale(crit ? 1.8 : 1.3);
    this.s.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.s.tweens.add({ targets: t, y: y - 26 - Math.random() * 8, x: x + (Math.random() - 0.5) * 16, duration: 600, ease: 'Cubic.easeOut' });
    this.s.tweens.add({ targets: t, alpha: 0, delay: 450, duration: 250, onComplete: () => t.destroy() });
  }

  label(x: number, y: number, s: string, color: number) {
    const t = this.s.add.text(x, y, s, { fontFamily: FONT_B, fontSize: '12px', color: '#' + color.toString(16).padStart(6, '0'), stroke: '#0b0714', strokeThickness: 3, resolution: 1 })
      .setOrigin(0.5).setDepth(800);
    this.s.tweens.add({ targets: t, y: y - 20, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  /** Expanding ground shock: dust both ways plus a flat ring. */
  groundSlam(x: number, y: number, color: number, size = 1) {
    this.dust(x - 6, y, 6, -1); this.dust(x + 6, y, 6, 1);
    const r = this.s.add.image(x, y, 'ring').setBlendMode(ADD).setTint(color).setDepth(this.depth + 2).setScale(0.2, 0.06);
    this.s.tweens.add({ targets: r, scaleX: 2.4 * size, scaleY: 0.5 * size, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
    this.burst(x, y, { tex: 'p2', n: 14, color: [color, 0xffffff], speed: [60, 220], angle: [200, 340], gravity: 400, life: [300, 600] });
  }

  /** Horizontal speed lines across the screen (ults, dashes). */
  speedLines(color: number, dur = 500, n = 18) {
    const cam = this.s.cameras.main;
    for (let i = 0; i < n; i++) {
      const y = Math.random() * H;
      const l = this.s.add.image(W + 40, y, 'line').setScrollFactor(0).setDepth(880).setBlendMode(ADD).setTint(color).setScale(1 + Math.random() * 3, 1 + (Math.random() < 0.3 ? 1 : 0));
      this.s.tweens.add({ targets: l, x: -100, duration: 160 + Math.random() * 160, delay: Math.random() * dur, onComplete: () => l.destroy() });
    }
    return cam;
  }
}
