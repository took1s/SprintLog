// Hintergrund festhalten, solange ein Dialog offen ist (jedes Element mit aria-modal="true").
// Ohne das scrollt auf dem iPhone die Seite unter einem Sheet mit, sobald der Inhalt oben/unten anschlägt.
// overflow: hidden + overscroll-behavior auf <html>/<body> (iOS 16+ hält damit still). Früher wurde der Body fixiert
// und die Position danach per scrollTo zurückgesetzt - das gab auf dem iPhone beim Schließen einen Frame lang die
// Seite ganz oben zu sehen ("Blinken"). So bleibt die Seite einfach, wo sie ist.
// Ein MutationObserver statt Aufrufen in jedem Dialog: neue Dialoge sind automatisch abgedeckt.

let lockedAt: number | null = null;
let frame = 0;

const modalOpen = () =>
  Array.from(document.querySelectorAll('[aria-modal="true"]')).some((el) => el.getClientRects().length > 0);

function lock() {
  lockedAt = window.scrollY;
  for (const el of [document.documentElement, document.body]) {
    el.style.overflow = 'hidden';
    el.style.overscrollBehavior = 'none';
  }
  document.documentElement.dataset.scrollLocked = '';
}

function unlock() {
  const y = lockedAt ?? 0;
  lockedAt = null;
  for (const el of [document.documentElement, document.body]) {
    el.style.overflow = '';
    el.style.overscrollBehavior = '';
  }
  delete document.documentElement.dataset.scrollLocked;
  // Nur falls sich doch etwas verschoben hat (z. B. Tastatur hat die Seite geschoben)
  if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: 'instant' });
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
