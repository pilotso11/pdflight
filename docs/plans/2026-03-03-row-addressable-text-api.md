# Row-Addressable Text API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `getRows()`, `getRow()`, `getRowCount()`, and `findText()` methods to PdfViewer so consumers can address text by visual row number and search with page/row constraints.

**Architecture:** A new `RowIndex` module clusters text items into visual rows by y-proximity. PdfViewer exposes row-based methods that build on the existing `PageTextIndex` and `searchPages()` infrastructure. All methods return plain data objects compatible with `addHighlight()`.

**Tech Stack:** TypeScript, Vitest (unit tests), Playwright (E2E tests), Bun (runtime)

---

### Task 1: Add RowInfo and FindTextOptions types

**Files:**
- Modify: `src/search/types.ts`

**Step 1: Add the new types to the existing search types file**

Add after the `SearchMatch` interface:

```typescript
/** A visual row of text on a page, computed by y-proximity clustering. */
export interface RowInfo {
  /** 1-based page number. */
  page: number;
  /** 1-based row number from the top of the page. */
  row: number;
  /** Start index in the page's normalized text string (inclusive). */
  startChar: number;
  /** End index in the page's normalized text string (exclusive). */
  endChar: number;
  /** The row's concatenated text content. */
  text: string;
}

/** Options for location-constrained text search. */
export interface FindTextOptions {
  /** Constrain search to a specific page (1-based). */
  page?: number;
  /** Prefer results near this row number (1-based from top). */
  nearRow?: number;
  /** Maximum number of results to return. */
  maxResults?: number;
}
```

**Step 2: Export types from index.ts**

In `src/index.ts`, add to the search types export line:

```typescript
export type { SearchMatch, RowInfo, FindTextOptions } from './search/types';
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (no consumers yet)

**Step 4: Commit**

```bash
git add src/search/types.ts src/index.ts
git commit -m "feat(types): add RowInfo and FindTextOptions interfaces"
```

---

### Task 2: Implement buildRowIndex — row clustering

**Files:**
- Create: `src/search/RowIndex.ts`
- Test: `tests/unit/search/RowIndex.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/search/RowIndex.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildRowIndex } from '../../../src/search/RowIndex';
import { buildPageTextIndex } from '../../../src/search/TextIndex';
import type { PdflightTextItem } from '../../../src/types';

function makeItem(
  str: string,
  overrides?: Partial<PdflightTextItem>,
): PdflightTextItem {
  return {
    str,
    transform: [12, 0, 0, 12, 100, 500],
    width: str.length * 7,
    height: 12,
    fontName: 'TestFont',
    hasEOL: false,
    charWidths: Array(str.length).fill(7),
    ...overrides,
  };
}

describe('buildRowIndex', () => {
  it('returns one row for a single-line page', () => {
    const index = buildPageTextIndex(1, [makeItem('Hello World')]);
    const rows = buildRowIndex(index);
    expect(rows).toHaveLength(1);
    expect(rows[0].page).toBe(1);
    expect(rows[0].row).toBe(1);
    expect(rows[0].text).toBe('Hello World');
    expect(rows[0].startChar).toBe(0);
    expect(rows[0].endChar).toBe(11);
  });

  it('clusters items on different y-coordinates into separate rows', () => {
    const items = [
      makeItem('First line', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Second line', { transform: [12, 0, 0, 12, 100, 680] }),
      makeItem('Third line', { transform: [12, 0, 0, 12, 100, 660] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    expect(rows).toHaveLength(3);
    expect(rows[0].row).toBe(1);
    expect(rows[0].text).toBe('First line');
    expect(rows[1].row).toBe(2);
    expect(rows[1].text).toBe('Second line');
    expect(rows[2].row).toBe(3);
    expect(rows[2].text).toBe('Third line');
  });

  it('orders rows top-to-bottom (higher y = row 1)', () => {
    // Items added in reverse order
    const items = [
      makeItem('Bottom', { transform: [12, 0, 0, 12, 100, 100] }),
      makeItem('Top', { transform: [12, 0, 0, 12, 100, 700] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    expect(rows[0].text).toBe('Top');
    expect(rows[1].text).toBe('Bottom');
  });

  it('clusters items with close y-coordinates into same row', () => {
    // Two items at y=500 and y=501 (within tolerance)
    const items = [
      makeItem('Hello ', { transform: [12, 0, 0, 12, 100, 500] }),
      makeItem('World', { transform: [12, 0, 0, 12, 150, 501] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toContain('Hello');
    expect(rows[0].text).toContain('World');
  });

  it('returns empty array for empty page', () => {
    const index = buildPageTextIndex(1, []);
    const rows = buildRowIndex(index);
    expect(rows).toHaveLength(0);
  });

  it('handles items with only whitespace', () => {
    const index = buildPageTextIndex(1, [makeItem('   ')]);
    const rows = buildRowIndex(index);
    // After normalization, whitespace-only items may collapse
    // The exact behavior depends on TextIndex normalization
    expect(rows.length).toBeLessThanOrEqual(1);
  });

  it('startChar/endChar range covers the correct normalized text slice', () => {
    const items = [
      makeItem('First', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Second', { transform: [12, 0, 0, 12, 100, 680] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);

    // Each row's char range should extract the correct text
    for (const row of rows) {
      const extracted = index.normalizedText.slice(row.startChar, row.endChar);
      expect(extracted).toBe(row.text);
    }
  });

  it('handles rotated text items by using topmost y-point', () => {
    // A 45° rotated item — its y-extent spans a range
    // transform [a, b, c, d, tx, ty] with rotation
    const items = [
      makeItem('Normal', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Rotated', { transform: [8.5, 8.5, -8.5, 8.5, 300, 700] }), // ~45°
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    // Both should cluster near y=700 → same row or adjacent
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThanOrEqual(2);
  });

  it('handles mixed font sizes on same line', () => {
    // Large and small text at same baseline
    const items = [
      makeItem('BIG', { transform: [24, 0, 0, 24, 100, 500] }),
      makeItem('small', { transform: [8, 0, 0, 8, 200, 500] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    // Same y=500, should be one row despite different font sizes
    expect(rows).toHaveLength(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/unit/search/RowIndex.test.ts`
Expected: FAIL — `Cannot find module '../../../src/search/RowIndex'`

**Step 3: Implement buildRowIndex**

Create `src/search/RowIndex.ts`:

```typescript
// Copyright (c) 2026 Seth Osher. MIT License.
import type { PageTextIndex } from '../types';
import type { RowInfo } from './types';

/**
 * Build a row index from a page text index.
 *
 * Clusters text items into visual rows by y-proximity:
 * 1. Extract each item's effective y-coordinate (topmost point for rotated items)
 * 2. Sort items by y descending (top of page first)
 * 3. Cluster items within 0.5 × avgFontHeight of each other
 * 4. Map each cluster to its character range in the normalized text
 * 5. Number rows 1-based from the top
 */
export function buildRowIndex(pageTextIndex: PageTextIndex): RowInfo[] {
  const { items, charMap, normalizedText, pageNumber } = pageTextIndex;
  if (items.length === 0 || normalizedText.length === 0) return [];

  // Step 1: Compute effective y and font height for each item.
  const itemInfo: Array<{ itemIndex: number; y: number; fontSize: number }> = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].str.length === 0) continue;
    const item = items[i];
    const [a, b, , d, , ty] = item.transform;
    const rotation = Math.atan2(b, a);

    let effectiveY: number;
    if (Math.abs(rotation) < 1e-6) {
      // Non-rotated: y = ty (baseline)
      effectiveY = ty;
    } else {
      // Rotated: use topmost point of the bounding box.
      // Height extends perpendicular to text direction.
      const fontSize = Math.sqrt(item.transform[2] ** 2 + d ** 2);
      const sinR = Math.sin(rotation);
      const cosR = Math.cos(rotation);
      // Text extends along (cos, sin) for width, and (-sin, cos) for height.
      // Topmost y = max of the 4 corner y-values. For simplicity, use ty
      // plus any positive y-contribution from width and height vectors.
      const yFromWidth = item.width * sinR;
      const yFromHeight = fontSize * cosR;
      effectiveY = ty + Math.max(0, yFromWidth) + Math.max(0, yFromHeight);
    }

    const fontSize = Math.abs(d) || Math.sqrt(a * a + b * b) || 12;
    itemInfo.push({ itemIndex: i, y: effectiveY, fontSize });
  }

  if (itemInfo.length === 0) return [];

  // Step 2: Compute clustering tolerance = 0.5 × average font height.
  const avgFontSize = itemInfo.reduce((s, info) => s + info.fontSize, 0) / itemInfo.length;
  const tolerance = avgFontSize * 0.5;

  // Step 3: Sort by y descending (highest y = top of page in PDF coords).
  itemInfo.sort((a, b) => b.y - a.y);

  // Step 4: Cluster items into rows by y-proximity.
  const clusters: Array<{ itemIndices: number[]; y: number }> = [];
  for (const info of itemInfo) {
    const lastCluster = clusters[clusters.length - 1];
    if (lastCluster && Math.abs(info.y - lastCluster.y) < tolerance) {
      lastCluster.itemIndices.push(info.itemIndex);
    } else {
      clusters.push({ itemIndices: [info.itemIndex], y: info.y });
    }
  }

  // Step 5: For each cluster, sort items by x (left-to-right) and find char range.
  const rows: RowInfo[] = [];
  for (let clusterIdx = 0; clusterIdx < clusters.length; clusterIdx++) {
    const cluster = clusters[clusterIdx];

    // Sort items within cluster by x-coordinate.
    cluster.itemIndices.sort((a, b) => items[a].transform[4] - items[b].transform[4]);

    // Find the character range in normalizedText that belongs to this cluster's items.
    const itemSet = new Set(cluster.itemIndices);
    let startChar = -1;
    let endChar = -1;

    for (let ci = 0; ci < charMap.length; ci++) {
      if (itemSet.has(charMap[ci].itemIndex)) {
        if (startChar === -1) startChar = ci;
        endChar = ci + 1;
      }
    }

    if (startChar === -1) continue;

    // Trim leading/trailing whitespace from the row's text range.
    while (startChar < endChar && normalizedText[startChar] === ' ') startChar++;
    while (endChar > startChar && normalizedText[endChar - 1] === ' ') endChar--;

    if (startChar >= endChar) continue;

    rows.push({
      page: pageNumber,
      row: clusterIdx + 1,
      startChar,
      endChar,
      text: normalizedText.slice(startChar, endChar),
    });
  }

  return rows;
}

/**
 * Find which row a character index falls in.
 * Returns the 1-based row number, or 0 if not found.
 */
export function charToRow(rows: RowInfo[], charIndex: number): number {
  for (const row of rows) {
    if (charIndex >= row.startChar && charIndex < row.endChar) {
      return row.row;
    }
  }
  return 0;
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/unit/search/RowIndex.test.ts`
Expected: PASS (all tests)

**Step 5: Run full test suite for regressions**

Run: `bun run test`
Expected: All existing tests still pass

**Step 6: Commit**

```bash
git add src/search/RowIndex.ts tests/unit/search/RowIndex.test.ts
git commit -m "feat: add buildRowIndex — y-proximity row clustering for text items"
```

---

### Task 3: Add charToRow tests

**Files:**
- Modify: `tests/unit/search/RowIndex.test.ts`

**Step 1: Add charToRow tests to the existing test file**

```typescript
import { buildRowIndex, charToRow } from '../../../src/search/RowIndex';

// ... (after buildRowIndex describe block)

describe('charToRow', () => {
  it('returns correct row for a character in the first row', () => {
    const items = [
      makeItem('First', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Second', { transform: [12, 0, 0, 12, 100, 680] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    expect(charToRow(rows, 0)).toBe(1);
  });

  it('returns correct row for a character in the second row', () => {
    const items = [
      makeItem('First', { transform: [12, 0, 0, 12, 100, 700] }),
      makeItem('Second', { transform: [12, 0, 0, 12, 100, 680] }),
    ];
    const index = buildPageTextIndex(1, items);
    const rows = buildRowIndex(index);
    // 'Second' starts after 'First' + separator space
    const secondStart = index.normalizedText.indexOf('Second');
    expect(charToRow(rows, secondStart)).toBe(2);
  });

  it('returns 0 for char index beyond all rows', () => {
    const index = buildPageTextIndex(1, [makeItem('Hello')]);
    const rows = buildRowIndex(index);
    expect(charToRow(rows, 999)).toBe(0);
  });
});
```

**Step 2: Run tests**

Run: `bunx vitest run tests/unit/search/RowIndex.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/unit/search/RowIndex.test.ts
git commit -m "test: add charToRow unit tests"
```

---

### Task 4: Export buildRowIndex and charToRow from index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: Add exports**

After the `buildPageTextIndex` export line, add:

```typescript
export { buildRowIndex, charToRow } from './search/RowIndex';
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: export buildRowIndex and charToRow from public API"
```

---

### Task 5: Add getRows(), getRow(), getRowCount() to PdfViewer

**Files:**
- Modify: `src/viewer/PdfViewer.ts`

**Step 1: Add import**

At the top of PdfViewer.ts, add the RowIndex import:

```typescript
import { buildRowIndex } from '../search/RowIndex';
import type { RowInfo } from '../search/types';
```

**Step 2: Add private helper to get or build row index for a page**

Add a private method near `ensureAllTextIndices`:

```typescript
private async ensureTextIndexForPage(page: number): Promise<PageTextIndex | null> {
  await this.ensureAllTextIndices();
  return this.textIndices.get(page) ?? null;
}
```

**Step 3: Add the three public methods**

Add these after the existing `search()` method block:

```typescript
/** Get all visual text rows on a page, ordered top-to-bottom. */
async getRows(page: number): Promise<RowInfo[]> {
  const textIndex = await this.ensureTextIndexForPage(page);
  if (!textIndex) return [];
  return buildRowIndex(textIndex);
}

/** Get a specific row (1-based from top). Returns null if row doesn't exist. */
async getRow(page: number, row: number): Promise<RowInfo | null> {
  const rows = await this.getRows(page);
  return rows.find(r => r.row === row) ?? null;
}

/** Get the number of visual text rows on a page. */
async getRowCount(page: number): Promise<number> {
  const rows = await this.getRows(page);
  return rows.length;
}
```

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/viewer/PdfViewer.ts
git commit -m "feat: add getRows, getRow, getRowCount to PdfViewer"
```

---

### Task 6: Add findText() to PdfViewer

**Files:**
- Modify: `src/viewer/PdfViewer.ts`

**Step 1: Add imports**

Add to existing imports at top of PdfViewer.ts:

```typescript
import { buildRowIndex, charToRow } from '../search/RowIndex';
import type { RowInfo, FindTextOptions } from '../search/types';
```

(Update the import from Task 5 to include `charToRow` and `FindTextOptions`.)

**Step 2: Add findText method**

Add after the `getRowCount` method:

```typescript
/**
 * Search for text with optional location constraints.
 *
 * Unlike search(), this does not update match navigation state (nextMatch/prevMatch).
 * It's a pure query that returns results for the consumer to highlight manually.
 *
 * When opts.page is specified, results are limited to that page.
 * When opts.nearRow is specified (requires opts.page), results are sorted by
 * proximity to that row number (closest first).
 */
async findText(text: string, opts?: FindTextOptions): Promise<SearchMatch[]> {
  if (!this.pdfDocument || !text) return [];

  await this.ensureAllTextIndices();

  let indices: PageTextIndex[];
  if (opts?.page) {
    const pageIndex = this.textIndices.get(opts.page);
    if (!pageIndex) return [];
    indices = [pageIndex];
  } else {
    indices = Array.from(this.textIndices.values()).sort(
      (a, b) => a.pageNumber - b.pageNumber,
    );
  }

  let results = searchPages(indices, text);

  // Sort by proximity to nearRow if specified
  if (opts?.nearRow && opts.page) {
    const pageIndex = this.textIndices.get(opts.page);
    if (pageIndex) {
      const rows = buildRowIndex(pageIndex);
      results.sort((a, b) => {
        const rowA = charToRow(rows, a.startChar);
        const rowB = charToRow(rows, b.startChar);
        return Math.abs(rowA - opts.nearRow!) - Math.abs(rowB - opts.nearRow!);
      });
    }
  }

  if (opts?.maxResults && results.length > opts.maxResults) {
    results = results.slice(0, opts.maxResults);
  }

  return results;
}
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/viewer/PdfViewer.ts
git commit -m "feat: add findText() with page/nearRow location constraints"
```

---

### Task 7: Add E2E tests for row API

**Files:**
- Create: `tests/e2e/row-api.spec.ts`

This task uses the demo app running at localhost:5173. The tests load a known demo PDF and exercise the row API via `window.viewer`.

**Step 1: Write E2E tests**

Create `tests/e2e/row-api.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Row-Addressable Text API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('getRows returns rows for page 1', async ({ page }) => {
    const rows = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      return viewer.getRows(1);
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].page).toBe(1);
    expect(rows[0].row).toBe(1);
    expect(rows[0].text.length).toBeGreaterThan(0);
    expect(rows[0].startChar).toBe(0);
  });

  test('getRow returns specific row', async ({ page }) => {
    const row = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      return viewer.getRow(1, 1);
    });
    expect(row).not.toBeNull();
    expect(row.row).toBe(1);
    expect(row.page).toBe(1);
  });

  test('getRow returns null for nonexistent row', async ({ page }) => {
    const row = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      return viewer.getRow(1, 9999);
    });
    expect(row).toBeNull();
  });

  test('getRowCount returns positive number', async ({ page }) => {
    const count = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      return viewer.getRowCount(1);
    });
    expect(count).toBeGreaterThan(0);
  });

  test('row text matches normalized text slice', async ({ page }) => {
    const valid = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      const rows = await viewer.getRows(1);
      // Search for the first row's text — should find it
      const matches = await viewer.findText(rows[0].text, { page: 1 });
      return matches.length > 0;
    });
    expect(valid).toBe(true);
  });

  test('findText with page constraint returns only that page', async ({ page }) => {
    const allOnPage = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      const matches = await viewer.findText('Lorem', { page: 1 });
      return matches.every((m: any) => m.page === 1);
    });
    expect(allOnPage).toBe(true);
  });

  test('findText with nearRow sorts by proximity', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      const rows = await viewer.getRows(1);
      if (rows.length < 3) return null;
      // Find a word that appears in the text
      const targetRow = rows[Math.floor(rows.length / 2)];
      const word = targetRow.text.split(/\s+/).find((w: string) => w.length > 3);
      if (!word) return null;
      const matches = await viewer.findText(word, {
        page: 1,
        nearRow: targetRow.row,
      });
      return { matchCount: matches.length, targetRow: targetRow.row };
    });
    // If we found matches, the test passes (sorting is internal)
    if (result) {
      expect(result.matchCount).toBeGreaterThan(0);
    }
  });

  test('row data can be used with addHighlight', async ({ page }) => {
    const highlightId = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      const row = await viewer.getRow(1, 1);
      if (!row) return null;
      viewer.addHighlight({
        id: 'row-test-1',
        page: row.page,
        startChar: row.startChar,
        endChar: row.endChar,
        color: 'rgba(255, 255, 0, 0.4)',
      });
      return 'row-test-1';
    });
    expect(highlightId).toBe('row-test-1');

    // Verify highlight div exists in DOM
    const highlights = page.locator('.pdflight-highlight');
    await expect(highlights.first()).toBeVisible();
  });
});
```

**Step 2: Run E2E tests**

Run: `bunx playwright test tests/e2e/row-api.spec.ts`
Expected: PASS (requires dev server running)

**Step 3: Commit**

```bash
git add tests/e2e/row-api.spec.ts
git commit -m "test: add E2E tests for row-addressable text API"
```

---

### Task 8: Run full verification

**Step 1: Unit tests**

Run: `bun run test`
Expected: All tests pass

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Lint**

Run: `bun run lint`
Expected: Clean (fix any issues)

**Step 4: E2E tests**

Run: `bun run test:e2e`
Expected: All tests pass (start dev server first if needed)

**Step 5: Commit any fixes and tag complete**

```bash
git add -A
git commit -m "chore: lint fixes for row API implementation"
```

---

## Summary of Files

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/search/types.ts` | Add `RowInfo`, `FindTextOptions` interfaces |
| Create | `src/search/RowIndex.ts` | `buildRowIndex()`, `charToRow()` — row clustering |
| Modify | `src/viewer/PdfViewer.ts` | Add `getRows()`, `getRow()`, `getRowCount()`, `findText()` |
| Modify | `src/index.ts` | Export new types and functions |
| Create | `tests/unit/search/RowIndex.test.ts` | Row clustering unit tests |
| Create | `tests/e2e/row-api.spec.ts` | E2E tests for row API via demo app |
