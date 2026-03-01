import { describe, it, expect } from 'vitest';
import {
  rectFromTransform,
  pdfRectToCssRect,
  mergeAdjacentRects,
  sliceRectHorizontal,
} from '../../../src/utils/geometry';

describe('rectFromTransform', () => {
  it('computes rect from simple unrotated transform with descender extension', () => {
    // transform = [fontSize, 0, 0, fontSize, x, y] where fontSize=12
    // descenderDepth = 12 * 0.25 = 3
    const rect = rectFromTransform([12, 0, 0, 12, 100, 500], 60, 12);
    expect(rect.x).toBeCloseTo(100);
    expect(rect.y).toBeCloseTo(500 - 3); // baseline - descender
    expect(rect.width).toBeCloseTo(60);
    expect(rect.height).toBeCloseTo(12 + 3); // itemHeight + descender
  });

  it('handles scaled transform', () => {
    // transform with scaleX=24, scaleY=12: fontSize=12, descenderDepth=3
    const rect = rectFromTransform([24, 0, 0, 12, 100, 500], 60, 12);
    expect(rect.width).toBeCloseTo(120);
    expect(rect.height).toBeCloseTo(12 + 3); // itemHeight + descender
  });
});

describe('pdfRectToCssRect', () => {
  it('converts PDF coords (bottom-left origin) to CSS coords (top-left origin)', () => {
    const pdfRect = { x: 100, y: 500, width: 60, height: 12 };
    const pageHeight = 792; // standard US letter
    const scale = 1.0;
    const css = pdfRectToCssRect(pdfRect, pageHeight, scale);
    // CSS y = pageHeight - pdfY - height
    expect(css.x).toBeCloseTo(100);
    expect(css.y).toBeCloseTo(792 - 500 - 12);
    expect(css.width).toBeCloseTo(60);
    expect(css.height).toBeCloseTo(12);
  });

  it('applies scale factor', () => {
    const pdfRect = { x: 100, y: 500, width: 60, height: 12 };
    const css = pdfRectToCssRect(pdfRect, 792, 2.0);
    expect(css.x).toBeCloseTo(200);
    expect(css.y).toBeCloseTo((792 - 500 - 12) * 2);
    expect(css.width).toBeCloseTo(120);
    expect(css.height).toBeCloseTo(24);
  });
});

describe('mergeAdjacentRects', () => {
  it('merges horizontally adjacent rects on the same line', () => {
    const rects = [
      { x: 100, y: 200, width: 30, height: 12 },
      { x: 130, y: 200, width: 40, height: 12 },
    ];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(1);
    expect(merged[0].x).toBeCloseTo(100);
    expect(merged[0].width).toBeCloseTo(70);
  });

  it('does not merge rects on different lines', () => {
    const rects = [
      { x: 100, y: 200, width: 30, height: 12 },
      { x: 100, y: 220, width: 40, height: 12 },
    ];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(2);
  });

  it('handles empty input', () => {
    expect(mergeAdjacentRects([], 2)).toEqual([]);
  });

  it('handles single rect', () => {
    const rects = [{ x: 100, y: 200, width: 30, height: 12 }];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(1);
  });
});

describe('sliceRectHorizontal', () => {
  it('slices a rect by start and end fractions', () => {
    const rect = { x: 100, y: 200, width: 100, height: 12 };
    const sliced = sliceRectHorizontal(rect, 0.2, 0.7);
    expect(sliced.x).toBeCloseTo(120);
    expect(sliced.width).toBeCloseTo(50);
    expect(sliced.y).toBe(200);
    expect(sliced.height).toBe(12);
  });

  it('returns full rect for 0 to 1', () => {
    const rect = { x: 100, y: 200, width: 100, height: 12 };
    const sliced = sliceRectHorizontal(rect, 0, 1);
    expect(sliced).toEqual(rect);
  });
});
