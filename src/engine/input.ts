export type Btn = 'slash' | 'dash' | 'pause' | 'reload';

/** keys typed into a text field belong to the field, not the game */
export const isTyping = (e: Event) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

export class Input {
  keys = new Set<string>();
  private pressed = new Set<Btn>();
  mouseX = 0;
  mouseY = 0;
  mouseMovedAt = -1e9;
  touchMode = false;
  stick = { id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
  slashHeld = false;

  constructor() {
    addEventListener('keydown', (e) => {
      if (e.repeat || isTyping(e)) return;
      const k = e.code;
      this.keys.add(k);
      if (k === 'Space' || k === 'KeyJ' || k === 'KeyK') this.press('slash');
      if (k === 'ShiftLeft' || k === 'ShiftRight' || k === 'KeyL') this.press('dash');
      if (k === 'Escape' || k === 'KeyP') this.press('pause');
      if (k === 'KeyR') this.press('reload');
      if (k === 'Space' || k.startsWith('Arrow')) e.preventDefault();
      this.touchMode = false;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseMovedAt = performance.now();
      this.touchMode = false;
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindStage(el: HTMLElement) {
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 2) this.press('slash');
      this.mouseMovedAt = performance.now();
    });
  }

  bindTouch() {
    const stick = document.getElementById('stick')!;
    const knob = document.getElementById('knob')!;
    const zone = document.getElementById('touch')!;
    const R = 46;
    zone.addEventListener(
      'touchstart',
      (e) => {
        this.touchMode = true;
        for (const t of Array.from(e.changedTouches)) {
          const target = t.target as HTMLElement;
          if (target.id === 't-slash') { this.press('slash'); this.slashHeld = true; continue; }
          if (target.id === 't-dash') { this.press('dash'); continue; }
          if (target.id === 't-pause') { this.press('pause'); continue; }
          if (this.stick.id < 0 && t.clientX < innerWidth * 0.55) {
            this.stick.id = t.identifier;
            this.stick.ox = t.clientX;
            this.stick.oy = t.clientY;
            this.stick.dx = this.stick.dy = 0;
            stick.style.left = t.clientX - 60 + 'px';
            stick.style.top = t.clientY - 60 + 'px';
            stick.classList.add('on');
            knob.style.transform = 'translate(0px,0px)';
          }
        }
        e.preventDefault();
      },
      { passive: false },
    );
    zone.addEventListener(
      'touchmove',
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          if (t.identifier !== this.stick.id) continue;
          let dx = t.clientX - this.stick.ox, dy = t.clientY - this.stick.oy;
          const l = Math.hypot(dx, dy);
          if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
          this.stick.dx = dx / R;
          this.stick.dy = dy / R;
          knob.style.transform = `translate(${dx}px,${dy}px)`;
        }
        e.preventDefault();
      },
      { passive: false },
    );
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.stick.id) {
          this.stick.id = -1;
          this.stick.dx = this.stick.dy = 0;
          stick.classList.remove('on');
        }
        if ((t.target as HTMLElement).id === 't-slash') this.slashHeld = false;
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
  }

  press(b: Btn) {
    this.pressed.add(b);
  }
  take(b: Btn) {
    const had = this.pressed.has(b);
    this.pressed.delete(b);
    return had;
  }
  clearPresses() {
    this.pressed.clear();
  }

  move(): [number, number] {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (this.stick.id >= 0) {
      x = this.stick.dx;
      y = this.stick.dy;
      const l = Math.hypot(x, y);
      if (l < 0.18) return [0, 0];
      return [x, y];
    }
    const l = Math.hypot(x, y);
    return l > 0 ? [x / l, y / l] : [0, 0];
  }

  /** true when the mouse is the thing aiming the sword */
  mouseAiming() {
    return !this.touchMode && performance.now() - this.mouseMovedAt < 4000;
  }
}
