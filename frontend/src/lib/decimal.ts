// Dezimalzahlen aus Texteingaben: Komma und Punkt sind beide erlaubt (72,5 = 72.5).

/** Text beim Tippen bereinigen: nur Ziffern und EIN Trennzeichen; ganze Zahlen ohne Trennzeichen. */
export function cleanDecimalInput(raw: string, integer = false): string {
  let out = '';
  let hasSep = false;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if ((ch === ',' || ch === '.') && !integer && !hasSep) { out += ch; hasSep = true; }
  }
  // höchstens 2 Nachkommastellen (Gewicht 72,25; Zeit 4,35 s)
  const m = /^(\d*)([.,]\d{0,2})?/.exec(out);
  return m ? m[1] + (m[2] ?? '') : '';
}

/** "72,5" -> 72.5, "72," -> 72, "" -> null. */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t || t === '.') return null;
  const n = Number(t.endsWith('.') ? t.slice(0, -1) : t);
  return Number.isFinite(n) ? n : null;
}
