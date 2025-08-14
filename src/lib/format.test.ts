import { describe, it, expect } from 'vitest';
import { formatAmount, formatDateISO, parseFrenchNumber } from './format';

describe('format helpers', () => {
  it('formatAmount basic', () => {
    expect(formatAmount(1234)).toBe('1 234,00');
    expect(formatAmount(1234.5)).toBe('1 234,50');
  });
  it('formatDateISO', () => {
    expect(formatDateISO('2024-07-01T10:00:00.000Z')).toBe('2024-07-01');
  });
  it('parseFrenchNumber', () => {
    expect(parseFrenchNumber('1 234,56')).toBeCloseTo(1234.56);
  });
  it('parseFrenchNumber invalid', () => {
    expect(() => parseFrenchNumber('abc')).toThrow();
  });
});

