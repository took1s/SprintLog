import { describe, expect, test } from 'vitest';
import { cleanDecimalInput, parseDecimal } from '../src/lib/decimal';

describe('decimal input', () => {
  test('comma and point both work, the separator survives while typing', () => {
    expect(cleanDecimalInput('72,')).toBe('72,');
    expect(cleanDecimalInput('72,5')).toBe('72,5');
    expect(cleanDecimalInput('72.5')).toBe('72.5');
    expect(parseDecimal('72,5')).toBe(72.5);
    expect(parseDecimal('72,')).toBe(72);
    expect(parseDecimal('')).toBeNull();
  });

  test('only one separator, digits only, max two decimals, integers without separator', () => {
    expect(cleanDecimalInput('7a2,,5.1')).toBe('72,51');
    expect(cleanDecimalInput('4,356')).toBe('4,35');
    expect(cleanDecimalInput('12,5', true)).toBe('125');
    expect(cleanDecimalInput('-5')).toBe('5');
  });
});
