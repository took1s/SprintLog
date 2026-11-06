// Gesten für Sheets und Karten: nach unten ziehen zum Schließen, lange drücken für Schnellaktionen.
// Touch über Touch-Events (nur so lässt sich das Scrollen im ersten touchmove übernehmen), Maus über Pointer-Events.
// Alles nur per Transform/Opacity - läuft auf dem Compositor, auch auf älteren iPhones flüssig.
import type { Directive } from 'vue';
import { tap } from '@/lib/native';

// ---------------------------------------------------------------------
// Reine Logik (getestet)
// ---------------------------------------------------------------------

/** Ab hier gilt "weit genug gezogen" (Anteil der Sheet-Höhe, gedeckelt für sehr hohe Sheets). */
export const dismissDistance = (height: number) => Math.min(160, Math.max(80, height * 0.3));

/** Schließen, wenn weit genug gezogen oder kräftig nach unten geschnippt (px/ms). */
export function shouldDismiss(dy: number, velocity: number, height: number): boolean {
  if (dy <= 0) return false;
  return dy >= dismissDistance(height) || (velocity > 0.6 && dy > 24);
}

/** Gummiband nach oben: das Sheet gibt nur wenig nach. */
export const rubberBand = (dy: number) => (dy >= 0 ? dy : -Math.min(24, Math.sqrt(-dy) * 2.4));

/** Geschwindigkeit aus den letzten Messpunkten (px/ms), ältere als 100 ms zählen nicht. */
export function velocityOf(samples: readonly { t: number; y: number }[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1]!;
  const first = samples.find((s) => last.t - s.t <= 100) ?? samples[0]!;
  const dt = last.t - first.t;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}

// ---------------------------------------------------------------------
// Sheet nach unten ziehen
// ---------------------------------------------------------------------

/** Kopfbereich, aus dem man immer ziehen kann (Griff, Titel). */
const HANDLE = 64;
const SPRING = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';
const NO_DRAG = 'input, textarea, select, [contenteditable="true"], [data-no-sheet-drag], .touch-none';
const desktop = () => window.matchMedia('(min-width: 640px)').matches;

interface DragState {
  close: () => void;
  handleOnly: boolean;
  startY: number;
  startX: number;
  dy: number;
  active: boolean;
  decided: boolean;
  samples: { t: number; y: number }[];
  backdrop: string | null;
  armed: boolean;
  cleanup: () => void;
}

const states = new WeakMap<HTMLElement, DragState>();

/** Nächster eigene Scrollbereich zwischen Ziel und Sheet (inklusive Sheet). */
function scrollerAt(target: Element, panel: HTMLElement): HTMLElement | null {
  for (let el: Element | null = target; el && el !== panel.parentElement; el = el.parentElement) {
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 1) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === 'auto' || oy === 'scroll') return el;
    }
  }
  return null;
}

function canStart(panel: HTMLElement, s: DragState, target: Element, y: number): boolean {
  if (desktop() || target.closest(NO_DRAG)) return false;
  // Nur ziehen, wenn der Bereich unter dem Finger ganz oben steht (wie bei iOS-Sheets) - sonst wird gescrollt
  const scroller = scrollerAt(target, panel);
  if (scroller && scroller.scrollTop > 0) return false;
  // Formulare: nur am Kopf (Griff, Titel)
  return !s.handleOnly || y - panel.getBoundingClientRect().top < HANDLE;
}

function begin(s: DragState, x: number, y: number) {
  s.startX = x; s.startY = y; s.dy = 0; s.active = false; s.decided = false; s.armed = false;
  s.samples = [{ t: performance.now(), y }];
}

/** true = Geste gehört dem Sheet (Scrollen verhindern). */
function track(panel: HTMLElement, s: DragState, x: number, y: number): boolean {
  const dx = x - s.startX;
  const dy = y - s.startY;
  if (!s.decided) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return false;
    s.decided = true;
    s.active = dy > 0 && Math.abs(dy) > Math.abs(dx);
    if (s.active) {
      panel.style.transition = 'none';
      panel.style.willChange = 'transform';
      const overlay = panel.parentElement;
      s.backdrop = overlay ? getComputedStyle(overlay).backgroundColor : null;
    }
  }
  if (!s.active) return false;
  s.dy = dy;
  s.samples.push({ t: performance.now(), y });
  if (s.samples.length > 8) s.samples.shift();
  panel.style.transform = `translate3d(0, ${rubberBand(dy)}px, 0)`;
  // Hintergrund hellt mit auf - zeigt, dass Loslassen schließt
  const progress = Math.max(0, Math.min(1, dy / panel.offsetHeight));
  const overlay = panel.parentElement;
  const m = s.backdrop?.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (overlay && m) overlay.style.backgroundColor = `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${Number(m[4] ?? 1) * (1 - progress * 0.85)})`;
  // Spürbares Einrasten an der Schwelle
  const armed = dy >= dismissDistance(panel.offsetHeight);
  if (armed && !s.armed) tap();
  s.armed = armed;
  return true;
}

function release(panel: HTMLElement, s: DragState, mouse = false) {
  if (!s.active) return;
  s.active = false;
  panel.style.willChange = '';
  const overlay = panel.parentElement;
  if (shouldDismiss(s.dy, velocityOf(s.samples), panel.offsetHeight)) {
    panel.style.transition = 'transform 0.26s cubic-bezier(0.4, 0, 1, 1)';
    panel.style.transform = 'translate3d(0, 100%, 0)';
    s.close();
    // Schließen abgelehnt (z. B. Rückfrage)? Dann zurückfedern statt unsichtbar offen zu bleiben
    window.setTimeout(() => {
      if (panel.isConnected && !overlay?.className.includes('leave')) springBack(panel);
    }, 60);
  } else {
    springBack(panel);
  }
  // Maus: der Klick direkt nach dem Ziehen (auf einem Knopf im Kopf) soll nichts auslösen.
  // Er folgt im selben Task auf pointerup - danach wird der Filter wieder entfernt.
  if (mouse && Math.abs(s.dy) > 6) {
    const swallow = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
    panel.addEventListener('click', swallow, { capture: true, once: true });
    window.setTimeout(() => panel.removeEventListener('click', swallow, { capture: true }), 0);
  }
}

function springBack(panel: HTMLElement) {
  panel.style.transition = SPRING;
  panel.style.transform = '';
  const overlay = panel.parentElement;
  if (overlay) { overlay.style.transition = 'background-color 0.3s ease'; overlay.style.backgroundColor = ''; }
  panel.addEventListener('transitionend', () => { panel.style.transition = ''; if (overlay) overlay.style.transition = ''; }, { once: true });
}

function attach(panel: HTMLElement, s: DragState) {
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (e.touches.length !== 1 || !t || !(e.target instanceof Element) || !canStart(panel, s, e.target, t.clientY)) { s.decided = true; s.active = false; return; }
    begin(s, t.clientX, t.clientY);
  };
  const onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t || (s.decided && !s.active)) return;
    if (track(panel, s, t.clientX, t.clientY) && e.cancelable) e.preventDefault();
  };
  const onTouchEnd = () => release(panel, s);

  // Maus (Desktop schmal, Tests): wie Touch, aber über Pointer-Events
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !(e.target instanceof Element) || !canStart(panel, s, e.target, e.clientY)) return;
    begin(s, e.clientX, e.clientY);
    const move = (ev: PointerEvent) => { if (!s.decided || s.active) track(panel, s, ev.clientX, ev.clientY); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); release(panel, s, true); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  panel.addEventListener('touchstart', onTouchStart, { passive: true });
  panel.addEventListener('touchmove', onTouchMove, { passive: false });
  panel.addEventListener('touchend', onTouchEnd);
  panel.addEventListener('touchcancel', onTouchEnd);
  panel.addEventListener('pointerdown', onPointerDown);
  panel.dataset.sheet = s.handleOnly ? 'handle' : 'content';
  s.cleanup = () => {
    panel.removeEventListener('touchstart', onTouchStart);
    panel.removeEventListener('touchmove', onTouchMove);
    panel.removeEventListener('touchend', onTouchEnd);
    panel.removeEventListener('touchcancel', onTouchEnd);
    panel.removeEventListener('pointerdown', onPointerDown);
  };
}

/**
 * `v-sheet-drag="close"` auf dem Panel eines Bottom-Sheets: nach unten ziehen schließt.
 * `v-sheet-drag:handle="close"` für Formulare: nur am Kopf ziehen (kein versehentliches Schließen beim Scrollen).
 */
export const vSheetDrag: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    const s: DragState = {
      close: binding.value, handleOnly: binding.arg === 'handle', startX: 0, startY: 0, dy: 0,
      active: false, decided: true, samples: [], backdrop: null, armed: false, cleanup: () => {},
    };
    states.set(el, s);
    attach(el, s);
  },
  updated(el, binding) { const s = states.get(el); if (s) s.close = binding.value; },
  beforeUnmount(el) { states.get(el)?.cleanup(); states.delete(el); },
};

// ---------------------------------------------------------------------
// Lange drücken
// ---------------------------------------------------------------------

export const LONG_PRESS_MS = 450;

interface PressState { handler: () => void; timer: number; x: number; y: number; fired: boolean; cleanup: () => void }
const presses = new WeakMap<HTMLElement, PressState>();

/**
 * `v-long-press="handler"`: nach 450 ms Halten feuert die Schnellaktion (mit Haptik), der normale Klick danach nicht.
 * Bewegung > 10 px (Scrollen) bricht ab. Tastatur/Screenreader nutzen weiter den Klick bzw. das Menü.
 */
export const vLongPress: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    const s: PressState = { handler: binding.value, timer: 0, x: 0, y: 0, fired: false, cleanup: () => {} };
    const cancel = () => { window.clearTimeout(s.timer); s.timer = 0; el.removeAttribute('data-pressing'); };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Eigene Knöpfe in der Karte (Favorit, +) behalten ihr normales Verhalten
      const inner = e.target instanceof Element ? e.target.closest('button, a, input, select, textarea, [role="button"]') : null;
      if (inner && inner !== el && el.contains(inner)) return;
      s.fired = false; s.x = e.clientX; s.y = e.clientY;
      el.setAttribute('data-pressing', '');
      s.timer = window.setTimeout(() => {
        s.timer = 0; s.fired = true;
        el.removeAttribute('data-pressing');
        tap();
        s.handler();
      }, LONG_PRESS_MS);
    };
    const move = (e: PointerEvent) => { if (s.timer && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel(); };
    // Nach dem Auslösen den Klick (und das Kontextmenü) schlucken
    const click = (e: MouseEvent) => { if (s.fired) { e.stopImmediatePropagation(); e.preventDefault(); s.fired = false; } };
    const menu = (e: Event) => { if (s.timer || s.fired) e.preventDefault(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('click', click, { capture: true });
    el.addEventListener('contextmenu', menu);
    el.classList.add('long-pressable');
    s.cleanup = () => {
      cancel();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', cancel);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('pointerleave', cancel);
      el.removeEventListener('click', click, { capture: true });
      el.removeEventListener('contextmenu', menu);
    };
    presses.set(el, s);
  },
  updated(el, binding) { const s = presses.get(el); if (s) s.handler = binding.value; },
  beforeUnmount(el) { presses.get(el)?.cleanup(); presses.delete(el); },
};
