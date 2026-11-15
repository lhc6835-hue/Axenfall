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

/**
 * Play a keyframe animation and wait for it, but never longer than its own length plus a margin:
 * some mobile browsers drop or reject `finished` (fullscreen switches, backgrounding), and a wipe
 * that never opens again leaves a black screen that swallows every tap.
 */
function anim(el: Element, frames: Keyframe[], ms: number, easing: string) {
  let a: Animation | null = null;
  try {
    a = el.animate(frames, { duration: ms, easing, fill: 'forwards' });
  } catch {
    return Promise.resolve();
  }
  return Promise.race([a.finished.then(() => undefined, () => undefined), new Promise<void>((res) => setTimeout(res, ms + 150))]);
}

/** put both halves back off-screen and stop blocking input, whatever state they were left in */
function park() {
  if (!root) return;
  const a = root.querySelector<HTMLElement>('.wp.a')!, b = root.querySelector<HTMLElement>('.wp.b')!;
  for (const el of [a, b, root.querySelector('svg')!]) (el as HTMLElement | SVGElement).getAnimations().forEach((x) => x.cancel());
  a.style.transform = 'translateX(-102%)';
  b.style.transform = 'translateX(102%)';
  root.classList.remove('on');
}

// last line of defence: a wipe never covers the screen for more than a moment
let coveredSince = 0;
setInterval(() => {
  const on = !!root && root.classList.contains('on');
  if (!on) {
    coveredSince = 0;
    return;
  }
  if (!coveredSince) coveredSince = performance.now();
  else if (performance.now() - coveredSince > 1500) {
    park();
    busy = false;
    coveredSince = 0;
  }
}, 250);

/** cover the screen, run `mid` while hidden, then reveal. Calls during a wipe run immediately. */
export async function slash(mid: () => void, opts: { sound?: boolean } = {}) {
  if (busy) {
    mid();
    return;
  }
  busy = true;
  let ran = false;
  try {
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
    void anim(seam, [{ opacity: 0 }, { opacity: 0.55, offset: 0.3 }, { opacity: 0 }], fast ? 1 : 420, 'ease-out');
    ran = true;
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
  } catch (e) {
    console.error(e);
    if (!ran) {
      try {
        mid();
      } catch (e2) {
        console.error(e2);
      }
    }
  } finally {
    // whatever happened, the screen is uncovered and takes input again
    park();
    busy = false;
  }
}

/** the first frame: start covered and open up */
export async function openFromBlack() {
  try {
    await openFromBlackInner();
  } finally {
    park();
  }
}

async function openFromBlackInner() {
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
