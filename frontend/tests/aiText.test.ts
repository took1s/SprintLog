import { describe, expect, it } from 'vitest';
import { parseAiText } from '@/lib/aiText';

describe('parseAiText', () => {
  it('erkennt Überschriften, Listen und Absätze', () => {
    const blocks = parseAiText([
      'Kurz: heute **leichtes** Techniktraining.',
      '',
      'Belastung:',
      '- ACWR 1,12 - im grünen Bereich',
      '- Monotonie 1,4',
      '',
      '## Plan für heute',
      '1. Aufwärmen 15 min',
      '2. Sprints 6x30 m',
      '   volle Pause 2 min',
      '---',
      'Zweite Zeile',
      'gehört zum Absatz',
    ].join('\n'));
    expect(blocks).toEqual([
      { kind: 'p', text: 'Kurz: heute leichtes Techniktraining.' },
      { kind: 'h', text: 'Belastung' },
      { kind: 'ul', items: ['ACWR 1,12 - im grünen Bereich', 'Monotonie 1,4'] },
      { kind: 'h', text: 'Plan für heute' },
      { kind: 'ol', items: ['Aufwärmen 15 min', 'Sprints 6x30 m volle Pause 2 min'], start: 1 },
      { kind: 'p', text: 'Zweite Zeile\ngehört zum Absatz' },
    ]);
  });

  it('macht aus langen Sätzen mit Doppelpunkt keine Überschrift', () => {
    const blocks = parseAiText('Das ist ein ganzer Satz. Und noch einer mit Ende:');
    expect(blocks[0]!.kind).toBe('p');
  });
});
