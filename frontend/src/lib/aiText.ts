// Zerlegt die Antwort des KI-Coachs in Absätze, Zwischenüberschriften und Listen - ohne HTML (strikte CSP, kein v-html).
// Das Modell ist angewiesen, nur "- "/"1. "-Listen und "Label:"-Zeilen zu nutzen; Markdown-Reste werden trotzdem entfernt.

export type AiBlock =
  | { kind: 'h'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[]; start: number };

const BULLET = /^\s*[-•*–]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** Markdown-Hervorhebungen entfernen (**fett**, __fett__, `code`) - Text bleibt. */
const clean = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\*\*/g, '').trim();

/** Kurze Zeile, die mit ":" endet ("Heute:", "Belastung diese Woche:") = Zwischenüberschrift. */
const isLabel = (s: string) => s.length <= 60 && s.endsWith(':') && !s.includes('. ');

export function parseAiText(raw: string): AiBlock[] {
  const blocks: AiBlock[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join('\n') });
    para = [];
  };
  const last = () => blocks[blocks.length - 1];

  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) { flushPara(); continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushPara(); continue; } // Trennlinie

    const h = HEADING.exec(line);
    const b = BULLET.exec(line);
    const n = NUMBERED.exec(line);
    if (h) {
      flushPara();
      blocks.push({ kind: 'h', text: clean(h[1]!).replace(/:$/, '') });
    } else if (b && clean(b[1]!)) {
      flushPara();
      const prev = last();
      if (prev?.kind === 'ul') prev.items.push(clean(b[1]!));
      else blocks.push({ kind: 'ul', items: [clean(b[1]!)] });
    } else if (n && clean(n[2]!)) {
      flushPara();
      const prev = last();
      if (prev?.kind === 'ol') prev.items.push(clean(n[2]!));
      else blocks.push({ kind: 'ol', items: [clean(n[2]!)], start: Number(n[1]) });
    } else {
      const text = clean(line);
      if (!text) continue;
      if (isLabel(text) && !para.length) blocks.push({ kind: 'h', text: text.slice(0, -1) });
      else if (/^\s{2,}\S/.test(line) && (last()?.kind === 'ul' || last()?.kind === 'ol') && !para.length) {
        // eingerückte Fortsetzung eines Listenpunkts
        const prev = last() as { items: string[] };
        prev.items[prev.items.length - 1] += ` ${text}`;
      } else para.push(text);
    }
  }
  flushPara();
  return blocks;
}
