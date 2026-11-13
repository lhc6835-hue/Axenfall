// Slash wipe: two dark halves split along a diagonal cut slide in from opposite
// sides, meet on the cut line, the scene changes underneath, and they slide on
// out the far side. Quiet on purpose: no white flash, just a thin seam of light.
import { sfx } from '../engine/audio';

let root: HTMLDivElement | null = null;
let busy = false;

function build() {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'wipe';
  root.innerHTML = `
    <div class="wp a"></div><div class="wp b"></div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1="-5" y1="66" x2="105" y2="34" vector-effect="non-scaling-stroke" />
    </svg>`;
  document.body.appendChild(root);
  root.querySelectorAll<HTMLElement>('.wp').forEach((el) => (el.style.transform = 'translateX(-102%)'));
  root.querySelector<HTMLElement>('.wp.b')!.style.transform = 'translateX(102%)';
  return root;
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function anim(el: Element, frames: Keyframe[], ms: number, easing: string) {
  return el.animate(frames, { duration: ms, easing, fill: 'forwards' }).finished;
}

/** cover the screen, run `mid` while hidden, then reveal. Calls during a wipe run immediately. */
export async function slash(mid: () => void, opts: { sound?: boolean } = {}) {
  if (busy) {
    mid();
    return;
  }
  busy = true;
  const r = build();
  r.classList.add('on');
  const a = r.querySelector('.wp.a')!, b = r.querySelector('.wp.b')!, seam = r.querySelector('svg')!;
  const fast = reduced();
  const tIn = fast ? 1 : 260, tOut = fast ? 1 : 300;
  if (opts.sound !== false) sfx.play(['swing_m1', 'swing_m2', 'swing_m3'], { vol: 0.35, rate: 0.85 });
  await Promise.all([
    anim(a, [{ transform: 'translateX(-102%)' }, { transform: 'translateX(0)' }], tIn, 'cubic-bezier(.7,0,.3,1)'),
    anim(b, [{ transform: 'translateX(102%)' }, { transform: 'translateX(0)' }], tIn, 'cubic-bezier(.7,0,.3,1)'),
  ]);
  // the seam glints once while the halves are closed
  anim(seam, [{ opacity: 0 }, { opacity: 0.55, offset: 0.3 }, { opacity: 0 }], fast ? 1 : 420, 'ease-out');
  try {
    mid();
  } catch (e) {
    console.error(e);
  }
  await new Promise((res) => setTimeout(res, fast ? 0 : 110));
  if (opts.sound !== false) sfx.play('sheathe', { vol: 0.18, rate: 1.6 });
  // keep sliding the same way: the cut halves part along the blade
  await Promise.all([
    anim(a, [{ transform: 'translateX(0)' }, { transform: 'translateX(102%)' }], tOut, 'cubic-bezier(.6,0,.2,1)'),
    anim(b, [{ transform: 'translateX(0)' }, { transform: 'translateX(-102%)' }], tOut, 'cubic-bezier(.6,0,.2,1)'),
  ]);
  // park them off-screen on their starting sides again
  (a as HTMLElement).getAnimations().forEach((x) => x.cancel());
  (b as HTMLElement).getAnimations().forEach((x) => x.cancel());
  r.classList.remove('on');
  busy = false;
}

/** the first frame: start covered and open up */
export async function openFromBlack() {
  const r = build();
  const a = r.querySelector('.wp.a')!, b = r.querySelector('.wp.b')!;
  (a as HTMLElement).style.transform = 'translateX(0)';
  (b as HTMLElement).style.transform = 'translateX(0)';
  await new Promise((res) => setTimeout(res, reduced() ? 0 : 180));
  await Promise.all([
    anim(a, [{ transform: 'translateX(0)' }, { transform: 'translateX(102%)' }], reduced() ? 1 : 420, 'cubic-bezier(.6,0,.2,1)'),
    anim(b, [{ transform: 'translateX(0)' }, { transform: 'translateX(-102%)' }], reduced() ? 1 : 420, 'cubic-bezier(.6,0,.2,1)'),
  ]);
  (a as HTMLElement).getAnimations().forEach((x) => x.cancel());
  (b as HTMLElement).getAnimations().forEach((x) => x.cancel());
  (a as HTMLElement).style.transform = 'translateX(-102%)';
  (b as HTMLElement).style.transform = 'translateX(102%)';
}

export const wiping = () => busy;
