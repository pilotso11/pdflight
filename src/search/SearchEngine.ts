// Copyright (c) 2026 Seth Osher. MIT License.
import type { PageTextIndex } from '../types';
import type { SearchMatch } from './types';

/**
 * Search across all page text indices for a query string.
 * Case-insensitive substring matching on the normalized text.
 * Returns matches ordered by page, then by visual position (top-to-bottom, left-to-right).
 */
export function searchPages(
  pages: PageTextIndex[],
  query: string,
): SearchMatch[] {
  if (!query || query.length === 0) return [];

  const queryLower = query.toLowerCase();
  const results: SearchMatch[] = [];

  for (const page of pages) {
    const textLower = page.normalizedText.toLowerCase();
    let searchFrom = 0;

    while (searchFrom <= textLower.length - queryLower.length) {
      const idx = textLower.indexOf(queryLower, searchFrom);
      if (idx === -1) break;

      results.push({
        page: page.pageNumber,
        startChar: idx,
        endChar: idx + queryLower.length,
        text: page.normalizedText.slice(idx, idx + queryLower.length),
      });

      searchFrom = idx + 1; // Allow overlapping matches
    }
  }

  // Sort by visual position: page first, then top-to-bottom (descending y in
  // PDF coordinates), then left-to-right (ascending x).
  return sortMatchesByVisualPosition(results, pages);
}

/**
 * Sort matches by visual reading order using the text item transforms.
 * PDF coordinate system has y increasing upward, so higher y = higher on page.
 */
function sortMatchesByVisualPosition(
  matches: SearchMatch[],
  pages: PageTextIndex[],
): SearchMatch[] {
  const pageMap = new Map(pages.map((p) => [p.pageNumber, p]));

  return matches.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;

    const pageA = pageMap.get(a.page);
    const pageB = pageMap.get(b.page);
    if (!pageA || !pageB) return 0;

    const itemA = getMatchItem(pageA, a.startChar);
    const itemB = getMatchItem(pageB, b.startChar);
    if (!itemA || !itemB) return 0;

    // Higher y = higher on page in PDF coords, so sort descending
    const yDiff = itemB.transform[5] - itemA.transform[5];
    if (Math.abs(yDiff) > 1) return yDiff;

    // Same line: sort by x (ascending, left to right)
    return itemA.transform[4] - itemB.transform[4];
  });
}

function getMatchItem(page: PageTextIndex, charIndex: number): PageTextIndex['items'][number] | null {
  const mapping = page.charMap[charIndex];
  if (!mapping) return null;
  return page.items[mapping.itemIndex] ?? null;
}
