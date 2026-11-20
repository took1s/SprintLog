// Pfade der Linien-Symbole (24er Raster, Strichstärke 2).
// Der Coach hat bewusst eine Trillerpfeife statt der üblichen "KI-Funken": er ist ein Trainer, kein Zauber.

export const ICONS = {
  /** Hantel */
  gym: ['M6.5 7v10', 'M17.5 7v10', 'M3.5 9.5v5', 'M20.5 9.5v5', 'M6.5 12h11'],
  /** Spielfeld von oben: Mittellinie und Mittelkreis */
  field: ['M3 5.5h18v13H3z', 'M12 5.5v13', 'M14.5 12a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0z'],
  /** Kalender mit Haken */
  plan: ['M4 6h16v14H4z', 'M4 10h16', 'M8.5 3v4', 'M15.5 3v4', 'M9 15l2 2 4-4'],
  /** Balken */
  data: ['M5 20v-7', 'M12 20V5', 'M19 20v-11'],
  /** Trillerpfeife: Kammer, Mundstück, Kugel */
  coach: ['M14 15a5 5 0 1 1-10 0a5 5 0 1 1 10 0z', 'M9 10V8h12v3.5h-8.4', 'M9 15h.01'],
  settings: ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
