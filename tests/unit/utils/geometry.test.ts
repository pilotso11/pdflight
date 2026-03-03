import { describe, it, expect } from 'vitest';
import {
  rectFromTransform,
  pdfRectToCssRect,
  mergeAdjacentRects,
  sliceRectHorizontal,
  rotatePdfRect,
  isRotatedRect,
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

  it('handles zero scale gracefully', () => {
    // Zero scaleX/scaleY — fontSize=0, descenderDepth=0, scaleRatio falls back to 1
    const rect = rectFromTransform([0, 0, 0, 0, 50, 300], 10, 5);
    expect(rect.x).toBe(50);
    expect(rect.y).toBe(300); // 300 - 0 descender
    expect(rect.height).toBe(5); // 5 + 0 descender
    expect(rect.width).toBe(10); // 10 * 1 (fallback ratio)
  });

  it('handles skewed+rotated transform via matrix decomposition', () => {
    // transform [10, 5, 3, 12, 200, 600]: has both skew and rotation
    // rotation = atan2(5, 10) ≈ 0.464 rad
    // xMag = sqrt(100+25) ≈ 11.18, yMag = sqrt(9+144) ≈ 12.37
    // scaleRatio = xMag/yMag ≈ 0.904, fontSize = yMag ≈ 12.37
    const rect = rectFromTransform([10, 5, 3, 12, 200, 600], 40, 12);
    expect(isRotatedRect(rect)).toBe(true);
    if (isRotatedRect(rect)) {
      expect(rect.rotation).toBeCloseTo(Math.atan2(5, 10));
      const xMag = Math.sqrt(125);
      const yMag = Math.sqrt(153);
      expect(rect.width).toBeCloseTo(40 * xMag / yMag);
      expect(rect.height).toBeCloseTo(12 + yMag * 0.25);
    }
  });

  it('italic skew does not shrink width (pure italic, equal scale)', () => {
    // Italic text: scaleX = scaleY = 10.5, skewX = 2.81 (like the sample PDF)
    // Width should pass through at full size (ratio = 1.0)
    const rect = rectFromTransform([10.5, 0, 2.81, 10.5, 100, 500], 160, 10.5);
    expect(rect.width).toBeCloseTo(160); // no shrinkage from italic skew
  });

  it('returns RotatedRect for 90° CW rotated text (word cloud)', () => {
    // transform [0, -26, 26, 0, x, y]: text goes downward
    // atan2(-26, 0) = -π/2
    const rect = rectFromTransform([0, -26, 26, 0, 200, 400], 50, 26);
    expect(isRotatedRect(rect)).toBe(true);
    if (isRotatedRect(rect)) {
      expect(rect.rotation).toBeCloseTo(-Math.PI / 2);
      // xMag = 26, yMag = 26, ratio = 1, fontSize = 26, descender = 6.5
      expect(rect.width).toBeCloseTo(50);
      expect(rect.height).toBeCloseTo(26 + 6.5);
      // Origin shifted by descender in perpendicular-below direction:
      // sin(-π/2) * 6.5 = -6.5, so x = 200 + (-6.5) = 193.5
      // -cos(-π/2) * 6.5 ≈ 0, so y ≈ 400
      expect(rect.x).toBeCloseTo(200 - 6.5);
      expect(rect.y).toBeCloseTo(400);
    }
  });

  it('returns RotatedRect for 90° CCW rotated text', () => {
    // transform [0, 26, -26, 0, x, y]: text goes upward
    // atan2(26, 0) = π/2
    const rect = rectFromTransform([0, 26, -26, 0, 300, 500], 40, 26);
    expect(isRotatedRect(rect)).toBe(true);
    if (isRotatedRect(rect)) {
      expect(rect.rotation).toBeCloseTo(Math.PI / 2);
    }
  });

  it('returns plain Rect (not rotated) for standard horizontal text', () => {
    const rect = rectFromTransform([12, 0, 0, 12, 100, 500], 60, 12);
    expect(isRotatedRect(rect)).toBe(false);
  });

  it('returns plain Rect for italic text (no rotation despite skew)', () => {
    const rect = rectFromTransform([10.5, 0, 2.81, 10.5, 100, 500], 160, 10.5);
    expect(isRotatedRect(rect)).toBe(false);
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

describe('pdfRectToCssRect with rotation', () => {
  it('converts rotated rect with negated rotation angle', () => {
    // A rotated rect at -π/2 should produce CSS rotation of +π/2
    const rotatedRect = { x: 200, y: 400, width: 50, height: 32.5, rotation: -Math.PI / 2 };
    const css = pdfRectToCssRect(rotatedRect, 792, 1.0);
    expect(isRotatedRect(css)).toBe(true);
    if (isRotatedRect(css)) {
      expect(css.rotation).toBeCloseTo(Math.PI / 2); // negated
      expect(css.width).toBeCloseTo(50);
      expect(css.height).toBeCloseTo(32.5);
    }
  });

  it('non-rotated rect returns plain Rect (no rotation field)', () => {
    const rect = { x: 100, y: 500, width: 60, height: 12 };
    const css = pdfRectToCssRect(rect, 792, 1.0);
    expect(isRotatedRect(css)).toBe(false);
  });
});

describe('sliceRectHorizontal with rotation', () => {
  it('shifts origin along text direction for rotated rect', () => {
    // rotation = -π/2 (text going downward): cos(-π/2) ≈ 0, sin(-π/2) = -1
    const rect = { x: 200, y: 400, width: 100, height: 32, rotation: -Math.PI / 2 };
    const sliced = sliceRectHorizontal(rect, 0.2, 0.7);
    expect(isRotatedRect(sliced)).toBe(true);
    if (isRotatedRect(sliced)) {
      expect(sliced.rotation).toBeCloseTo(-Math.PI / 2);
      expect(sliced.width).toBeCloseTo(50); // 100 * (0.7 - 0.2)
      // For -π/2: cos = 0, sin = -1. Offset = 100 * 0.2 = 20
      // x shifts by cos * offset ≈ 0, y shifts by sin * offset = -20
      expect(sliced.x).toBeCloseTo(200);
      expect(sliced.y).toBeCloseTo(400 - 20);
    }
  });

  it('non-rotated rect uses existing x-shift logic', () => {
    const rect = { x: 100, y: 200, width: 100, height: 12 };
    const sliced = sliceRectHorizontal(rect, 0.3, 0.8);
    expect(isRotatedRect(sliced)).toBe(false);
    expect(sliced.x).toBeCloseTo(130);
    expect(sliced.width).toBeCloseTo(50);
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

  it('handles start > end (degenerate slice)', () => {
    const rect = { x: 100, y: 200, width: 100, height: 12 };
    const sliced = sliceRectHorizontal(rect, 0.7, 0.2);
    // Width becomes negative: 100 * (0.2 - 0.7) = -50
    expect(sliced.width).toBeCloseTo(-50);
  });

  it('handles zero-width rect', () => {
    const rect = { x: 100, y: 200, width: 0, height: 12 };
    const sliced = sliceRectHorizontal(rect, 0.2, 0.8);
    expect(sliced.x).toBeCloseTo(100);
    expect(sliced.width).toBeCloseTo(0);
  });
});

describe('rotatePdfRect', () => {
  // Use a non-square page to verify width/height swapping
  const origWidth = 612;  // US Letter width
  const origHeight = 792; // US Letter height
  const rect = { x: 100, y: 200, width: 50, height: 12 };

  it('returns same rect for 0° rotation', () => {
    const result = rotatePdfRect(rect, 0, origWidth, origHeight);
    expect(result).toEqual(rect);
  });

  it('rotates 90° CW correctly', () => {
    // x→y(inverted), y→x, width↔height swap
    const result = rotatePdfRect(rect, 90, origWidth, origHeight);
    expect(result.x).toBeCloseTo(200);                     // rect.y
    expect(result.y).toBeCloseTo(origWidth - 100 - 50);    // origWidth - rect.x - rect.width
    expect(result.width).toBeCloseTo(12);                   // rect.height
    expect(result.height).toBeCloseTo(50);                  // rect.width
  });

  it('rotates 180° correctly', () => {
    // Both axes inverted, no width/height swap
    const result = rotatePdfRect(rect, 180, origWidth, origHeight);
    expect(result.x).toBeCloseTo(origWidth - 100 - 50);    // origWidth - rect.x - rect.width
    expect(result.y).toBeCloseTo(origHeight - 200 - 12);   // origHeight - rect.y - rect.height
    expect(result.width).toBeCloseTo(50);
    expect(result.height).toBeCloseTo(12);
  });

  it('rotates 270° CW correctly', () => {
    // Inverse of 90°
    const result = rotatePdfRect(rect, 270, origWidth, origHeight);
    expect(result.x).toBeCloseTo(origHeight - 200 - 12);   // origHeight - rect.y - rect.height
    expect(result.y).toBeCloseTo(100);                      // rect.x
    expect(result.width).toBeCloseTo(12);                   // rect.height
    expect(result.height).toBeCloseTo(50);                  // rect.width
  });

  it('round-trips through all four rotations back to original', () => {
    // Rotating 90° four times should return to the original rect,
    // but the page dimensions swap at each step.
    let r = { ...rect };
    let w = origWidth;
    let h = origHeight;

    // 0° → 90°: page dimensions swap for next rotation
    r = rotatePdfRect(r, 90, w, h);
    [w, h] = [h, w]; // viewport is now h × w

    // 90° → 180°
    r = rotatePdfRect(r, 90, w, h);
    [w, h] = [h, w];

    // 180° → 270°
    r = rotatePdfRect(r, 90, w, h);
    [w, h] = [h, w];

    // 270° → 360° (back to 0°)
    r = rotatePdfRect(r, 90, w, h);

    expect(r.x).toBeCloseTo(rect.x);
    expect(r.y).toBeCloseTo(rect.y);
    expect(r.width).toBeCloseTo(rect.width);
    expect(r.height).toBeCloseTo(rect.height);
  });

  it('handles rect at page origin (0,0)', () => {
    const origin = { x: 0, y: 0, width: 20, height: 10 };
    const r90 = rotatePdfRect(origin, 90, origWidth, origHeight);
    expect(r90.x).toBeCloseTo(0);
    expect(r90.y).toBeCloseTo(origWidth - 20);
    expect(r90.width).toBeCloseTo(10);
    expect(r90.height).toBeCloseTo(20);
  });

  it('handles square page correctly', () => {
    const sq = { x: 10, y: 20, width: 30, height: 15 };
    const size = 500;
    const r90 = rotatePdfRect(sq, 90, size, size);
    expect(r90.x).toBeCloseTo(20);
    expect(r90.y).toBeCloseTo(size - 10 - 30);
    expect(r90.width).toBeCloseTo(15);
    expect(r90.height).toBeCloseTo(30);
  });
});

describe('rotatePdfRect with RotatedRect (item + page rotation)', () => {
  const origWidth = 612;
  const origHeight = 792;

  it('combines item rotation with 90° page rotation', () => {
    // Item rotated -π/2 (text going down), page rotated 90° CW
    const rect = { x: 200, y: 400, width: 50, height: 32, rotation: -Math.PI / 2 };
    const result = rotatePdfRect(rect, 90, origWidth, origHeight);
    expect(isRotatedRect(result)).toBe(true);
    if (isRotatedRect(result)) {
      // Page 90° CW = -π/2 added to item rotation
      expect(result.rotation).toBeCloseTo(-Math.PI / 2 + (-Math.PI / 2));
      // Origin point: (x,y) → (y, origWidth - x) = (400, 412)
      expect(result.x).toBeCloseTo(400);
      expect(result.y).toBeCloseTo(origWidth - 200);
      // Width/height unchanged (rotation is tracked in angle)
      expect(result.width).toBeCloseTo(50);
      expect(result.height).toBeCloseTo(32);
    }
  });

  it('combines item rotation with 180° page rotation', () => {
    const rect = { x: 100, y: 300, width: 40, height: 20, rotation: Math.PI / 4 };
    const result = rotatePdfRect(rect, 180, origWidth, origHeight);
    expect(isRotatedRect(result)).toBe(true);
    if (isRotatedRect(result)) {
      expect(result.rotation).toBeCloseTo(Math.PI / 4 + (-Math.PI));
      expect(result.x).toBeCloseTo(origWidth - 100);
      expect(result.y).toBeCloseTo(origHeight - 300);
    }
  });

  it('combines item rotation with 270° page rotation', () => {
    const rect = { x: 150, y: 500, width: 60, height: 25, rotation: -Math.PI / 2 };
    const result = rotatePdfRect(rect, 270, origWidth, origHeight);
    expect(isRotatedRect(result)).toBe(true);
    if (isRotatedRect(result)) {
      expect(result.rotation).toBeCloseTo(-Math.PI / 2 + (-3 * Math.PI / 2));
      expect(result.x).toBeCloseTo(origHeight - 500);
      expect(result.y).toBeCloseTo(150);
    }
  });

  it('returns unchanged RotatedRect for 0° page rotation', () => {
    const rect = { x: 200, y: 400, width: 50, height: 32, rotation: -Math.PI / 2 };
    const result = rotatePdfRect(rect, 0, origWidth, origHeight);
    expect(result).toEqual(rect);
  });
});

describe('mergeAdjacentRects with rotated rects', () => {
  it('does not merge rotated rects, appends them after merged axis-aligned', () => {
    const rects = [
      { x: 100, y: 200, width: 30, height: 12 },
      { x: 130, y: 200, width: 30, height: 12 },
      { x: 50, y: 300, width: 40, height: 20, rotation: -Math.PI / 2 },
    ];
    const merged = mergeAdjacentRects(rects, 2);
    // First two merge, rotated rect stays separate
    expect(merged).toHaveLength(2);
    expect(merged[0].width).toBeCloseTo(60); // merged axis-aligned
    expect(isRotatedRect(merged[1])).toBe(true);
  });

  it('handles all-rotated rects (no merging)', () => {
    const rects = [
      { x: 100, y: 200, width: 30, height: 12, rotation: -Math.PI / 2 },
      { x: 130, y: 200, width: 30, height: 12, rotation: -Math.PI / 2 },
    ];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(2);
  });
});

describe('mergeAdjacentRects edge cases', () => {
  it('merges overlapping rects on same line', () => {
    const rects = [
      { x: 100, y: 200, width: 40, height: 12 },
      { x: 120, y: 200, width: 40, height: 12 }, // overlaps first rect
    ];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(1);
    expect(merged[0].x).toBeCloseTo(100);
    expect(merged[0].width).toBeCloseTo(60); // 100 to 160
  });

  it('does not merge non-adjacent rects on same line', () => {
    const rects = [
      { x: 100, y: 200, width: 30, height: 12 },
      { x: 200, y: 200, width: 30, height: 12 }, // gap of 70
    ];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(2);
  });

  it('uses max height when merging rects of different heights', () => {
    const rects = [
      { x: 100, y: 200, width: 30, height: 10 },
      { x: 130, y: 200, width: 30, height: 16 },
    ];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(1);
    expect(merged[0].height).toBe(16);
  });

  it('handles rects with zero width', () => {
    const rects = [
      { x: 100, y: 200, width: 0, height: 12 },
      { x: 100, y: 200, width: 30, height: 12 },
    ];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(1);
    expect(merged[0].width).toBeCloseTo(30);
  });

  it('handles unsorted input correctly', () => {
    const rects = [
      { x: 200, y: 100, width: 30, height: 12 },
      { x: 100, y: 200, width: 30, height: 12 },
      { x: 100, y: 100, width: 30, height: 12 },
    ];
    const merged = mergeAdjacentRects(rects, 2);
    // Two lines: y=100 has two rects (x=100 and x=200, gap too big), y=200 has one
    expect(merged).toHaveLength(3);
  });
});
