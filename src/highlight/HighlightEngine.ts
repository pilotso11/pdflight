import type { PageTextIndex } from '../types';
import type { Highlight, HighlightRect } from './types';
import { rectFromTransform, pdfRectToCssRect, mergeAdjacentRects, sliceRectHorizontal } from '../utils/geometry';

interface ItemRange {
  itemIndex: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Compute highlight rectangles for a highlight on a specific page.
 * Uses per-character width data from the TextIndex for accurate partial-item positioning.
 * Merges adjacent rectangles on the same line.
 */
export function computeHighlightRects(
  pageIndex: PageTextIndex,
  highlight: Highlight,
  pageHeight: number,
  scale: number,
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
    const cssRect = pdfRectToCssRect(itemRect, pageHeight, scale);

    if (range.startOffset === 0 && range.endOffset === item.str.length) {
      // Full item highlight
      rects.push(cssRect);
    } else {
      // Partial item highlight — use charWidths for precision
      const startFraction = sumWidths(item.charWidths, 0, range.startOffset) / sumWidths(item.charWidths);
      const endFraction = sumWidths(item.charWidths, 0, range.endOffset) / sumWidths(item.charWidths);
      const partialRect = sliceRectHorizontal(cssRect, startFraction, endFraction);
      rects.push(partialRect);
    }
  }

  // Merge adjacent rects on the same line (within 2px tolerance)
  const merged = mergeAdjacentRects(rects, 2 * scale);

  // Add buffer/padding around each rect (1/2 character height in each dimension)
  return addBufferToRects(merged, scale);
}

/**
 * Add buffer/padding around highlight rects for better visual appearance.
 * Buffer is 0.5 * character height, scaled appropriately.
 */
function addBufferToRects(rects: HighlightRect[], scale: number): HighlightRect[] {
  const buffer = 0.5 * 12 * scale; // ~0.5 char height (assuming 12pt font)

  return rects.map(rect => ({
    ...rect,
    x: Math.max(0, rect.x - buffer),
    y: Math.max(0, rect.y - buffer),
    width: rect.width + (buffer * 2),
    height: rect.height + (buffer * 2),
  }));
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
