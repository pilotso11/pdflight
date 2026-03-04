# Row-Addressable Text API — Design

## Problem

pdflight's highlight system requires character indices (`startChar`/`endChar`) into the normalized text index. External systems — particularly LLM fact-extraction pipelines — return results like "this fact came from page 3, line 5". There's no way to bridge "page N, line M" to character-index-based highlights without the consumer reimplementing row detection.

## Use Cases

1. **LLM fact extraction**: LLM returns `{ text: "Invoice total", page: 3, line: 5 }`. Viewer should navigate to and highlight that text.
2. **Row-level highlighting**: Highlight entire row 5 on page 3 (e.g. for debugging or visual annotation).
3. **Server-side search**: External search engine (Elasticsearch, etc.) returns page + text. Constrain results by page and proximity to a row.

## Design

### New Types

```typescript
/** A visual row of text on a page. */
interface RowInfo {
  page: number;       // 1-based page number
  row: number;        // 1-based row number (from top of page)
  startChar: number;  // Start index in normalized text
  endChar: number;    // End index in normalized text
  text: string;       // The row's concatenated text content
  y: number;          // Y-coordinate in PDF space (higher = higher on page)
}

/** Options for findText() location-constrained search. */
interface FindTextOptions {
  page?: number;       // Constrain to specific page
  nearRow?: number;    // Prefer results near this row (1-based); requires page
  maxResults?: number; // Limit results (default: all)
  maxDistance?: number; // Max y-distance in PDF units (default: 5 × avgLineSpacing)
}
```

### New PdfViewer Methods

```typescript
/** Get all rows on a page, ordered top-to-bottom. */
async getRows(page: number): Promise<RowInfo[]>

/** Get a specific row (1-based from top). Returns null if row doesn't exist. */
async getRow(page: number, row: number): Promise<RowInfo | null>

/** Get the number of visual text rows on a page. */
async getRowCount(page: number): Promise<number>

/** Search with optional location constraints. Returns matches sorted by relevance to hints. */
async findText(text: string, opts?: FindTextOptions): Promise<SearchMatch[]>
```

### Row Clustering Algorithm

PDFs have no native line concept. Text items are positioned at arbitrary y-coordinates. The row index clusters items into visual rows:

1. Collect all text items on the page with their y-coordinates (from transform matrix `ty` component).
2. Sort by y descending (top of page first in visual order — PDF y-up means higher y = higher on page).
3. Cluster items whose y-coordinates are within `0.5 × average font height` of each other into the same row.
4. Within each row, sort items by x ascending (left to right).
5. Number rows 1-based from the top.

For rotated text items: use the topmost point of the item's bounding box for y-clustering, so a 45° word still groups with the row nearest its visual top.

### findText() with nearRow

`nearRow` requires `page` — returns `[]` if page is omitted. Returns `[]` if the target row doesn't exist on the page.

When `nearRow` is specified:

1. Run normal text search constrained to the specified page (reuse existing `searchPages()`).
2. Build the row index and look up the target row's y-coordinate.
3. Compute `maxDistance`: explicit value from options, or default `5 × avgLineSpacing`.
4. Filter results: keep only matches whose row y-coordinate is within `maxDistance` of the target row's y.
5. Sort remaining results by y-distance from target row (closest first).
6. Multi-row text spans work naturally — `startChar`/`endChar` from the existing search already cover the full character range regardless of row boundaries. The match's row is determined by `startChar`.

#### Why y-distance instead of row-number distance

PDFs with embedded images or charts can have large vertical gaps between consecutive row numbers. For example, row 13 and row 14 might be sequentially numbered but separated by a 250-unit image — far larger than the ~13-unit normal line spacing. Filtering by row number would incorrectly treat these as "adjacent". Y-coordinate distance captures the actual visual proximity.

#### avgLineSpacing

`avgLineSpacing(rows)` computes the mean vertical gap between adjacent rows, **excluding outlier gaps** (>4× the running average). This prevents large image/chart gaps from inflating the spacing estimate. The default `maxDistance = 5 × avgLineSpacing` gives a window of roughly ±5 normal text rows.

When only `page` is specified (no `nearRow`): filter existing search results to that page, preserve visual-order sorting.

### Usage Examples

```typescript
// LLM says: "Invoice total on page 3, line 5"
const matches = await viewer.findText('Invoice total', {
  page: 3,
  nearRow: 5,
});
viewer.addHighlight({
  id: 'llm-fact-1',
  ...matches[0],
  color: 'rgba(255, 255, 0, 0.4)',
});

// Highlight entire row 5 on page 3
const row = await viewer.getRow(3, 5);
if (row) {
  viewer.addHighlight({
    id: 'row-hl',
    page: row.page,
    startChar: row.startChar,
    endChar: row.endChar,
    color: 'rgba(0, 200, 255, 0.3)',
  });
}

// Get all rows for display in a sidebar or debug view
const rows = await viewer.getRows(1);
// rows[0] = { page: 1, row: 1, startChar: 0, endChar: 7, text: "INVOICE" }
// rows[1] = { page: 1, row: 2, startChar: 8, endChar: 28, text: "Company Name LLC" }

// Row count for validation
const count = await viewer.getRowCount(3);
if (lineNumber <= count) { ... }
```

### API Consistency

All new methods return plain data objects. `RowInfo` has `page`, `startChar`, `endChar` — the same shape as `SearchMatch` — so it spreads directly into `addHighlight()`. No method-bearing objects. This is consistent with the existing `search()` → `addHighlights()` data flow.

Row numbering is 1-based (consistent with page numbering in the existing API).

## Implementation Plan

### New Files

- `src/search/RowIndex.ts` — `buildRowIndex()`, `charToRow()`, `avgLineSpacing()`
- `tests/unit/search/RowIndex.test.ts` — unit tests for row clustering, charToRow, avgLineSpacing
- `tests/e2e/row-api.spec.ts` — 16 E2E tests: core API, y-distance filtering, cross-row search, edge cases

### Modified Files

- `src/viewer/PdfViewer.ts` — add `getRows()`, `getRow()`, `getRowCount()`, `findText()` methods
- `src/index.ts` — export `RowInfo`, `FindTextOptions`, `buildRowIndex`, `charToRow`, `avgLineSpacing`
- `src/search/types.ts` — add `RowInfo` (with `y`), `FindTextOptions` (with `maxDistance`)
- `demo/index.html` — Row API control section
- `demo/app.ts` — Row API event handlers
- `README.md` — Row-Addressable Text documentation section

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Row definition | Y-proximity clustering | Business documents have consistent line spacing; half-font-height tolerance handles mixed sizes |
| Row numbering | 1-based from top | Matches how humans and LLMs count lines; consistent with page numbering |
| API style | Data-oriented (plain objects) | Consistent with existing search() → addHighlight() pattern |
| findText nearRow | Filter + sort by y-distance | Row numbers are sequential but visual distance varies (images, charts). Y-coordinate distance captures actual proximity |
| Default maxDistance | 5 × avgLineSpacing | Roughly ±5 rows of text; avgLineSpacing excludes outlier gaps so images don't inflate the window |
| Nonexistent nearRow | Return empty `[]` | No valid anchor point — returning all results unfiltered would be surprising |
| nearRow without page | Return empty `[]` | Can't build a row index without a page; fail explicitly rather than silently ignoring |
| RowInfo.y | Exposed in public type | Useful for debugging and advanced consumers; flows naturally from clustering |
| Rotated text row assignment | By topmost bounding point | A 45° word should group with the visual row it appears in |
| Navigation | Not built-in | Consumer calls goToPage() and scrolls as needed; keeps methods pure data |
