// Fullscreen helpers. Browsers only allow entering fullscreen from a click/tap/key press.

type OrientationLock = { lock?: (o: string) => Promise<void> };

export const isFullscreen = () => !!document.fullscreenElement;
export const canFullscreen = () => !!document.documentElement.requestFullscreen;

export function enterFullscreen() {
  const el = document.documentElement;
  if (isFullscreen() || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => (screen.orientation as unknown as OrientationLock)?.lock?.('landscape').catch(() => {}))
    .catch(() => {});
}

export function toggleFullscreen() {
  if (isFullscreen()) document.exitFullscreen?.().catch(() => {});
  else enterFullscreen();
}

/** Goes fullscreen on the player's first click, tap or key press, and keeps the canvas fitted. */
export function setupFullscreen(game: Phaser.Game) {
  const first = () => {
    enterFullscreen();
    window.removeEventListener('pointerdown', first);
    window.removeEventListener('keydown', first);
  };
  window.addEventListener('pointerdown', first);
  window.addEventListener('keydown', first);
  const refit = () => setTimeout(() => game.scale.refresh(), 120);
  document.addEventListener('fullscreenchange', refit);
  window.addEventListener('orientationchange', refit);
  window.visualViewport?.addEventListener('resize', refit);
}
