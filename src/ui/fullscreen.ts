// Fullscreen needs a real user gesture, so this is called from click / key handlers.
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

export const isFullscreen = () => {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
};

export const canFullscreen = () => {
  const el = document.documentElement as FsEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
};

export function enterFullscreen() {
  if (isFullscreen() || !canFullscreen()) return;
  const el = document.documentElement as FsEl;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : (el.webkitRequestFullscreen?.(), undefined);
    Promise.resolve(p)
      .then(lockLandscape)
      .catch(() => undefined);
  } catch {
    /* some browsers refuse outside very specific gestures; the next click tries again */
  }
}

export function exitFullscreen() {
  if (!isFullscreen()) return;
  const d = document as FsDoc;
  try {
    if (d.exitFullscreen) d.exitFullscreen().catch(() => undefined);
    else d.webkitExitFullscreen?.();
  } catch {
    /* ignore */
  }
}

function lockLandscape() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  o?.lock?.('landscape').catch(() => undefined);
}

export function onFullscreenChange(cb: (on: boolean) => void) {
  const h = () => cb(isFullscreen());
  document.addEventListener('fullscreenchange', h);
  document.addEventListener('webkitfullscreenchange', h);
}
