// Separate articulated legs; animation is enabled only while held or settling.
export function makeBugArt() {
  const node = document.createElement('span'); node.className = 'bug';
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = '<svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#151b1d" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11 8 4 5 2M20 11 24 4 27 2"/><path class="leg l1" d="M11 17 5 13 2 17"/><path class="leg l2" d="M10 23 3 22 1 27"/><path class="leg l3" d="M11 29 5 32 4 38"/><path class="leg r1" d="M21 17 27 13 30 17"/><path class="leg r2" d="M22 23 29 22 31 27"/><path class="leg r3" d="M21 29 27 32 28 38"/></g><ellipse cx="16" cy="25" rx="9" ry="12" fill="#151b1d"/><ellipse cx="16" cy="13" rx="6" ry="6" fill="#151b1d"/><path d="M16 16v19" stroke="#626c70" stroke-width=".7"/></svg>';
  return node;
}
