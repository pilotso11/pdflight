# pdflight Design Document

**Date**: 2025-02-25
**Status**: Approved

## Problem

Existing pdf.js-based highlighting libraries position highlight overlays using the text layer DOM (`<span>` bounding boxes), but these coordinates don't align precisely with the canvas-rendered glyphs. The result: highlights that never quite cover the actual text.

## Solution

pdflight computes highlight geometry from pdf.js's text content API (`page.getTextContent()`) — the same glyph position data used for canvas rendering — combined with per-character width lookups from pdf.js's font objects. This produces pixel-accurate highlight rectangles.

## Target

Business documents (contracts, reports, invoices). Single-column and multi-column layouts, standard fonts, tables. Not optimized for scanned/OCR PDFs or complex scientific notation.

## Toolchain

- **Runtime & package manager**: Bun
- **Build**: Vite library mode (ESM-only JS + `.d.ts` via `vite-plugin-dts`)
- **Dev server**: Vite (for demo app)
- **Unit tests**: Vitest + `@vitest/coverage-v8`
- **E2E tests**: Playwright (against demo app)
- **Linting**: ESLint + `@typescript-eslint`
- **Type checking**: `tsc --noEmit`

## Core Data Model

### TextIndex (per page)

```typescript
interface FontMetrics {
  widths: Map<number, number>;  // charCode -> width in 1/1000 em units
  defaultWidth: number;
}

interface TextItem {
  str: string;
  transform: number[];      // [a, b, c, d, e, f] affine transform
  width: number;            // Total width in PDF units
  height: number;           // Height (~ font size) in PDF units
  fontName: string;
  hasEOL: boolean;
  charWidths: number[];     // Per-character width in PDF units (from font metrics)
}

interface CharMapping {
  itemIndex: number;
  charOffset: number;
  item: TextItem;
}

interface PageTextIndex {
  pageNumber: number;
  normalizedText: string;
  charMap: CharMapping[];
  items: TextItem[];
}
```

### Normalization rules

1. Collapse multiple whitespace/newlines to single space
2. Rejoin hyphenated line breaks: `"exam-\nple"` -> `"example"`
3. Unicode NFC normalization, smart quotes -> ASCII quotes
4. Superscript/subscript: space boundary when y-offset differs >50% of line height

### SearchMatch

```typescript
interface SearchMatch {
  page: number;
  startChar: number;
  endChar: number;        // exclusive
  text: string;
}
```

### Highlight

```typescript
interface Highlight {
  id: string;             // Caller-provided unique ID
  page: number;
  startChar: number;
  endChar: number;        // exclusive
  color: string;          // CSS color
}

interface HighlightRect {
  x: number;              // CSS pixels, relative to page container
  y: number;
  width: number;
  height: number;
}
```

## Public API

Single `PdfViewer` class. All pdf.js-touching methods are async.

```typescript
// Lifecycle
new PdfViewer(container: HTMLElement, options?: PdfViewerOptions)
viewer.load(source: string | ArrayBuffer | Uint8Array): Promise<void>
viewer.destroy(): void

// Navigation
viewer.goToPage(page: number): void
viewer.getCurrentPage(): number
viewer.getPageCount(): number
viewer.setZoom(scale: number): void
viewer.getZoom(): number
viewer.setFitMode(mode: 'width' | 'page' | 'none'): void

// Search
viewer.search(query: string): Promise<SearchMatch[]>

// Highlights
viewer.addHighlight(highlight: Highlight): void
viewer.addHighlights(highlights: Highlight[]): void
viewer.removeHighlight(id: string): void
viewer.removeAllHighlights(): void
viewer.getHighlights(): Highlight[]
viewer.serializeHighlights(): string
viewer.deserializeHighlights(json: string): void

// Events
viewer.on(event, handler): void
viewer.off(event, handler): void
// Events: 'pagechange', 'zoomchange', 'highlighthover', 'highlightclick'
```

### PdfViewerOptions

```typescript
interface PdfViewerOptions {
  initialPage?: number;            // Default: 1
  initialZoom?: number;            // Default: 1.0
  fitMode?: 'width' | 'page' | 'none';  // Default: 'width'
  sidebar?: boolean;               // Default: false
  pageStepper?: boolean;           // Default: false
  tooltipContent?: (highlight: Highlight) => string | HTMLElement;
  pageBufferSize?: number;         // Default: 2
  onPageChange?: (page: number) => void;
  onZoomChange?: (scale: number) => void;
}
```

## Page Rendering & DOM Structure

Per-page DOM:

```
div.pdflight-page-container
  canvas.pdflight-canvas              (pdf.js renders here)
  div.pdflight-highlight-layer        (highlight overlays)
    div.pdflight-highlight            (per highlight rect)
    div.pdflight-tooltip              (on hover)
  div.pdflight-text-layer             (pdf.js text layer, transparent, for selection)
```

Z-order (bottom to top): canvas -> highlights -> text layer.

### Lazy rendering

`IntersectionObserver` renders only visible pages + buffer (`pageBufferSize`). Canvas discarded when page scrolls out of buffer. TextIndex retained (lightweight).

### Zoom/Pan

- Zoom: CSS `transform: scale()` then re-render canvas at new resolution
- Pan: CSS `transform: translate()` on scroll container
- Viewport changes trigger highlight position recomputation from source data

## Highlight Behavior

- **Visual**: semi-transparent overlay, consumer controls color/opacity per highlight
- **Overlap**: stack with CSS mix-blend-mode, each retains its own ID
- **Tooltip**: shown on hover, consumer provides content via `tooltipContent` callback
- **Persistence**: consumer's responsibility; `serializeHighlights()`/`deserializeHighlights()` for JSON round-trips
- **Font-metrics precision**: per-character widths from pdf.js font objects for accurate partial-item highlight positioning

## Precise Highlighting Flow

1. Highlight defined as `{ page, startChar, endChar }` in normalized text index
2. HighlightEngine maps char range back to TextItems via charMap
3. For each involved TextItem, compute rect from `transform`, `width`, `height`
4. For partial items: use `charWidths[]` to compute exact x-offset and sub-width
5. Adjacent same-line rects merged
6. HighlightLayer renders as positioned divs between canvas and text layer
7. On viewport change: recompute from source data (no DOM measurement)

## Demo App

Full-featured test harness exercising every library feature. Serves as Playwright test target.

Controls: file picker, search bar, highlight buttons (apply/remove/color), tooltip demo, overlap demo, zoom/pan controls, sidebar toggle, page stepper toggle, fit mode selector, serialize export/import.

All controls have `data-testid` attributes for Playwright.

## Testing Strategy

### Unit tests (Vitest)

- TextIndex: normalization, charMap construction, font metrics loading
- SearchEngine: case-insensitive matching, cross-item matches, edge cases
- HighlightEngine: rect computation, partial items with charWidths, merging
- Geometry utils: rectangle math, transform conversion, PDF->CSS coordinates
- Text utils: unicode normalization, hyphen rejoining, whitespace collapse
- Serialization round-trips

Coverage target: 90%+ lines, 100% of public API methods.

### E2E tests (Playwright)

- Load PDF, verify rendering
- Search, verify match count
- Apply highlights, verify overlay DOM at correct positions
- Hover highlight, verify tooltip
- Overlapping highlights with blending
- Zoom/pan, verify highlight repositioning
- Sidebar thumbnails, click navigation
- Page stepper navigation
- Fit modes
- Serialize/deserialize round-trip

### Fixture PDFs

Provided by project author in `tests/fixtures/`. Business documents with tables, standard fonts.

## Phase 2 (not in v1)

Mouse-based text selection for creating highlights. User selects text, library emits event with selection range, consumer decides whether to create a highlight.
