// Copyright (c) 2026 Seth Osher. MIT License.
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute a bounding rectangle from a pdf.js text item transform.
 * transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
 * itemWidth and itemHeight are from the TextItem in PDF units.
 *
 * For non-rotated text: rect is simply (tx, ty, width * scaleRatioX, height).
 * The scaleRatioX accounts for transforms where scaleX != fontSize.
 *
 * The rect extends below the baseline by a descender fraction to cover
 * characters like p, g, y, q, j whose strokes go below the text baseline.
 * In PDF coordinates (y-up), ty is the baseline — descenders go to ty - depth.
 */
export function rectFromTransform(
  transform: number[],
  itemWidth: number,
  itemHeight: number,
): Rect {
  const [scaleX, skewY, skewX, scaleY, tx, ty] = transform;
  // For unrotated text, scaleX ≈ fontSize. The itemWidth is already in
  // user-space units, but if the transform has a different horizontal scale
  // than vertical, we need to account for it.
  const scaleRatioX = Math.sqrt(scaleX * scaleX + skewY * skewY) /
    Math.sqrt(scaleY * scaleY + skewX * skewX);

  // Extend rect below baseline for descenders (~25% of font size).
  // fontSize is derived from the vertical scale component of the transform.
  const fontSize = Math.sqrt(scaleY * scaleY + skewX * skewX);
  const descenderDepth = fontSize * 0.25;

  return {
    x: tx,
    y: ty - descenderDepth,
    width: itemWidth * scaleRatioX,
    height: itemHeight + descenderDepth,
  };
}

/**
 * Convert a rectangle from PDF coordinate space (origin bottom-left, y-up)
 * to CSS coordinate space (origin top-left, y-down).
 */
export function pdfRectToCssRect(
  rect: Rect,
  pageHeight: number,
  scale: number,
): Rect {
  return {
    x: rect.x * scale,
    y: (pageHeight - rect.y - rect.height) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/**
 * Merge horizontally adjacent rectangles that are on the same line.
 * Two rects are "on the same line" if their y values differ by less than tolerance.
 * Two rects are "adjacent" if the gap between them is less than tolerance.
 */
export function mergeAdjacentRects(rects: Rect[], tolerance: number): Rect[] {
  if (rects.length <= 1) return [...rects];

  // Sort by y (line), then by x (position within line)
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: Rect[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    const sameLine = Math.abs(current.y - last.y) < tolerance;
    const adjacent = current.x <= last.x + last.width + tolerance;

    if (sameLine && adjacent) {
      // Extend the last rect to cover current
      const newRight = Math.max(last.x + last.width, current.x + current.width);
      last.width = newRight - last.x;
      last.height = Math.max(last.height, current.height);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Rotate a PDF-space rectangle to account for page rotation.
 * Text content transforms are always in the original (unrotated) coordinate space,
 * but the rendered viewport uses rotated coordinates. This bridges the gap.
 *
 * For rotation 90° CW: original x-axis → rotated y-axis (inverted), original y-axis → rotated x-axis.
 * Width and height swap at 90° and 270°.
 */
export function rotatePdfRect(
  rect: Rect,
  rotation: number,
  origWidth: number,
  origHeight: number,
): Rect {
  switch (rotation) {
    case 90:
      return { x: rect.y, y: origWidth - rect.x - rect.width, width: rect.height, height: rect.width };
    case 180:
      return { x: origWidth - rect.x - rect.width, y: origHeight - rect.y - rect.height, width: rect.width, height: rect.height };
    case 270:
      return { x: origHeight - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width };
    default:
      return rect;
  }
}

/**
 * Slice a rectangle horizontally by start and end fractions (0 to 1).
 * Used for partial-item highlights.
 */
export function sliceRectHorizontal(
  rect: Rect,
  startFraction: number,
  endFraction: number,
): Rect {
  return {
    x: rect.x + rect.width * startFraction,
    y: rect.y,
    width: rect.width * (endFraction - startFraction),
    height: rect.height,
  };
}
