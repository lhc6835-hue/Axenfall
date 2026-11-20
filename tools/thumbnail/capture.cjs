// Renders the thumbnail scene frame by frame from the dev build and saves PNGs.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
const FPS = 30;
const FRAMES = Number(process.argv[3] || 165);
const DRY = process.argv[4] === 'dry';

(async () => {
  fs.mkdirSync(OUT + '/frames', { recursive: true });
  const b = await chromium.launch();
  // 1068x600 with a 200px-tall world gives an exact 3x pixel scale
  const p = await b.newPage({ viewport: { width: 1068, height: 600 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  // a seeded Math.random so a good take can be rendered again exactly
  const SEED = Number(process.argv[5] || 1);
  await p.addInitScript((seed) => {
    let a = seed >>> 0;
    window.__seedRandom = (s) => { a = s >>> 0; };
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, SEED);
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('parrycube_save_v1'));
    Object.assign(s, { fullscreen: false, cleared: 1, world: 2, tutorial: true, sound: false, music: false });
    s.guns.g_revolver = 2; s.swords.s_katana = 2; s.skins.push('k_neon');
    s.eq = { gun: 'g_revolver', sword: 's_katana', skin: 'k_neon' };
    localStorage.setItem('parrycube_save_v1', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(800);

  // ---- the logo, on a transparent background ----
  if (!DRY) {
    await p.waitForTimeout(2500); // let the title animation settle
    await p.evaluate(() => {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      document.getElementById('stage').style.visibility = 'hidden';
      for (const sel of ['.topbar', '.eqline', '.worlds', '.menu', '.best', '.help', '.tut-nudge']) document.querySelectorAll(sel).forEach((e) => (e.style.visibility = 'hidden'));
    });
    const logo = await p.$('.title.logo');
    await logo.screenshot({ path: OUT + '/logo.png', omitBackground: true });
    await p.evaluate(() => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
      document.getElementById('stage').style.visibility = '';
    });
  }

  // ---- into world 2 ----
  await p.evaluate(() => document.querySelector('[data-a=go]').click());
  await p.waitForTimeout(1200);
  await p.evaluate((seed) => {
    window.__manual = true;
    window.__cine = true;
    window.__seedRandom(seed * 7919);
    const r = window.__run, P = r.player;
    P.x = 0; P.y = 0; P.vx = 0; P.vy = 0; r.camX = 0; r.camY = 0; r.fx.parts.length = 0;
    r.enemies.length = 0; r.shots.length = 0; r.drops.length = 0;
    r.spawnAcc = -1e9; r.eliteT = 1e9; r.swarms = []; r.time = 310; r.bossDone = [true, true];
    r.mods.maxHp = 99999; P.hp = 99999; r.xpNeed = 1e9;
    const mk = (type, dx, dy, o = {}) => {
      const e = r.spawn(type, false, P.x + dx, P.y + dy);
      e.spawnT = 0; e.homeX = e.x; e.homeY = e.y;
      Object.assign(e, o);
      if (o.hp) e.max = o.hp;
      return e;
    };
    window.__E = {
      lancer: mk('lancer', 44, 10, { cd: 0.85, wuMul: 1.2, hp: 99999, cdFix: 9 }),
      archer: mk('archer', 112, -48, { cd: 1.45, still: true, hp: 40, cdFix: 9 }),
      // the crowd closes in but is cut down by the gun before it can swing
      left: [mk('grunt', -96, -18, { hp: 30, cd: 9 }), mk('grunt', -108, 28, { hp: 30, cd: 9 }), mk('runner', -78, 64, { hp: 14, cd: 9 }), mk('splitter', -128, -56, { hp: 26, cd: 9 }), mk('grunt', -140, 6, { hp: 30, cd: 9 })],
    };
    window.__pressed = new Set();
    window.__log = [];
    // the choreography, decided every frame from what is actually happening
    window.__cine_tick = (f) => {
      const P = r.player, S = P.sword, E = window.__E;
      const press = (key, a) => {
        if (window.__pressed.has(key)) return;
        if (S.attack(a)) { window.__pressed.add(key); window.__log.push(f + ':' + key); }
      };
      // parry each blow on the edge: just after it is released
      for (const e of r.enemies) {
        if (e.dead || e.state !== 'strike') continue;
        const d = Math.hypot(e.x - P.x, e.y - P.y);
        if (d > 70) continue;
        const lead = e.type === 'lancer' ? 0.03 : 0.0;
        if (e.t >= lead) press('blow' + e.id + ':' + Math.round(e.cd * 100), Math.atan2(e.y - P.y, e.x - P.x));
      }
      // turn arrows back
      for (const s of r.shots) {
        if (s.friendly) continue;
        const d = Math.hypot(s.x - P.x, s.y - P.y);
        if (d < 21) press('shot' + Math.round(s.px), Math.atan2(s.y - P.y, s.x - P.x));
      }
      // a dash in, then two cuts to finish the stunned lancer
      const L = E.lancer;
      if (f === 112 && !L.dead) {
        const a = Math.atan2(L.y - P.y, L.x - P.x);
        P.dashT = 0.16; P.dashX = Math.cos(a); P.dashY = Math.sin(a); P.inv = 0.3; P.dashCd = 1;
        r.fx.dust(P.x, P.y + 5, 6, a + Math.PI, 0.8);
      }
      // the last cut takes it
      if (f === 141 && !L.dead) L.hp = 1;
      if ((f === 121 || f === 141) && !L.dead) {
        S.cd = 0;
        press('cut' + f, Math.atan2(L.y - P.y, L.x - P.x));
      }
      // a slow drift so the camera breathes
      if (P.dashT <= 0) { P.vx = Math.cos(f / 22) * 10; P.vy = Math.sin(f / 31) * 6; }
    };
  }, SEED);
  // let everything settle in (no capture)
  for (let i = 0; i < 6; i++) await p.evaluate(() => window.__step(1 / 30));

  const stage = await p.$('#stage');
  for (let f = 0; f < FRAMES; f++) {
    await p.evaluate((f) => { window.__cine_tick(f); window.__step(1 / 30); }, f);
    if (!DRY) await stage.screenshot({ path: `${OUT}/frames/f${String(f).padStart(4, '0')}.png` });
    if (DRY && f % 15 === 0) await stage.screenshot({ path: `${OUT}/dry_${String(f).padStart(4, '0')}.png` });
  }
  const st = await p.evaluate(() => ({ parries: window.__run.parries, perfects: window.__run.perfects, kills: window.__run.kills, hits: window.__run.hitsTaken, log: window.__log, lancer: window.__E.lancer.dead, archer: window.__E.archer.dead }));
  console.log(JSON.stringify(st));
  console.log(errs.join('\n'));
  await b.close();
})();
