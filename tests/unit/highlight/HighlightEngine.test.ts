import { describe, it, expect } from 'vitest';
import { computeHighlightRects } from '../../../src/highlight/HighlightEngine';
import { buildPageTextIndex } from '../../../src/search/TextIndex';
import type { PdflightTextItem } from '../../../src/types';

function makeItem(
  str: string,
  overrides?: Partial<PdflightTextItem>,
): PdflightTextItem {
  const charWidths = Array.from(str, () => 7);
  return {
    str,
    transform: [12, 0, 0, 12, 100, 500],
    width: str.length * 7,
    height: 12,
    fontName: 'TestFont',
    hasEOL: false,
    charWidths,
    ...overrides,
  };
}

describe('computeHighlightRects', () => {
  const pageHeight = 792;
  const zoomScale = 1.5;

  it('computes rect for full-item highlight', () => {
    // fontSize=12, descenderDepth=12*0.25=3
    // PDF rect: y=500-3=497, height=12+3=15
    // CSS rect: y=(792-497-15)*1.5=420, height=15*1.5=22.5
    const items = [makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] })];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 1, startChar: 0, endChar: 5, id: 'h1', color: 'yellow' }, pageHeight, zoomScale);
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBeCloseTo(100 * zoomScale);
    expect(rects[0].y).toBeCloseTo((792 - 497 - 15) * zoomScale);
    expect(rects[0].width).toBeCloseTo(5 * 7 * zoomScale);
    expect(rects[0].height).toBeCloseTo(15 * zoomScale);
  });

  it('computes rect for partial-item highlight (start offset)', () => {
    const items = [makeItem('Hello', { charWidths: [5, 6, 7, 8, 9] })];
    const index = buildPageTextIndex(1, items);
    // Highlight chars 1-3 ('ell')
    const rects = computeHighlightRects(index, { page: 1, startChar: 1, endChar: 3, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBeCloseTo(100 + 5); // 100 + first char width
    expect(rects[0].width).toBeCloseTo(6 + 7); // 'e' + 'l'
  });

  it('computes rects for highlight spanning multiple items', () => {
    // Items on different lines should produce separate rects
    const items = [
      makeItem('Hello ', { transform: [12, 0, 0, 12, 100, 500] }),
      makeItem('World', { transform: [12, 0, 0, 12, 100, 480] })  // Different y position
    ];
    const index = buildPageTextIndex(1, items);
    // Highlight entire 'Hello World' (including the space)
    const rects = computeHighlightRects(index, { page: 1, startChar: 0, endChar: 11, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(2);
  });

  it('merges adjacent rects on same line', () => {
    const items = [makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] }), makeItem(' World', { transform: [12, 0, 0, 12, 135, 500] })];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 1, startChar: 0, endChar: 11, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(1); // Should merge into one rect
  });

  it('returns empty array for highlight on different page', () => {
    const items = [makeItem('Hello')];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 2, startChar: 0, endChar: 5, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(0);
  });

  it('handles endChar at item boundary', () => {
    const items = [makeItem('Hello'), makeItem('World')];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 1, startChar: 0, endChar: 5, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(1);
  });
});
