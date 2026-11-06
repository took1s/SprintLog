// Segmentleisten zum Durchziehen: Finger auf die Leiste, halten oder seitlich ziehen - der Marker folgt dem Finger,
// beim Loslassen wird der Abschnitt darunter gewählt (wie die Segmentsteuerung unter iOS). Dazu Wischen im Inhalt.
// Die Rechnungen sind reine Funktionen (getestet), die Composables kümmern sich nur um die Ereignisse.
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { tap } from '@/lib/native';

/**
 * Klick direkt nach einer Geste verwerfen (er landete sonst auf dem Knopf unter dem Finger).
 * Kurzes Zeitfenster ab dem Loslassen - kommt kein Klick, stört der Filter danach nicht.
 */
function suppressClickOn(el: HTMLElement): void {
  const swallow = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); done(); };
  const done = () => { window.clearTimeout(timer); el.removeEventListener('click', swallow, true); };
  const timer = window.setTimeout(done, 120); // ein echter Tipp danach kommt frühestens nach einem neuen Aufsetzen
  el.addEventListener('click', swallow, true);
}

/** Ab dieser Haltezeit folgt der Marker dem Finger auch ohne Bewegung. */
export const SCRUB_HOLD_MS = 220;
/** Seitliche Bewegung, ab der sofort gezogen wird (vorher könnte es ein Tipp sein). */
export const SCRUB_SLOP = 8;

/** Index des Segments unter x (Leiste von left bis left + width, count gleich breite Segmente). */
export function segmentAt(x: number, left: number, width: number, count: number): number {
  if (count <= 1 || width <= 0) return 0;
  const i = Math.floor(((x - left) / width) * count);
  return Math.min(count - 1, Math.max(0, i));
}

/** Verschiebung des Markers in px: mittig unter dem Finger, nie über den Rand hinaus. */
export function markerOffset(x: number, left: number, width: number, count: number): number {
  const seg = width / Math.max(1, count);
  return Math.min(width - seg, Math.max(0, x - left - seg / 2));
}

/**
 * Ist eine Bewegung ein Wisch zum nächsten Abschnitt? Deutlich seitlich (nicht Scrollen), weit genug oder schnell.
 * Liefert +1 (weiter), -1 (zurück) oder 0.
 */
export function swipeDirection(dx: number, dy: number, ms: number): -1 | 0 | 1 {
  const ax = Math.abs(dx);
  if (ax < 40 || ax < Math.abs(dy) * 1.8) return 0;
  const fast = ax / Math.max(1, ms) > 0.45; // px/ms
  if (ax < 72 && !fast) return 0;
  return dx < 0 ? 1 : -1;
}

interface ScrubOptions {
  count: () => number;
  current: () => number;
  select: (index: number) => void;
}

/**
 * Leiste durchziehen. Liefert, ob gerade gezogen wird, welches Segment unter dem Finger liegt und den Versatz
 * des Markers in px (relativ zum Innenbereich der Leiste, also ohne Padding).
 */
export function useScrub(el: Ref<HTMLElement | null>, opts: ScrubOptions) {
  const dragging = ref(false);
  const hover = ref(-1);
  const offset = ref(0);

  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let timer = 0;
  let box = { left: 0, width: 0 };

  // Innenbereich (Padding abgezogen) - dort liegen Segmente und Marker
  const measure = () => {
    const node = el.value;
    if (!node) return;
    const r = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    box = { left: r.left + pl, width: Math.max(1, r.width - pl - pr) };
  };

  const follow = (x: number) => {
    const n = opts.count();
    offset.value = markerOffset(x, box.left, box.width, n);
    const i = segmentAt(x, box.left, box.width, n);
    if (i !== hover.value) {
      if (hover.value !== -1) tap(); // spürbares Einrasten bei jedem Abschnitt
      hover.value = i;
    }
  };

  const begin = (x: number) => {
    if (dragging.value) return;
    window.clearTimeout(timer);
    timer = 0;
    measure();
    dragging.value = true;
    hover.value = -1;
    follow(x);
    tap();
    try { el.value?.setPointerCapture(pointerId); } catch { /* Zeiger schon weg */ }
  };

  const reset = () => {
    window.clearTimeout(timer);
    timer = 0;
    pointerId = -1;
    dragging.value = false;
    hover.value = -1;
  };

  const down = (e: PointerEvent) => {
    if (pointerId !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    timer = window.setTimeout(() => begin(startX), SCRUB_HOLD_MS);
  };

  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    if (dragging.value) { follow(e.clientX); return; }
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dy > 10 && dy > dx) { reset(); return; } // Seite scrollt - nicht stören
    if (dx > SCRUB_SLOP) begin(e.clientX);
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    const wasDragging = dragging.value;
    const target = hover.value;
    reset();
    if (!wasDragging) return; // normaler Tipp: der Knopf erledigt das selbst
    if (el.value) suppressClickOn(el.value); // der Klick nach dem Ziehen landete sonst noch einmal auf einem Knopf
    if (target >= 0 && target !== opts.current()) opts.select(target);
  };

  const cancel = (e: PointerEvent) => { if (e.pointerId === pointerId) reset(); };
  // Touch fängt den Zeiger implizit am Knopf - dessen "lost" beim Übernehmen durch die Leiste ist kein Abbruch
  const lost = (e: PointerEvent) => { if (e.target === el.value && e.pointerId === pointerId && dragging.value) reset(); };

  // Während des Ziehens darf die Seite nicht mitscrollen (sonst bricht der Browser die Geste ab)
  const touchMove = (e: TouchEvent) => { if (dragging.value && e.cancelable) e.preventDefault(); };
  const menu = (e: Event) => { if (pointerId !== -1) e.preventDefault(); };

  let bound: HTMLElement | null = null;
  const unbind = () => {
    if (!bound) return;
    bound.removeEventListener('pointerdown', down);
    bound.removeEventListener('pointermove', move);
    bound.removeEventListener('pointerup', up);
    bound.removeEventListener('pointercancel', cancel);
    bound.removeEventListener('lostpointercapture', lost);
    bound.removeEventListener('touchmove', touchMove);
    bound.removeEventListener('contextmenu', menu);
    bound = null;
  };
  watch(el, (node) => {
    unbind();
    reset();
    if (!node) return;
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', cancel);
    node.addEventListener('lostpointercapture', lost);
    node.addEventListener('touchmove', touchMove, { passive: false });
    node.addEventListener('contextmenu', menu);
    bound = node;
  }, { immediate: true, flush: 'post' });
  onBeforeUnmount(() => { unbind(); reset(); });

  return { dragging, hover, offset };
}

/**
 * Seitlich wischen im Inhalt wechselt den Abschnitt. Elemente mit eigener Wischgeste (Kalender, Diagramme,
 * waagrecht scrollende Leisten, Eingaben) und Wische vom linken Rand (Zurück-Geste des Browsers) bleiben unberührt.
 */
export function useSwipeNav(el: Ref<HTMLElement | null>, onSwipe: (dir: -1 | 1) => void) {
  let start: { x: number; y: number; t: number; id: number } | null = null;

  const own = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('[data-own-swipe], .swipe-row, canvas, input, select, textarea, .overflow-x-auto, [role="slider"], [role="dialog"]');

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || start || own(e.target) || e.clientX < 24) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  };
  const up = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y, performance.now() - start.t);
    start = null;
    if (dir) { if (el.value) suppressClickOn(el.value); onSwipe(dir); }
  };
  const cancel = () => { start = null; };

  let bound: HTMLElement | null = null;
  const unbind = () => {
    if (!bound) return;
    bound.removeEventListener('pointerdown', down);
    bound.removeEventListener('pointerup', up);
    bound.removeEventListener('pointercancel', cancel);
    bound = null;
  };
  watch(el, (node) => {
    unbind();
    if (!node) return;
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', cancel);
    bound = node;
  }, { immediate: true, flush: 'post' });
  onBeforeUnmount(unbind);
}
