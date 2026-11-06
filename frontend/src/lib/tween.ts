// Zahlen hochzählen (Zusammenfassung nach dem Training): ein gemeinsamer Fortschritt 0 -> 1 mit weichem Auslaufen.
// Bei "Bewegung reduzieren" sofort 1.
import { onBeforeUnmount, ref, watch, type WatchSource } from 'vue';

export const easeOutCubic = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);

/** Startet bei jeder Änderung von `trigger` (z. B. neue Zusammenfassung) neu. */
export function useTween(trigger: WatchSource<unknown>, duration = 900) {
  const progress = ref(1);
  let frame = 0;
  watch(trigger, (value) => {
    cancelAnimationFrame(frame);
    if (!value || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { progress.value = 1; return; }
    const start = performance.now();
    progress.value = 0;
    const step = (now: number) => {
      progress.value = easeOutCubic((now - start) / duration);
      if (progress.value < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }, { immediate: true });
  onBeforeUnmount(() => cancelAnimationFrame(frame));
  return progress;
}
