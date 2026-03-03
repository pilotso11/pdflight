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

  it('returns empty array for negative startChar', () => {
    const items = [makeItem('Hello')];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 1, startChar: -1, endChar: 3, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(0);
  });

  it('returns empty array for startChar >= endChar', () => {
    const items = [makeItem('Hello')];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 1, startChar: 3, endChar: 3, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(0);
  });

  it('returns empty array for endChar beyond charMap length', () => {
    const items = [makeItem('Hi')];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 1, startChar: 0, endChar: 100, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(0);
  });

  it('handles item with no charWidths (fallback to uniform)', () => {
    const items = [makeItem('Hello', {
      charWidths: [], // empty charWidths
      width: 35,
    })];
    const index = buildPageTextIndex(1, items);
    // Highlight partial: chars 1-3 ('el')
    const rects = computeHighlightRects(index, { page: 1, startChar: 1, endChar: 3, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(1);
    // Fallback to uniform: each char = 35/5 = 7, so start at 100+7, width = 14
    expect(rects[0].x).toBeCloseTo(100 + 7);
    expect(rects[0].width).toBeCloseTo(14);
  });

  it('computes rotated highlight rect for rotated text item', () => {
    // Word cloud style: text rotated 90° CW, transform [0, -26, 26, 0, x, y]
    const items = [makeItem('LLM', {
      transform: [0, -26, 26, 0, 200, 400],
      width: 3 * 7,
      height: 26,
      charWidths: [7, 7, 7],
    })];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(
      index,
      { page: 1, startChar: 0, endChar: 3, id: 'h1', color: 'yellow' },
      792,
      1.0,
    );
    expect(rects).toHaveLength(1);
    // Should have non-zero rotation
    expect(rects[0].rotation).toBeDefined();
    expect(rects[0].rotation).not.toBe(0);
    // Should have reasonable dimensions (not collapsed)
    expect(rects[0].width).toBeGreaterThan(10);
    expect(rects[0].height).toBeGreaterThan(10);
  });

  it('non-rotated items produce rects without rotation', () => {
    const items = [makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] })];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(
      index,
      { page: 1, startChar: 0, endChar: 5, id: 'h1', color: 'yellow' },
      792,
      1.0,
    );
    expect(rects).toHaveLength(1);
    expect(rects[0].rotation).toBeUndefined();
  });

  it('computes rects with 90° rotation', () => {
    const items = [makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] })];
    const index = buildPageTextIndex(1, items);
    const unrotatedW = 612;
    const unrotatedH = 792;
    // With rotation, the "page height" for CSS conversion becomes the rotated viewport height
    // which equals the original page width (612)
    const rotatedPageHeight = unrotatedW;
    const rects = computeHighlightRects(
      index,
      { page: 1, startChar: 0, endChar: 5, id: 'h1', color: 'yellow' },
      rotatedPageHeight,
      1.0,
      90,
      unrotatedW,
      unrotatedH,
    );
    expect(rects).toHaveLength(1);
    // At 90°, width and height swap in the result
    // The rect should exist and have positive dimensions
    expect(rects[0].width).toBeGreaterThan(0);
    expect(rects[0].height).toBeGreaterThan(0);
  });

  it('computes rects with 180° rotation', () => {
    const items = [makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] })];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(
      index,
      { page: 1, startChar: 0, endChar: 5, id: 'h1', color: 'yellow' },
      792,
      1.0,
      180,
      612,
      792,
    );
    expect(rects).toHaveLength(1);
    expect(rects[0].width).toBeGreaterThan(0);
    expect(rects[0].height).toBeGreaterThan(0);
  });

  it('computes rects with 270° rotation', () => {
    const items = [makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] })];
    const index = buildPageTextIndex(1, items);
    const rotatedPageHeight = 612; // original width becomes height
    const rects = computeHighlightRects(
      index,
      { page: 1, startChar: 0, endChar: 5, id: 'h1', color: 'yellow' },
      rotatedPageHeight,
      1.0,
      270,
      612,
      792,
    );
    expect(rects).toHaveLength(1);
    expect(rects[0].width).toBeGreaterThan(0);
    expect(rects[0].height).toBeGreaterThan(0);
  });
});
