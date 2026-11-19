// Hintergrund festhalten, solange ein Dialog offen ist (jedes Element mit aria-modal="true").
// Ohne das scrollt auf dem iPhone die Seite unter einem Sheet mit, sobald der Inhalt oben/unten anschlägt.
// Der Body wird fixiert (top = -scrollY): nur so kann iOS die Seite beim Tippen/Markieren in einem Sheet nicht
// "zum Cursor" verschieben - mit overflow: hidden allein sprang die Seite bei jedem Zeichen nach unten.
// Beim Lösen werden Fixierung und Position im selben Task zurückgesetzt (kein Frame mit der Seite ganz oben dazwischen).
// Ein MutationObserver statt Aufrufen in jedem Dialog: neue Dialoge sind automatisch abgedeckt.

let lockedAt: number | null = null;
let frame = 0;

const modalOpen = () =>
  Array.from(document.querySelectorAll('[aria-modal="true"]')).some((el) => el.getClientRects().length > 0);

/**
 * Sichtbarer Bereich (visualViewport) als CSS-Variablen, solange ein Dialog offen ist: geht auf dem iPhone die Tastatur
 * auf, wird er kleiner/verschoben - die Sheets passen sich an (app.css, html[data-keyboard]).
 */
function syncViewport() {
  const vv = window.visualViewport;
  const html = document.documentElement;
  if (!vv) return;
  // Erst ab spürbarer Differenz (Tastatur, nicht Adressleiste/Rundungen). Gezoomt (scale > 1) ist der sichtbare
  // Bereich auch kleiner - das ist keine Tastatur, sonst würde das Sheet gestaucht/verschoben.
  if ((vv.scale ?? 1) <= 1.01 && window.innerHeight - vv.height > 80) {
    html.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
    // Von der Tastatur verdeckter Streifen unten
    html.style.setProperty('--kb', `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
    html.dataset.keyboard = '';
  } else if ('keyboard' in html.dataset) {
    html.style.removeProperty('--kb');
    html.style.removeProperty('--vv-top');
    delete html.dataset.keyboard;
  }
}

function lock() {
  lockedAt = window.scrollY;
  const s = document.body.style;
  s.position = 'fixed';
  s.top = `-${lockedAt}px`;
  s.left = '0';
  s.right = '0';
  s.width = '100%';
  document.documentElement.style.overscrollBehavior = 'none';
  document.documentElement.dataset.scrollLocked = '';
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  syncViewport();
}

function unlock() {
  const y = lockedAt ?? 0;
  lockedAt = null;
  const html = document.documentElement;
  const s = document.body.style;
  // Sofort springen, nie animiert (CSS scroll-behavior: smooth würde von oben "hereinfahren")
  const behavior = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  s.position = s.top = s.left = s.right = s.width = '';
  html.style.overscrollBehavior = '';
  delete html.dataset.scrollLocked;
  window.visualViewport?.removeEventListener('resize', syncViewport);
  window.visualViewport?.removeEventListener('scroll', syncViewport);
  html.style.removeProperty('--kb');
  html.style.removeProperty('--vv-top');
  delete html.dataset.keyboard;
  window.scrollTo(0, y);
  html.style.scrollBehavior = behavior;
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
