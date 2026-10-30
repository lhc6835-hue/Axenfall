import { W, H, UI, GRADE_INFO, GRADES, FONT_B, FONT_L } from '../core/const';
import { sfx } from '../core/audio';
import { Save } from '../core/save';
import { Button, CurrencyBar, fadeIn, go, gradeBadge, menuBackdrop, outlined, panel, text, toast } from '../core/ui';
import { ABILITIES, SKILLS, abilityById, abilityPower, levelCost, MAX_LEVEL, MAX_STAR, shardsForStar, skillById, type AbilityDef } from '../data/abilities';

const ADD = Phaser.BlendModes.ADD;
type Tab = 'ability' | 'skills' | 'stats';

export class CharacterScene extends Phaser.Scene {
  tab: Tab = 'ability';
  content!: Phaser.GameObjects.Container;
  left!: Phaser.GameObjects.Container;
  bar!: CurrencyBar;
  tabBtns: Button[] = [];
  tmpButtons: Button[] = [];
  slotSel = 0;
  abPage = 0;
  skPage = 0;
  back = 'Hub';

  constructor() { super('Character'); }
  init(d: { back?: string; tab?: Tab }) { this.back = d.back ?? 'Hub'; this.tab = d.tab ?? 'ability'; this.tabBtns = []; this.tmpButtons = []; }

  create() {
    fadeIn(this);
    menuBackdrop(this, 0x1a1040);
    outlined(this, 20, 14, '캐릭터', 'L', UI.gold, true);
    text(this, 20, 34, 'CHARACTER', 'S', UI.dim);
    this.bar = new CurrencyBar(this);
    new Button(this, 60, H - 16, '◀ 돌아가기', () => go(this, this.back, { world: 1 }), { w: 100, h: 24 });
    this.left = this.add.container(0, 0);
    this.content = this.add.container(0, 0);
    const tabs: [Tab, string][] = [['ability', '능력'], ['skills', '스킬 편성'], ['stats', '능력치']];
    tabs.forEach(([t, label], i) => {
      const b = new Button(this, 262 + i * 104, 62, label, () => { this.tab = t; this.refresh(); }, { w: 100, h: 24 });
      this.tabBtns.push(b);
    });
    this.refresh();
  }

  refresh() {
    this.bar.refresh();
    this.tmpButtons.forEach((b) => b.destroy());
    this.tmpButtons = [];
    this.tabBtns.forEach((b, i) => b.bg.setTexture(['ability', 'skills', 'stats'][i] === this.tab ? 'ui_btnGold' : 'ui_btn'));
    this.drawLeft();
    this.content.removeAll(true);
    this.content.add(panel(this, 210, 78, 420, 254));
    if (this.tab === 'ability') this.drawAbilities();
    else if (this.tab === 'skills') this.drawSkills();
    else this.drawStats();
  }

  btn(x: number, y: number, label: string, fn: () => void, o: ConstructorParameters<typeof Button>[5] = {}) {
    const b = new Button(this, x, y, label, fn, o);
    this.tmpButtons.push(b);
    return b;
  }

  power() {
    const a = abilityById(Save.d.main);
    const o = Save.d.owned[a.id];
    return Math.round(Save.hpMax() * 0.6 + Save.atkBase() * abilityPower(a.grade, o.level, o.star) * 22);
  }

  drawLeft() {
    const c = this.left;
    c.removeAll(true);
    const a = abilityById(Save.d.main);
    const o = Save.d.owned[a.id];
    c.add(panel(this, 10, 50, 192, 272, 'ui_panelGold'));
    const glow = this.add.image(106, 130, 'glow').setBlendMode(ADD).setTint(a.fx).setScale(3.2).setAlpha(0.5);
    this.tweens.add({ targets: glow, scale: 3.6, duration: 1400, yoyo: true, repeat: -1 });
    const hero = this.add.image(106, 128, 'heroBig_' + a.id).setScale(0.85);
    this.tweens.add({ targets: hero, y: 124, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    c.add([glow, hero]);
    c.add(gradeBadge(this, 36, 66, a.grade));
    c.add(this.add.text(106, 182, a.name, { fontFamily: FONT_L, fontSize: '15px', color: '#' + GRADE_INFO[a.grade].color.toString(16), stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5));
    for (let i = 0; i < MAX_STAR; i++) c.add(this.add.image(106 + (i - 2) * 12, 200, i < o.star ? 'ic_star' : 'ic_starOff'));
    c.add(text(this, 106, 208, `Lv. ${o.level}`, 'M', UI.text, true).setOrigin(0.5, 0));
    const rows: [string, string][] = [['체력', `${Save.hpMax()}`], ['공격력', `${Math.round(Save.atkBase() * abilityPower(a.grade, o.level, o.star) * 10) / 10}`], ['전투력', `${this.power()}`]];
    rows.forEach(([k, v], i) => {
      c.add(text(this, 24, 226 + i * 16, k, 'M', UI.dim));
      c.add(text(this, 188, 226 + i * 16, v, 'M', i === 2 ? UI.gold : UI.text).setOrigin(1, 0));
    });
    const icons = [...Save.d.slots, Save.d.ult];
    icons.forEach((id, i) => {
      const x = 46 + i * 40, y = 300;
      c.add(this.add.nineslice(x, y, i === 3 ? 'ui_panelGold' : 'ui_slot', undefined, 32, 32, 6, 6, 6, 6));
      if (id) c.add(this.add.image(x, y, 'ic_' + id).setScale(0.9));
    });
  }

  // ------------------------------------------------------------------ abilities tab
  drawAbilities() {
    const c = this.content;
    const cw = 96, ch = 116, per = 8;
    const order = [...ABILITIES].sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade));
    const pages = Math.ceil(order.length / per);
    this.abPage = Math.min(this.abPage, pages - 1);
    this.pager(this.abPage, pages, (p) => { this.abPage = p; this.refresh(); });
    order.slice(this.abPage * per, this.abPage * per + per).forEach((a, i) => {
      const x = 270 + (i % 4) * (cw + 4), y = 150 + Math.floor(i / 4) * (ch + 6);
      const owned = Save.owns(a.id);
      const card = this.abilityCard(a, x, y, cw, ch, owned);
      c.add(card);
      card.setSize(cw, ch).setInteractive({ useHandCursor: true });
      card.on('pointerover', () => { sfx(this, 'hover'); this.tweens.add({ targets: card, scale: 1.05, duration: 90 }); });
      card.on('pointerout', () => this.tweens.add({ targets: card, scale: 1, duration: 90 }));
      card.on('pointerdown', () => { sfx(this, 'click'); this.detail(a); });
    });
  }

  /** ◀ 1/3 ▶ page switcher in the top-right of the content panel. */
  pager(page: number, pages: number, go: (p: number) => void) {
    if (pages <= 1) return;
    const y = 62, x = 584;
    this.content.add(text(this, x, y - 6, `${page + 1} / ${pages}`, 'S', UI.text).setOrigin(0.5, 0));
    this.btn(x - 34, y, '◀', () => go((page + pages - 1) % pages), { w: 26, h: 22, size: 'S' });
    this.btn(x + 34, y, '▶', () => go((page + 1) % pages), { w: 26, h: 22, size: 'S' });
  }

  abilityCard(a: AbilityDef, x: number, y: number, cw: number, ch: number, owned: boolean) {
    const gi = GRADE_INFO[a.grade];
    const card = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, cw, ch, 0x0b0714);
    const inner = this.add.rectangle(0, 0, cw - 4, ch - 4, owned ? 0x1a1430 : 0x100c1c);
    const top = this.add.rectangle(0, -ch / 2 + 2, cw - 4, 2, owned ? gi.color : 0x3a3456).setOrigin(0.5, 0);
    const bot = this.add.rectangle(0, ch / 2 - 2, cw - 4, 2, owned ? gi.color : 0x3a3456).setOrigin(0.5, 1);
    card.add([bg, inner, top, bot]);
    if (owned) {
      const gl = this.add.image(0, -14, 'glow').setBlendMode(ADD).setTint(gi.glow).setScale(1.3).setAlpha(0.4);
      card.add(gl);
    }
    const hero = this.add.image(0, -14, 'heroBig_' + a.id).setScale(0.42);
    if (!owned) hero.setTintFill(0x2a2440);
    card.add(hero);
    card.add(gradeBadge(this, -cw / 2 + 16, -ch / 2 + 10, a.grade));
    card.add(this.add.text(0, ch / 2 - 34, owned ? a.name : '???', { fontFamily: FONT_B, fontSize: '12px', color: owned ? '#' + gi.color.toString(16) : '#4a4466', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5));
    if (owned) {
      const o = Save.d.owned[a.id];
      for (let s = 0; s < MAX_STAR; s++) card.add(this.add.image((s - 2) * 10, ch / 2 - 18, s < o.star ? 'ic_star' : 'ic_starOff').setScale(0.8));
      card.add(text(this, 0, ch / 2 - 13, `Lv.${o.level}`, 'S', UI.text).setOrigin(0.5, 0));
      if (Save.d.main === a.id) {
        const eq = this.add.text(cw / 2 - 4, -ch / 2 + 4, 'E', { fontFamily: FONT_B, fontSize: '12px', color: '#5dffa0', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(1, 0);
        card.add(eq);
      }
      if (Save.canStarUp(a.id)) {
        const up = this.add.text(cw / 2 - 4, ch / 2 - 30, '▲', { fontFamily: FONT_B, fontSize: '12px', color: '#ffd166', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(1, 0);
        this.tweens.add({ targets: up, y: up.y - 3, duration: 400, yoyo: true, repeat: -1 });
        card.add(up);
      }
    } else card.add(text(this, 0, ch / 2 - 16, '미획득', 'S', 0x4a4466).setOrigin(0.5, 0));
    return card;
  }

  detail(a: AbilityDef) {
    const owned = Save.owns(a.id);
    const gi = GRADE_INFO[a.grade];
    const m = this.add.container(0, 0).setDepth(100);
    const btns: Button[] = [];
    const close = () => { m.destroy(); btns.forEach((b) => b.destroy()); };
    m.add(this.add.rectangle(0, 0, W, H, 0x07060d, 0.75).setOrigin(0).setInteractive().on('pointerdown', close));
    const px = W / 2 - 230, py = 36, pw = 460, ph = 290;
    m.add(panel(this, px, py, pw, ph, 'ui_panelGold').setInteractive());
    const gl = this.add.image(px + 80, py + 90, 'glow').setBlendMode(ADD).setTint(a.fx).setScale(2.6).setAlpha(owned ? 0.6 : 0.2);
    const hero = this.add.image(px + 80, py + 88, 'heroBig_' + a.id).setScale(0.75);
    if (!owned) hero.setTintFill(0x2a2440);
    m.add([gl, hero]);
    m.add(gradeBadge(this, px + 26, py + 18, a.grade));
    m.add(this.add.text(px + 160, py + 14, a.name, { fontFamily: FONT_L, fontSize: '15px', color: '#' + gi.color.toString(16), stroke: '#0b0714', strokeThickness: 3, resolution: 1 }));
    m.add(text(this, px + 160, py + 34, `${a.en} · ${gi.name}`, 'S', UI.dim));
    m.add(text(this, px + 160, py + 48, `"${a.lore}"`, 'S', UI.text).setWordWrapWidth(280));
    // skills list
    const list: [string, string, string][] = [
      ['ic_basic_' + a.id, `평타 · ${a.basicName}`, a.basicDesc],
      ...a.skills.map((id) => { const s = skillById(id); return ['ic_' + id, `스킬 · ${s.name}  (${s.cd}초)`, s.desc] as [string, string, string]; }),
      ['ic_' + a.ult, `궁극기 · ${skillById(a.ult).name}`, skillById(a.ult).desc],
    ];
    list.forEach(([ic, name, desc], i) => {
      const y = py + 74 + i * 40;
      m.add(this.add.image(px + 176, y + 12, ic).setScale(0.9));
      m.add(text(this, px + 196, y, name, 'M', i === 3 ? UI.gold : UI.text, true));
      m.add(text(this, px + 196, y + 15, desc, 'S', UI.dim).setWordWrapWidth(250));
    });
    if (owned) {
      const o = Save.d.owned[a.id];
      for (let s = 0; s < MAX_STAR; s++) m.add(this.add.image(px + 56 + s * 12, py + 150, s < o.star ? 'ic_star' : 'ic_starOff'));
      m.add(text(this, px + 80, py + 160, `Lv. ${o.level} / ${MAX_LEVEL}`, 'M', UI.text, true).setOrigin(0.5, 0));
      const need = shardsForStar(o.star);
      m.add(text(this, px + 80, py + 176, o.star >= MAX_STAR ? '최대 등급' : `조각 ${o.shards} / ${need}`, 'S', Save.canStarUp(a.id) ? UI.gold : UI.dim).setOrigin(0.5, 0));
      m.add(text(this, px + 80, py + 190, `공격 배율 x${abilityPower(a.grade, o.level, o.star).toFixed(2)}`, 'S', UI.cyan).setOrigin(0.5, 0));
      const isMain = Save.d.main === a.id;
      btns.push(new Button(this, px + 80, py + 218, isMain ? '장착 중' : '장착하기', () => {
        Save.d.main = a.id; Save.write(); sfx(this, 'equip'); toast(this, `${a.name} 장착!`, a.fx); close(); this.refresh();
      }, { w: 120, disabled: isMain, gold: !isMain }));
      const cost = levelCost(o.level);
      btns.push(new Button(this, px + 80, py + 246, o.level >= MAX_LEVEL ? '최대 레벨' : `레벨업  ${cost}G`, () => {
        if (Save.d.gold < cost) { toast(this, '골드가 부족합니다', UI.red); return; }
        Save.d.gold -= cost; o.level++; Save.write(); sfx(this, 'coin'); sfx(this, 'confirm2');
        close(); this.refresh(); this.detail(a);
      }, { w: 120, disabled: o.level >= MAX_LEVEL || Save.d.gold < cost }));
      btns.push(new Button(this, px + 80, py + 274, '별 승급', () => {
        if (Save.starUp(a.id)) { sfx(this, 'reveal'); toast(this, `${a.name} ★${Save.d.owned[a.id].star}!`, UI.gold); close(); this.refresh(); this.detail(a); }
      }, { w: 120, disabled: !Save.canStarUp(a.id) }));
    } else {
      m.add(text(this, px + 80, py + 170, '소환에서 획득할 수 있습니다', 'S', UI.dim).setOrigin(0.5, 0));
    }
    btns.push(new Button(this, px + pw - 50, py + ph - 20, '닫기', close, { w: 70, h: 24 }));
    btns.forEach((b) => b.setDepth(101));
    m.setAlpha(0);
    this.tweens.add({ targets: m, alpha: 1, duration: 150 });
  }

  // ------------------------------------------------------------------ skills tab
  drawSkills() {
    const c = this.content;
    const ids = [...Save.d.slots, Save.d.ult];
    const keys = ['Q', 'E', 'R', 'F (궁극기)'];
    c.add(text(this, 222, 86, '슬롯을 고르고 아래에서 스킬을 선택하세요. 능력끼리 섞어서 편성 가능!', 'S', UI.dim));
    ids.forEach((id, i) => {
      const x = 262 + i * 70 + (i === 3 ? 20 : 0), y = 134;
      const sel = this.slotSel === i;
      const slot = this.add.container(x, y);
      const fr = this.add.nineslice(0, 0, i === 3 ? 'ui_panelGold' : 'ui_slot', undefined, 44, 44, 6, 6, 6, 6);
      slot.add(fr);
      if (sel) {
        const s = this.add.image(0, 0, 'square').setScale(6.2).setTint(UI.gold);
        this.tweens.add({ targets: s, alpha: 0.4, duration: 400, yoyo: true, repeat: -1 });
        slot.add(s);
      }
      if (id) slot.add(this.add.image(0, 0, 'ic_' + id).setScale(1.2));
      else slot.add(text(this, 0, 0, '비어 있음', 'S', UI.dim).setOrigin(0.5).setFontSize(9));
      slot.add(outlined(this, 0, 26, keys[i], 'S', i === 3 ? UI.gold : UI.text, true).setOrigin(0.5, 0));
      slot.setSize(44, 44).setInteractive({ useHandCursor: true });
      slot.on('pointerdown', () => { sfx(this, 'click'); this.slotSel = i; this.refresh(); });
      c.add(slot);
      if (id && i < 3) {
        const rm = this.add.text(x + 20, y - 24, '×', { fontFamily: FONT_B, fontSize: '12px', color: '#ff4d6d', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        rm.on('pointerdown', () => { Save.d.slots[i] = null; Save.write(); sfx(this, 'cancel'); this.refresh(); });
        c.add(rm);
      }
    });
    c.add(this.add.rectangle(420, 178, 400, 1, UI.line));
    const ult = this.slotSel === 3;
    const pool = SKILLS.filter((s) => Save.owns(s.ability) && (ult ? s.kind === 'ult' : s.kind === 'skill'));
    const info = this.add.container(0, 0);
    c.add(info);
    const showInfo = (id: string) => {
      info.removeAll(true);
      const s = skillById(id), a = abilityById(s.ability);
      info.add(text(this, 222, 286, `${s.name}`, 'M', GRADE_INFO[a.grade].color, true));
      info.add(text(this, 222 + 4 + s.name.length * 12 + 6, 288, `${a.name} · ${s.kind === 'ult' ? '궁극기' : `쿨타임 ${s.cd}초`} · 위력 x${s.power}`, 'S', UI.dim));
      info.add(text(this, 222, 304, s.desc, 'S', UI.text).setWordWrapWidth(400));
    };
    const per = 18, pages = Math.max(1, Math.ceil(pool.length / per));
    this.skPage = Math.min(this.skPage, pages - 1);
    this.pager(this.skPage, pages, (p) => { this.skPage = p; this.refresh(); });
    pool.slice(this.skPage * per, this.skPage * per + per).forEach((s, i) => {
      const x = 236 + (i % 9) * 44, y = 204 + Math.floor(i / 9) * 44;
      const a = abilityById(s.ability);
      const used = ids.includes(s.id);
      const b = this.add.container(x, y);
      b.add(this.add.nineslice(0, 0, used ? 'ui_btnDis' : 'ui_slot', undefined, 38, 38, 6, 6, 6, 6));
      const ic = this.add.image(0, 0, 'ic_' + s.id);
      if (used) ic.setAlpha(0.45);
      b.add(ic);
      b.add(this.add.rectangle(0, 17, 30, 2, GRADE_INFO[a.grade].color));
      if (used) b.add(outlined(this, 12, -16, '✓', 'S', UI.green, true));
      b.setSize(38, 38).setInteractive({ useHandCursor: true });
      b.on('pointerover', () => { showInfo(s.id); this.tweens.add({ targets: b, scale: 1.1, duration: 80 }); });
      b.on('pointerout', () => this.tweens.add({ targets: b, scale: 1, duration: 80 }));
      b.on('pointerdown', () => {
        if (ult) Save.d.ult = s.id;
        else {
          const cur = Save.d.slots.indexOf(s.id);
          if (cur >= 0 && cur !== this.slotSel) Save.d.slots[cur] = Save.d.slots[this.slotSel];
          Save.d.slots[this.slotSel] = s.id;
          this.slotSel = Math.min(2, this.slotSel + (cur >= 0 ? 0 : 1));
        }
        Save.write(); sfx(this, 'equip'); this.refresh();
      });
      c.add(b);
    });
    if (!pool.length) c.add(text(this, 420, 230, '보유한 스킬이 없습니다', 'M', UI.dim).setOrigin(0.5));
    const cur = ids[this.slotSel] ?? pool[0]?.id;
    if (cur) showInfo(cur);
  }

  // ------------------------------------------------------------------ stats tab
  drawStats() {
    const c = this.content;
    c.add(text(this, 222, 88, '골드로 상자의 기본 능력치를 영구 강화합니다. 모든 능력에 적용돼요.', 'S', UI.dim));
    const rows: { name: string; lv: number; cur: string; next: string; icon: string; up: () => void }[] = [
      { name: '체력', lv: Save.d.hpLv, cur: `${Save.hpMax()}`, next: `${Save.hpMax() + 14}`, icon: 'ic_heart', up: () => Save.d.hpLv++ },
      { name: '공격력', lv: Save.d.atkLv, cur: `${Save.atkBase().toFixed(1)}`, next: `${(Save.atkBase() + 1.6).toFixed(1)}`, icon: 'ic_sword', up: () => Save.d.atkLv++ },
    ];
    rows.forEach((r, i) => {
      const y = 130 + i * 74;
      c.add(this.add.nineslice(420, y + 10, 'ui_slot', undefined, 390, 62, 6, 6, 6, 6));
      c.add(this.add.image(250, y + 10, r.icon).setScale(2));
      c.add(text(this, 276, y - 8, `${r.name}  Lv.${r.lv}`, 'L', UI.text, true));
      c.add(text(this, 276, y + 14, `${r.cur}  ▶  `, 'M', UI.dim));
      c.add(text(this, 276 + (r.cur.length + 4) * 7, y + 14, r.next, 'M', UI.green, true));
      const cost = Save.statCost(r.lv);
      this.btn(552, y + 10, `${cost}G`, () => {
        if (Save.d.gold < cost) { toast(this, '골드가 부족합니다', UI.red); return; }
        Save.d.gold -= cost; r.up(); Save.write(); sfx(this, 'coin'); sfx(this, 'confirm2');
        this.refresh();
      }, { w: 100, gold: Save.d.gold >= cost, disabled: Save.d.gold < cost, icon: 'ic_gold' });
    });
    c.add(text(this, 420, 290, `현재 전투력  ${this.power()}`, 'L', UI.gold, true).setOrigin(0.5, 0));
  }
}
