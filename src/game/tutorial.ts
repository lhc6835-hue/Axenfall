// A hands-on tutorial: a run with no director, where each step sets up a small exercise and waits
// until the player has actually done it. Nobody can die here; the parry steps slow time just before
// a blow lands for the first few tries so the timing can be felt.
import { Gfx } from '../engine/gfx';
import { TAU, rand } from '../engine/math';
import { sfx } from '../engine/audio';
import { Enemy, type EType } from './enemies';
import type { Run } from './run';

export interface TutView {
  idx: number;
  total: number;
  title: string;
  /** may contain <kbd> and <b> */
  body: string;
  progress: string;
  hint: string;
  /** the step was just cleared */
  cleared: boolean;
  finished: boolean;
}

interface Step {
  title: string;
  body: string;
  enter(): void;
  /** true once the exercise is done */
  update(dt: number): boolean;
  progress?(): string;
}

export class Tutorial {
  idx = 0;
  /** time in the current step */
  t = 0;
  /** after a step is cleared, a short beat of praise before the next one */
  okT = -1;
  finished = false;
  hint = '';
  private hintT = 0;
  private steps: Step[];
  /** world points the current step wants the player to reach */
  marks: { x: number; y: number }[] = [];
  /** the enemy the current step is about */
  focus: Enemy | null = null;
  private group: Enemy[] = [];
  private base = { parries: 0, perfects: 0, hits: 0, dodges: 0 };
  private assistLeft = 0;
  private lastHits = 0;

  constructor(private run: Run, touch: boolean) {
    const K = (pc: string, tp: string) => (touch ? `<kbd>${tp}</kbd>` : `<kbd>${pc}</kbd>`);
    const slash = touch ? K('', '베기') : `${K('스페이스', '')} 또는 <kbd>마우스 클릭</kbd>`;
    this.steps = [
      {
        title: '이동',
        body: touch ? `화면 왼쪽을 끌어서 움직인다. 빛나는 표식 세 곳을 차례로 밟자.` : `${K('W A S D', '')} 또는 <kbd>방향키</kbd>로 움직인다. 빛나는 표식 세 곳을 차례로 밟자.`,
        enter: () => {
          const p = run.player;
          run.noGun = true;
          this.marks = [
            { x: p.x + 60, y: p.y - 6 },
            { x: p.x - 30, y: p.y + 48 },
            { x: p.x + 10, y: p.y - 58 },
          ];
        },
        update: () => {
          const p = run.player, m = this.marks[0];
          if (m && Math.hypot(p.x - m.x, p.y - m.y) < 12) {
            this.marks.shift();
            run.fx.ring(m.x, m.y, 3, 16, 0.3, 0x8ff3ff, 2);
            sfx.gem();
          }
          return this.marks.length === 0;
        },
        progress: () => `${3 - this.marks.length} / 3`,
      },
      {
        title: '자동 사격',
        body: '총은 직접 쏘지 않는다. <b>가장 가까운 적을 알아서 쏜다.</b> 적에게 다가가 총이 처리하는 걸 보자.',
        enter: () => {
          run.noGun = false;
          this.group = [0, 1, 2].map((i) => this.spawn('grunt', 70 + i * 18, (i - 1) * 34, { passive: true, hp: 30 }));
        },
        update: () => this.group.every((e) => e.dead),
        progress: () => `${this.group.filter((e) => e.dead).length} / 3`,
      },
      {
        title: '베기',
        body: `총은 잠시 쉰다. ${slash}로 칼을 휘둘러 허수아비 적을 베어 쓰러뜨리자. 칼은 ${touch ? '가장 위험한 쪽' : '마우스 쪽'}으로 휘두른다.`,
        enter: () => {
          run.noGun = true;
          this.group = [this.spawn('grunt', 36, 0, { passive: true, hp: 60 })];
        },
        update: () => this.group[0].dead,
      },
      {
        title: '패리',
        body: `적 머리 위에 <b class="warn">!</b>가 뜨면 공격이 온다. 공격이 닿기 직전 <b>적 쪽으로 베면 패리</b>. 막힌 적은 기절한다. 두 번 막아 보자.`,
        enter: () => {
          run.noGun = true;
          this.assistLeft = 3;
          this.group = [this.spawn('grunt', 34, 0, { cdFix: 1.6, wuMul: 1.8, hp: 99999 })];
        },
        update: () => {
          this.assist();
          if (run.hitsTaken > this.lastHits) this.say('맞았다. <b class="warn">!</b>가 하얗게 깜빡일 때 적 쪽으로 베자.');
          return run.parries - this.base.parries >= 2;
        },
        progress: () => `${Math.min(2, run.parries - this.base.parries)} / 2`,
      },
      {
        title: '반사',
        body: '날아오는 화살도 패리된다. <b>화살 쪽으로 베면</b> 튕겨 나가 <b>쏜 적에게 그대로 돌아간다.</b> 궁수에게 화살을 돌려주자.',
        enter: () => {
          run.noGun = true;
          this.assistLeft = 3;
          this.group = [this.spawn('archer', 105, -24, { still: true, cdFix: 2.1, wuMul: 1.3, hp: 99999 })];
        },
        update: () => {
          this.assist();
          if (run.hitsTaken > this.lastHits) this.say('맞았다. 화살이 칼 길이만큼 다가왔을 때 화살 쪽으로 베자.');
          const a = this.group[0];
          return a.hp < a.max;
        },
      },
      {
        title: 'PERFECT',
        body: '칼날이 공격 방향을 <b>지나가는 바로 그 순간</b>에 막으면 <b class="gold">PERFECT</b>: 피해 3배에 시간이 느려진다. 조금 일찍 휘둘러, 칼이 막 지나갈 때 맞게 하자.',
        enter: () => {
          run.noGun = true;
          this.assistLeft = 2;
          this.group = [this.spawn('grunt', 34, 0, { cdFix: 1.6, wuMul: 1.5, hp: 99999 })];
        },
        update: () => {
          this.assist();
          const tries = run.parries - this.base.parries;
          if (tries >= 6 && run.perfects === this.base.perfects) {
            this.say('PERFECT는 연습이 필요하다. 실전에서 계속 노려 보자.');
            return true;
          }
          if (tries > 0 && run.perfects === this.base.perfects && this.t > 3) this.say('패리는 됐다. 조금 더 일찍 휘두르면 칼날이 딱 맞는다.');
          return run.perfects > this.base.perfects;
        },
        progress: () => `패리 ${run.parries - this.base.parries} · 퍼펙트 ${run.perfects - this.base.perfects}`,
      },
      {
        title: '대시',
        body: `${touch ? K('', '대시') : K('Shift', '')}로 대시한다. 대시하는 순간엔 <b>무적</b>이라 퍼져 오는 충격파를 뚫고 지나갈 수 있다. 두 번 뚫어 보자.`,
        enter: () => {
          run.noGun = true;
          this.group = [];
          this.waveT = 0.8;
        },
        update: (dt) => {
          const p = run.player;
          this.waveT -= dt;
          if (this.waveT <= 0) {
            this.waveT = 2.4;
            const a = rand(0, TAU);
            const x = p.x + Math.cos(a) * 70, y = p.y + Math.sin(a) * 70;
            this.marks = [{ x, y }];
            run.wave(x, y, 6, 70, 170, 6, 0xff8a3a);
            run.fx.ring(x, y, 4, 22, 0.3, 0xffc090, 2);
            sfx.slam();
          }
          if (run.hitsTaken > this.lastHits) this.say('충격파의 고리가 닿기 직전에 대시하자.');
          return run.dashDodges - this.base.dodges >= 2;
        },
        progress: () => `${Math.min(2, run.dashDodges - this.base.dodges)} / 2`,
      },
      {
        title: '레벨업',
        body: '쓰러진 적이 떨어뜨린 <b class="blue">파란 보석</b>을 주우면 경험치가 찬다. 레벨이 오르면 <b>강화를 하나 고른다.</b>',
        enter: () => {
          run.noGun = false;
          this.marks = [];
          run.xp = 0;
          run.xpNeed = 6;
          this.group = [];
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            this.group.push(this.spawn('grunt', Math.cos(a) * 70, Math.sin(a) * 55, { passive: true, hp: 18 }));
          }
        },
        update: () => {
          const p = run.player;
          // once the targets are down, point at the nearest gem still on the floor
          if (this.group.every((e) => e.dead)) {
            const gems = run.drops.filter((d) => d.kind === 'xp');
            gems.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
            this.marks = gems.length ? [{ x: gems[0].x, y: gems[0].y }] : [];
            if (gems.length) this.say('파란 보석 위로 걸어가면 주워진다.');
            else if (run.level < 2 && !run.choosing && run.pending === 0) {
              // not enough yet: a few more targets
              this.group = [0, 1, 2].map((i) => this.spawn('grunt', 60 * Math.cos(i * 2.1), 50 * Math.sin(i * 2.1), { passive: true, hp: 18 }));
            }
          }
          return run.level >= 2 && !run.choosing && run.pending === 0;
        },
        progress: () => `Lv ${run.level}`,
      },
    ];
    this.enter();
  }

  private waveT = 0;

  get view(): TutView {
    const s = this.steps[Math.min(this.idx, this.steps.length - 1)];
    return {
      idx: this.idx,
      total: this.steps.length,
      title: s.title,
      body: s.body,
      progress: s.progress ? s.progress() : '',
      hint: this.hint,
      cleared: this.okT >= 0,
      finished: this.finished,
    };
  }

  private spawn(type: EType, dx: number, dy: number, o: { passive?: boolean; still?: boolean; cdFix?: number; wuMul?: number; hp?: number }) {
    const p = this.run.player;
    const e = new Enemy(type, p.x + dx, p.y + dy, 1, false);
    e.spawnT = 0.35;
    e.homeX = e.x;
    e.homeY = e.y;
    e.passive = !!o.passive;
    e.still = !!o.still;
    e.cdFix = o.cdFix ?? 0;
    e.wuMul = o.wuMul ?? 1;
    e.cd = 1.2;
    if (o.hp) e.hp = e.max = o.hp;
    this.run.enemies.push(e);
    this.run.fx.ring(e.x, e.y, 2, 14, 0.3, 0xffffff, 1.5);
    return e;
  }

  private say(h: string) {
    if (this.hint === h) return;
    this.hint = h;
    this.hintT = 4;
  }

  /** for the first few blows, time slows just before they land so the parry timing can be read */
  private assist() {
    if (this.assistLeft <= 0) return;
    const run = this.run, p = run.player;
    let close = false;
    for (const e of run.enemies) {
      if (e.dead || e.state !== 'windup') continue;
      if (e.t > e.spec.windup * e.wuMul * 0.55) close = true;
    }
    for (const s of run.shots) {
      if (!s.friendly && Math.hypot(s.x - p.x, s.y - p.y) < 48) close = true;
    }
    if (close) {
      run.slow = Math.max(run.slow, 0.05);
      run.slowScale = 0.4;
    }
    // each parry or hit uses up one assisted try
    const used = run.parries - this.base.parries + (run.hitsTaken - this.base.hits);
    if (used >= 3) this.assistLeft = 0;
  }

  private enter() {
    const run = this.run;
    // a clean slate for every exercise
    for (const e of run.enemies) e.dead = true;
    run.enemies.length = 0;
    run.shots.length = 0;
    run.waves.length = 0;
    run.player.hp = run.mods.maxHp;
    this.marks = [];
    this.focus = null;
    this.t = 0;
    this.hint = '';
    this.base = { parries: run.parries, perfects: run.perfects, hits: run.hitsTaken, dodges: run.dashDodges };
    this.lastHits = run.hitsTaken;
    this.steps[this.idx].enter();
  }

  update(dt: number) {
    if (this.finished) return;
    const run = this.run;
    this.t += dt;
    this.hintT -= dt;
    if (this.hintT <= 0 && this.okT < 0) this.hint = '';
    // keep the player topped up so the lessons never end in a death
    if (run.player.hp < run.mods.maxHp * 0.5) run.player.hp = Math.min(run.mods.maxHp, run.player.hp + dt * 40);
    this.focus = this.group.find((e) => !e.dead) ?? null;
    if (this.okT >= 0) {
      this.okT -= dt;
      if (this.okT < 0) {
        this.idx++;
        if (this.idx >= this.steps.length) {
          this.finished = true;
          return;
        }
        this.enter();
      }
      return;
    }
    const s = this.steps[this.idx];
    const done = s.update(dt);
    this.lastHits = run.hitsTaken;
    if (done) {
      this.okT = 1.1;
      this.hint = this.hint && this.idx === 5 && run.perfects === this.base.perfects ? this.hint : '';
      const p = run.player;
      run.fx.pop(p.x, p.y - 16, '좋아!', '#8ff3ff', 1.6, true);
      run.fx.ring(p.x, p.y, 4, 30, 0.35, 0x8ff3ff, 2);
      sfx.buy();
    }
  }

  // ---------------- drawing ----------------
  drawFloor(g: Gfx, time: number) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    this.marks.forEach((m, i) => {
      const first = i === 0;
      g.disc(m.x, m.y, 9, 0x8ff3ff, first ? 0.12 + pulse * 0.1 : 0.05, true);
      g.ring(m.x, m.y, 9 + (first ? pulse * 2 : 0), 1, first ? 0xbff8ff : 0x4a7a8a, first ? 1 : 0.6);
      if (first) g.glow(m.x, m.y, 18, 0x8ff3ff, 0.25 + pulse * 0.2);
    });
    if (this.focus && this.okT < 0) {
      const e = this.focus;
      g.ring(e.x, e.y + e.r * 0.6, e.r + 5 + pulse * 1.5, 1, 0xffe46a, 0.8, 0.45);
    }
  }

  /** an arrow at the screen edge pointing at a mark that is out of view */
  drawOver(g: Gfx, time: number) {
    const m = this.marks[0];
    if (!m) return;
    const sx = m.x + g.ox, sy = m.y + g.oy;
    const pad = 14;
    if (sx > pad && sx < g.w - pad && sy > pad && sy < g.h - pad) return;
    const cx = g.w / 2, cy = g.h / 2;
    const a = Math.atan2(sy - cy, sx - cx);
    // clamp onto the screen rectangle
    const kx = (g.w / 2 - pad) / Math.max(1e-3, Math.abs(Math.cos(a))), ky = (g.h / 2 - pad) / Math.max(1e-3, Math.abs(Math.sin(a)));
    const k = Math.min(kx, ky);
    const bob = Math.sin(time * 8) * 2;
    const px = cx + Math.cos(a) * (k - bob) - g.ox, py = cy + Math.sin(a) * (k - bob) - g.oy;
    const ca = Math.cos(a), sa = Math.sin(a);
    g.tri(px + ca * 6, py + sa * 6, px - sa * 4 - ca * 3, py + ca * 4 - sa * 3, px + sa * 4 - ca * 3, py - ca * 4 - sa * 3, 0xbff8ff);
    g.glow(px, py, 10, 0x8ff3ff, 0.4);
  }
}
