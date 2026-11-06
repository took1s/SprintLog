// Hintergrund festhalten, solange ein Dialog offen ist (jedes Element mit aria-modal="true").
// Ohne das scrollt auf dem iPhone die Seite unter einem Sheet mit, sobald der Inhalt oben/unten anschlägt.
// overflow: hidden reicht in iOS-Safari nicht - der Body wird fixiert und die Position danach wiederhergestellt.
// Ein MutationObserver statt Aufrufen in jedem Dialog: neue Dialoge sind automatisch abgedeckt.

let lockedAt: number | null = null;
let frame = 0;

const modalOpen = () =>
  Array.from(document.querySelectorAll('[aria-modal="true"]')).some((el) => el.getClientRects().length > 0);

function lock() {
  lockedAt = window.scrollY;
  const s = document.body.style;
  s.position = 'fixed';
  s.top = `-${lockedAt}px`;
  s.left = '0';
  s.right = '0';
  s.width = '100%';
  document.documentElement.dataset.scrollLocked = '';
}

function unlock() {
  const y = lockedAt ?? 0;
  lockedAt = null;
  const s = document.body.style;
  s.position = s.top = s.left = s.right = s.width = '';
  delete document.documentElement.dataset.scrollLocked;
  window.scrollTo({ top: y, behavior: 'instant' });
}

function check() {
  frame = 0;
  const open = modalOpen();
  if (open && lockedAt === null) lock();
  else if (!open && lockedAt !== null) unlock();
}

export function initScrollLock(): void {
  if (typeof MutationObserver === 'undefined') return;
  // Nur Knoten-Änderungen (Dialoge kommen/gehen per v-if) - Attribut-Änderungen wären bei Timern/Animationen zu häufig
  new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(check); })
    .observe(document.body, { childList: true, subtree: true });
}

/** Für Tests. */
export const isScrollLocked = () => lockedAt !== null;
