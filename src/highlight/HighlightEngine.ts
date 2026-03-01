// Copyright (c) 2026 Seth Osher. MIT License.
import type { PageTextIndex } from '../types';
import type { Highlight, HighlightRect } from './types';
import { rectFromTransform, rotatePdfRect, pdfRectToCssRect, mergeAdjacentRects, sliceRectHorizontal } from '../utils/geometry';

interface ItemRange {
  itemIndex: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Compute highlight rectangles for a highlight on a specific page.
 * Uses per-character width data from the TextIndex for accurate partial-item positioning.
 * Merges adjacent rectangles on the same line.
 *
 * When rotation is non-zero, PDF-space rects are rotated to match the viewport
 * before converting to CSS coordinates. Partial-item slicing happens in the
 * original (unrotated) coordinate space where text runs horizontally.
 */
export function computeHighlightRects(
  pageIndex: PageTextIndex,
  highlight: Highlight,
  pageHeight: number,
  scale: number,
  rotation: number = 0,
  unrotatedPageWidth: number = 0,
  unrotatedPageHeight: number = 0,
): HighlightRect[] {
  if (highlight.page !== pageIndex.pageNumber) {
    return [];
  }

  const { startChar, endChar } = highlight;
  if (startChar >= endChar || endChar > pageIndex.charMap.length) {
    return [];
  }

  // Map character range to item ranges
  const itemRanges = mapCharRangeToItems(pageIndex, startChar, endChar);

  // Compute rects for each item range
  const rects: HighlightRect[] = [];
  for (const range of itemRanges) {
    const item = pageIndex.items[range.itemIndex];
    const itemRect = rectFromTransform(item.transform, item.width, item.height);

    // For partial items, slice in unrotated PDF space (where text is horizontal)
    let pdfRect: HighlightRect;
    if (range.startOffset === 0 && range.endOffset === item.str.length) {
      pdfRect = itemRect;
    } else {
      const totalWidth = sumWidths(item.charWidths);

      if (totalWidth === 0 || !item.charWidths || item.charWidths.length === 0) {
        const charCount = item.str.length;
        const startFraction = range.startOffset / charCount;
        const endFraction = range.endOffset / charCount;
        pdfRect = sliceRectHorizontal(itemRect, startFraction, endFraction);
      } else {
        const startFraction = sumWidths(item.charWidths, 0, range.startOffset) / totalWidth;
        const endFraction = sumWidths(item.charWidths, 0, range.endOffset) / totalWidth;
        pdfRect = sliceRectHorizontal(itemRect, startFraction, endFraction);
      }
    }

    // Rotate PDF rect to match the rotated viewport, then convert to CSS
    const rotatedRect = rotation !== 0
      ? rotatePdfRect(pdfRect, rotation, unrotatedPageWidth, unrotatedPageHeight)
      : pdfRect;
    rects.push(pdfRectToCssRect(rotatedRect, pageHeight, scale));
  }

  // Merge adjacent rects on the same line (within 2px tolerance)
  return mergeAdjacentRects(rects, 2 * scale);
}

function mapCharRangeToItems(
  pageIndex: PageTextIndex,
  startChar: number,
  endChar: number,
): ItemRange[] {
  const ranges: ItemRange[] = [];
  let currentRange: ItemRange | null = null;

  for (let i = startChar; i < endChar; i++) {
    const mapping = pageIndex.charMap[i];
    if (!currentRange || currentRange.itemIndex !== mapping.itemIndex) {
      if (currentRange) {
        ranges.push(currentRange);
      }
      currentRange = { itemIndex: mapping.itemIndex, startOffset: mapping.charOffset, endOffset: mapping.charOffset + 1 };
    } else {
      currentRange.endOffset = Math.max(currentRange.endOffset, mapping.charOffset + 1);
    }
  }

  if (currentRange) {
    ranges.push(currentRange);
  }

  return ranges;
}

function sumWidths(widths: number[], start = 0, end = widths.length): number {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += widths[i] ?? 0;
  }
  return sum;
}
