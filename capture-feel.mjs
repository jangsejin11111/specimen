// Presentation only: never changes the pointer position used for drop eligibility.
export function followHeld(view, x, y, dt) {
  const alpha = 1 - Math.exp(-Math.max(0, dt) / .035);
  view.x += (x - view.x) * alpha; view.y += (y - view.y) * alpha;
  const dx = view.x - x, dy = view.y - y, distance = Math.hypot(dx, dy);
  if (distance > 4) { view.x = x + dx / distance * 4; view.y = y + dy / distance * 4; }
  return { x: view.x - x, y: view.y - y };
}
export function captureScale(age) {
  const t = Math.max(0, Math.min(1, age / 150));
  return 1 + .22 * (1 - Math.pow(1 - t, 3));
}
export function livingTwitch(now, calm = false) {
  return (Math.sin(now / 39) * 4.5 + Math.sin(now / 23 + Math.sin(now / 167) * 2) * 3.5) * (calm ? .32 : 1);
}
