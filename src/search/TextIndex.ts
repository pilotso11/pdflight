// Copyright (c) 2026 Seth Osher. MIT License.
import type { PdflightTextItem, CharMapping, PageTextIndex } from '../types';
import { normalizeQuotes } from '../utils/text';

/**
 * Build a PageTextIndex from an array of PdflightTextItems.
 *
 * Concatenates all item strings into a single normalized string and builds
 * a parallel charMap array that maps each character in the normalized string
 * back to its source item and character offset.
 *
 * Normalization:
 * 1. NFC unicode normalization
 * 2. Smart quotes → ASCII
 * 3. Rejoin hyphenated line breaks (item ending with '-' + hasEOL)
 * 4. Collapse whitespace (multiple spaces/newlines → single space)
 *
 * Space insertion rules:
 * - No space between items on the same line (same y-coordinate)
 * - Space between items on different lines
 * - Exception: hyphenated line breaks are rejoined
 */
export function buildPageTextIndex(
  pageNumber: number,
  items: PdflightTextItem[],
): PageTextIndex {
  // Phase 1: Build raw concatenated string with per-char source tracking.
  let rawText = '';
  const rawCharMap: CharMapping[] = [];

  for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
    const item = items[itemIdx];
    if (item.str.length === 0) continue;

    // Add separator space between items based on line position
    if (rawText.length > 0) {
      const prev = findPrevNonEmpty(items, itemIdx);

      if (prev !== null) {
        // Check if this is a hyphenated line break
        const isHyphenBreak = prev.item.str.endsWith('-') && prev.item.hasEOL;

        if (isHyphenBreak) {
          // Remove the trailing hyphen from rawText for rejoining
          rawText = rawText.slice(0, -1);
          rawCharMap.pop();
        } else {
          // Check if items are on different lines (using y-coordinate from transform)
          // transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
          const prevY = prev.item.transform[5];
          const currY = item.transform[5];
          const differentLine = Math.abs(prevY - currY) > 1; // Small tolerance for rounding

          if (differentLine) {
            // Insert space separator for items on different lines
            rawText += ' ';
            // Map separator space to end of previous item
            rawCharMap.push({ itemIndex: prev.index, charOffset: prev.item.str.length });
          }
          // If same line, don't insert space (items are adjacent)
        }
      }
    }

    for (let charIdx = 0; charIdx < item.str.length; charIdx++) {
      rawText += item.str[charIdx];
      rawCharMap.push({ itemIndex: itemIdx, charOffset: charIdx });
    }
  }

  // Phase 2: Apply normalizations while maintaining charMap correspondence.
  let normalized = rawText.normalize('NFC');
  normalized = normalizeQuotes(normalized);

  // Phase 3: Collapse whitespace while tracking charMap positions.
  const finalText: string[] = [];
  const finalCharMap: CharMapping[] = [];
  let prevWasSpace = false;
  let leadingWhitespace = true;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const isSpace = /\s/.test(ch);

    if (isSpace) {
      if (!leadingWhitespace && !prevWasSpace) {
        finalText.push(' ');
        finalCharMap.push(rawCharMap[i] ?? { itemIndex: 0, charOffset: 0 });
      }
      prevWasSpace = true;
    } else {
      leadingWhitespace = false;
      prevWasSpace = false;
      finalText.push(ch);
      finalCharMap.push(rawCharMap[i] ?? { itemIndex: 0, charOffset: 0 });
    }
  }

  // Trim trailing space
  if (finalText.length > 0 && finalText[finalText.length - 1] === ' ') {
    finalText.pop();
    finalCharMap.pop();
  }

  return {
    pageNumber,
    normalizedText: finalText.join(''),
    charMap: finalCharMap,
    items,
  };
}

function findPrevNonEmpty(items: PdflightTextItem[], currentIdx: number): { item: PdflightTextItem; index: number } | null {
  for (let i = currentIdx - 1; i >= 0; i--) {
    if (items[i].str.length > 0) return { item: items[i], index: i };
  }
  return null;
}
