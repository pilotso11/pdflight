// Copyright (c) 2026 Seth Osher. MIT License.
import { describe, it, expect } from 'vitest';
import { buildRowIndex, charToRow, avgLineSpacing } from '../../../src/search/RowIndex';
import { buildPageTextIndex } from '../../../src/search/TextIndex';
import type { PdflightTextItem } from '../../../src/types';

function makeItem(
  str: string,
  overrides?: Partial<PdflightTextItem>,
): PdflightTextItem {
  return {
    str,
    transform: [12, 0, 0, 12, 100, 500],
    width: str.length * 7,
    height: 12,
    fontName: 'TestFont',
    hasEOL: false,
    charWidths: Array(str.length).fill(7),
    ...overrides,
  };
}

describe('buildRowIndex', () => {
  it('returns one row for a single-line page', () => {
    const index = buildPageTextIndex(1, [makeItem('Hello World')]);
    const rows = buildRowIndex(index);
    expect(rows).toHaveLength(1);
    expect(rows[0].page).toBe(1);
    expect(rows[0].row).toBe(1);
    expect(rows[0].text).toBe('Hello World');
    expect(rows[0].startChar).toBe(0);
    expect(rows[0].endChar).toBe(11);
    expect(rows[0].y).toBe(500);
  });

  it('clusters items on different y-coordinates into separate rows', () => {
    const items = [
      makeItem('First line', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Second line', { transform: [12, 0, 0, 12, 100, 680] }),
      makeItem('Third line', { transform: [12, 0, 0, 12, 100, 660] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    expect(rows).toHaveLength(3);
    expect(rows[0].row).toBe(1);
    expect(rows[0].text).toBe('First line');
    expect(rows[1].row).toBe(2);
    expect(rows[1].text).toBe('Second line');
    expect(rows[2].row).toBe(3);
    expect(rows[2].text).toBe('Third line');
  });

  it('orders rows top-to-bottom (higher y = row 1)', () => {
    const items = [
      makeItem('Bottom', { transform: [12, 0, 0, 12, 100, 100] }),
      makeItem('Top', { transform: [12, 0, 0, 12, 100, 700] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    expect(rows[0].text).toBe('Top');
    expect(rows[1].text).toBe('Bottom');
  });

  it('clusters items with close y-coordinates into same row', () => {
    const items = [
      makeItem('Hello ', { transform: [12, 0, 0, 12, 100, 500] }),
      makeItem('World', { transform: [12, 0, 0, 12, 150, 501] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toContain('Hello');
    expect(rows[0].text).toContain('World');
  });

  it('returns empty array for empty page', () => {
    const index = buildPageTextIndex(1, []);
    const rows = buildRowIndex(index);
    expect(rows).toHaveLength(0);
  });

  it('handles items with only whitespace', () => {
    const index = buildPageTextIndex(1, [makeItem('   ')]);
    const rows = buildRowIndex(index);
    expect(rows.length).toBeLessThanOrEqual(1);
  });

  it('startChar/endChar range covers the correct normalized text slice', () => {
    const items = [
      makeItem('First', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Second', { transform: [12, 0, 0, 12, 100, 680] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    for (const row of rows) {
      const extracted = index.normalizedText.slice(row.startChar, row.endChar);
      expect(extracted).toBe(row.text);
    }
  });

  it('handles rotated text items by using topmost y-point', () => {
    const items = [
      makeItem('Normal', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Rotated', { transform: [8.5, 8.5, -8.5, 8.5, 300, 700] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThanOrEqual(2);
  });

  it('handles mixed font sizes on same line', () => {
    const items = [
      makeItem('BIG', { transform: [24, 0, 0, 24, 100, 500] }),
      makeItem('small', { transform: [8, 0, 0, 8, 200, 500] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    expect(rows).toHaveLength(1);
  });
});

describe('charToRow', () => {
  it('returns correct row for a character in the first row', () => {
    const items = [
      makeItem('First', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Second', { transform: [12, 0, 0, 12, 100, 680] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    expect(charToRow(rows, 0)).toBe(1);
  });

  it('returns correct row for a character in the second row', () => {
    const items = [
      makeItem('First', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Second', { transform: [12, 0, 0, 12, 100, 680] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    const secondStart = index.normalizedText.indexOf('Second');
    expect(charToRow(rows, secondStart)).toBe(2);
  });

  it('returns 0 for char index beyond all rows', () => {
    const index = buildPageTextIndex(1, [makeItem('Hello')]);
    const rows = buildRowIndex(index);
    expect(charToRow(rows, 999)).toBe(0);
  });
});

describe('avgLineSpacing', () => {
  it('computes average spacing between consecutive rows', () => {
    const items = [
      makeItem('Row A', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Row B', { transform: [12, 0, 0, 12, 100, 680] }),
      makeItem('Row C', { transform: [12, 0, 0, 12, 100, 660] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    // Spacing: 700→680 = 20, 680→660 = 20, avg = 20
    expect(avgLineSpacing(rows)).toBe(20);
  });

  it('excludes abnormally large gaps (e.g. images)', () => {
    const items = [
      makeItem('Above image', { transform: [12, 0, 0, 12, 100, 500] }),
      makeItem('Normal line', { transform: [12, 0, 0, 12, 100, 485] }),
      makeItem('Below image', { transform: [12, 0, 0, 12, 100, 200] }),
      makeItem('Final line', { transform: [12, 0, 0, 12, 100, 185] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    // Gaps: 15, 285, 15. The 285 gap is >4× the running avg so far (15), so excluded.
    expect(avgLineSpacing(rows)).toBe(15);
  });

  it('returns fallback for empty rows', () => {
    expect(avgLineSpacing([])).toBe(12);
  });

  it('returns fallback for single row', () => {
    const index = buildPageTextIndex(1, [makeItem('Only row')]);
    const rows = buildRowIndex(index);
    expect(avgLineSpacing(rows)).toBeGreaterThan(0);
  });
});
