// Technik-Hinweise in der aktuellen Sprache. Eigenes Modul: wird nur vom Satz-Dialog geladen
// (zusammen mit den Animationsdaten) und bleibt so aus dem Start-Bundle.

import { locale } from '.';
import { techniqueTranslations } from './technique';
import type { Technique } from '../lib/figure';


/** Technik-Hinweise in der aktuellen Sprache (Englisch = Original aus lib/figure.ts). */
export function localizedTechnique(key: string | null | undefined, original: Technique | null): Technique | null {
  if (!key || !original) return original;
  const translated = locale.value === 'en' ? null : techniqueTranslations[locale.value]?.[key];
  return translated ?? original;
}

export function motionLabel(key: string | null | undefined, original: string): string {
  if (!key || locale.value === 'en') return original;
  return techniqueTranslations[locale.value]?.[key]?.label ?? original;
}

