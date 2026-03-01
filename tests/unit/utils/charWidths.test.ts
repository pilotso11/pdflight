import { describe, it, expect } from 'vitest';
import { getCharWidthRatio, isMonospaceFont, estimateProportionalCharWidths } from '../../../src/utils/text';

describe('getCharWidthRatio', () => {
  it('returns higher ratio for wide chars (m, w, M, W)', () => {
    expect(getCharWidthRatio('m')).toBeGreaterThan(getCharWidthRatio('i'));
    expect(getCharWidthRatio('w')).toBeGreaterThan(getCharWidthRatio('i'));
    expect(getCharWidthRatio('M')).toBeGreaterThan(getCharWidthRatio('I'));
    expect(getCharWidthRatio('W')).toBeGreaterThan(getCharWidthRatio('I'));
  });

  it('returns lower ratio for narrow chars (i, l, !, .)', () => {
    expect(getCharWidthRatio('i')).toBeLessThan(getCharWidthRatio('a'));
    expect(getCharWidthRatio('l')).toBeLessThan(getCharWidthRatio('a'));
    expect(getCharWidthRatio('.')).toBeLessThan(getCharWidthRatio('a'));
  });

  it('returns 1.0 for unknown characters', () => {
    expect(getCharWidthRatio('\u4e00')).toBe(1.0);
  });
});

describe('isMonospaceFont', () => {
  it('detects Courier as monospace', () => {
    expect(isMonospaceFont('Courier')).toBe(true);
    expect(isMonospaceFont('CourierNew')).toBe(true);
    expect(isMonospaceFont('Courier-Bold')).toBe(true);
  });

  it('detects common monospace fonts', () => {
    expect(isMonospaceFont('Consolas')).toBe(true);
    expect(isMonospaceFont('Monaco')).toBe(true);
    expect(isMonospaceFont('LucidaConsole')).toBe(true);
  });

  it('detects fonts with Mono in name', () => {
    expect(isMonospaceFont('SomeFont-Mono')).toBe(true);
    expect(isMonospaceFont('JetBrainsMono-Regular')).toBe(true);
  });

  it('returns false for proportional fonts', () => {
    expect(isMonospaceFont('Arial')).toBe(false);
    expect(isMonospaceFont('TimesNewRoman')).toBe(false);
    expect(isMonospaceFont('Helvetica')).toBe(false);
    expect(isMonospaceFont('g_d0_f1')).toBe(false);
  });
});

describe('estimateProportionalCharWidths', () => {
  it('returns even widths for monospace fonts', () => {
    const widths = estimateProportionalCharWidths('Hello', 50, 'Courier');
    const first = widths[0];
    for (const w of widths) {
      expect(w).toBeCloseTo(first);
    }
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(50);
  });

  it('gives wider m than i for proportional fonts', () => {
    const widths = estimateProportionalCharWidths('mi', 20, 'Arial');
    expect(widths[0]).toBeGreaterThan(widths[1]); // m > i
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(20);
  });

  it('preserves total width exactly', () => {
    const widths = estimateProportionalCharWidths('Lorem ipsum', 100, 'TimesNewRoman');
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });

  it('handles empty string', () => {
    expect(estimateProportionalCharWidths('', 0, 'Arial')).toEqual([]);
  });

  it('handles single character', () => {
    expect(estimateProportionalCharWidths('A', 10, 'Arial')).toEqual([10]);
  });

  it('returns correct count of widths for input string', () => {
    const str = 'bookmarks';
    const widths = estimateProportionalCharWidths(str, 60, 'Arial');
    expect(widths).toHaveLength(str.length);
  });
});
