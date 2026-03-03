// Copyright (c) 2026 Seth Osher. MIT License.
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A rectangle with a rotation angle, used for text items with non-zero
 * rotation in the PDF transform matrix. Origin (x, y) is the bottom-left
 * corner in PDF coordinates (y-up), and the rect extends along the rotated
 * text direction.
 */
export interface RotatedRect extends Rect {
  /** Rotation angle in radians (PDF convention: positive = counterclockwise). */
  rotation: number;
}

/** Type guard: true when a Rect carries a non-zero rotation. */
export function isRotatedRect(rect: Rect): rect is RotatedRect {
  return 'rotation' in rect && (rect as RotatedRect).rotation !== 0;
}

/**
 * Compute a bounding rectangle from a pdf.js text item transform.
 * transform = [a, b, c, d, tx, ty] where (a,b) is the x-basis and (c,d) is
 * the y-basis of the affine transform from text space to page space.
 *
 * For non-rotated text (including italic): uses diagonal elements for scale,
 * producing an axis-aligned Rect identical to the previous implementation.
 *
 * For rotated text (e.g. word cloud items): decomposes rotation via atan2(b,a)
 * and scale via sqrt(a²+b²), returning a RotatedRect whose origin and
 * dimensions are in the rotated text's local frame.
 *
 * The rect extends below the baseline by a descender fraction (~25% of font
 * size) to cover characters like p, g, y, q, j.
 */
export function rectFromTransform(
  transform: number[],
  itemWidth: number,
  itemHeight: number,
): Rect {
  const [a, b, c, d, tx, ty] = transform;
  const rotation = Math.atan2(b, a);

  // For non-rotated text (including italic where skewX≠0 but b=0):
  // use diagonal-only extraction for exact backward compatibility.
  if (Math.abs(rotation) < 1e-6) {
    const scaleRatioX = (d !== 0) ? Math.abs(a) / Math.abs(d) : 1;
    const fontSize = Math.abs(d);
    const descenderDepth = fontSize * 0.25;

    return {
      x: tx,
      y: ty - descenderDepth,
      width: itemWidth * scaleRatioX,
      height: itemHeight + descenderDepth,
    };
  }

  // Rotated text: proper matrix decomposition.
  // xMag = scale magnitude along text direction, yMag = perpendicular scale.
  const xMag = Math.sqrt(a * a + b * b);
  const yMag = Math.sqrt(c * c + d * d);
  const scaleRatioX = yMag !== 0 ? xMag / yMag : 1;
  const fontSize = yMag;
  const descenderDepth = fontSize * 0.25;

  // Descender extends perpendicular-below the text baseline.
  // "Below baseline" in text-local frame is (0, -1), which in world frame
  // rotates to (sin θ, -cos θ).
  const sinR = Math.sin(rotation);
  const cosR = Math.cos(rotation);

  return {
    x: tx + sinR * descenderDepth,
    y: ty - cosR * descenderDepth,
    width: itemWidth * scaleRatioX,
    height: itemHeight + descenderDepth,
    rotation,
  } as RotatedRect;
}

/**
 * Convert a rectangle from PDF coordinate space (origin bottom-left, y-up)
 * to CSS coordinate space (origin top-left, y-down).
 *
 * For rotated rects, computes the CSS top-left pivot point and negates the
 * rotation angle (PDF CCW → CSS CW). The universal formula reduces to the
 * axis-aligned case when rotation = 0 (sin 0 = 0, cos 0 = 1).
 */
export function pdfRectToCssRect(
  rect: Rect,
  pageHeight: number,
  scale: number,
): Rect {
  const rotation = isRotatedRect(rect) ? rect.rotation : 0;

  if (rotation === 0) {
    return {
      x: rect.x * scale,
      y: (pageHeight - rect.y - rect.height) * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    };
  }

  // For rotated rects: compute CSS top-left corner as the pivot point.
  // PDF bottom-left → PDF top-left offset: height * (-sin θ, cos θ).
  // Then flip y for CSS.
  const sinR = Math.sin(rotation);
  const cosR = Math.cos(rotation);

  const result: RotatedRect = {
    x: (rect.x - rect.height * sinR) * scale,
    y: (pageHeight - rect.y - rect.height * cosR) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
    rotation: -rotation, // PDF CCW → CSS CW
  };
  return result;
}

/**
 * Merge horizontally adjacent rectangles that are on the same line.
 * Two rects are "on the same line" if their y values differ by less than tolerance.
 * Two rects are "adjacent" if the gap between them is less than tolerance.
 *
 * Rotated rects are never merged (each item stays separate) and are appended
 * after the merged axis-aligned rects.
 */
export function mergeAdjacentRects(rects: Rect[], tolerance: number): Rect[] {
  if (rects.length <= 1) return [...rects];

  // Separate rotated rects from axis-aligned ones.
  const axisAligned: Rect[] = [];
  const rotated: RotatedRect[] = [];
  for (const r of rects) {
    if (isRotatedRect(r)) {
      rotated.push({ ...r });
    } else {
      axisAligned.push(r);
    }
  }

  // Merge axis-aligned rects (existing logic).
  let merged: Rect[];
  if (axisAligned.length <= 1) {
    merged = axisAligned.map(r => ({ ...r }));
  } else {
    const sorted = [...axisAligned].sort((a, b) => a.y - b.y || a.x - b.x);
    merged = [{ ...sorted[0] }];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];
      const sameLine = Math.abs(current.y - last.y) < tolerance;
      const adjacent = current.x <= last.x + last.width + tolerance;

      if (sameLine && adjacent) {
        const newRight = Math.max(last.x + last.width, current.x + current.width);
        const newLeft = Math.min(last.x, current.x);
        last.x = newLeft;
        last.width = newRight - newLeft;
        last.height = Math.max(last.height, current.height);
      } else {
        merged.push({ ...current });
      }
    }
  }

  return [...merged, ...rotated];
}

/**
 * Rotate a PDF-space rectangle to account for page rotation.
 * Text content transforms are always in the original (unrotated) coordinate space,
 * but the rendered viewport uses rotated coordinates. This bridges the gap.
 *
 * For axis-aligned rects: width and height swap at 90° and 270°.
 *
 * For RotatedRect (item-level rotation): only the origin point is transformed
 * and the page rotation angle is added to the item rotation. Width/height stay
 * in the rect's local frame since rotation is tracked explicitly.
 */
export function rotatePdfRect(
  rect: Rect,
  rotation: number,
  origWidth: number,
  origHeight: number,
): Rect {
  if (rotation === 0) return rect;

  // For RotatedRects: transform origin point + combine rotation angles.
  if (isRotatedRect(rect)) {
    const pageRotRad = -rotation * (Math.PI / 180); // CW degrees → CCW radians
    let nx: number, ny: number;

    switch (rotation) {
      case 90:
        nx = rect.y;
        ny = origWidth - rect.x;
        break;
      case 180:
        nx = origWidth - rect.x;
        ny = origHeight - rect.y;
        break;
      case 270:
        nx = origHeight - rect.y;
        ny = rect.x;
        break;
      default:
        return rect;
    }

    return {
      x: nx,
      y: ny,
      width: rect.width,
      height: rect.height,
      rotation: rect.rotation + pageRotRad,
    } as RotatedRect;
  }

  // Axis-aligned rects: existing bounding-box transform with width/height swap.
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
 * Slice a rectangle along its text direction by start and end fractions (0 to 1).
 * Used for partial-item highlights.
 *
 * For rotated rects, the origin shifts along the text direction (cos θ, sin θ)
 * instead of just along x. For rotation = 0 this simplifies to the axis-aligned case.
 */
export function sliceRectHorizontal(
  rect: Rect,
  startFraction: number,
  endFraction: number,
): Rect {
  const rotation = isRotatedRect(rect) ? rect.rotation : 0;

  if (rotation === 0) {
    return {
      x: rect.x + rect.width * startFraction,
      y: rect.y,
      width: rect.width * (endFraction - startFraction),
      height: rect.height,
    };
  }

  const offset = rect.width * startFraction;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);

  return {
    x: rect.x + cosR * offset,
    y: rect.y + sinR * offset,
    width: rect.width * (endFraction - startFraction),
    height: rect.height,
    rotation,
  } as RotatedRect;
}
