import type { PageTextIndex } from '../types';
import type { SearchMatch } from './types';

/**
 * Search across all page text indices for a query string.
 * Case-insensitive substring matching on the normalized text.
 * Returns matches ordered by page, then by position within page.
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

  return results;
}
