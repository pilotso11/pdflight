# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pdflight** is a TypeScript browser PDF viewer library with two key capabilities that existing libraries lack:

1. **Smart text search** — handles subscripts, superscripts, hyphenated words, text across columns/layouts, and fragmented text spans that pdf.js splits into separate elements
2. **Precise text highlighting** — highlight overlays that accurately cover the actual rendered text, accounting for different fonts, sizes, line heights, and layout complexities

Built on top of [Mozilla pdf.js](https://github.com/mozilla/pdf.js) (Apache 2.0), bundled as a direct dependency (not a peer dep). The core problem being solved: existing pdf.js-based highlighting solutions position overlays using the text layer DOM, but the text layer coordinates frequently don't align precisely with the canvas-rendered glyphs. pdflight solves this by computing highlight geometry from the actual glyph positions reported by pdf.js's text content API, not from DOM element bounding boxes.

**Target audience**: built for the author's own applications first, intended for open-source npm publication for the community.

**Target documents**: business documents (contracts, reports, invoices) — primarily single-column, standard fonts, tables. Not optimized for scanned/OCR PDFs or complex scientific notation.

## Toolchain

- **Runtime & package manager**: [Bun](https://bun.sh/) — used for installing dependencies, running scripts, and building
- **Language**: TypeScript (source in `src/`), compiled to JavaScript for distribution
- **Build**: `bun build` for library output (ESM-only JS in `dist/`)
- **Unit tests**: Vitest (with `@vitest/coverage-v8` for coverage reporting)
- **Browser E2E tests**: Playwright — tests run against the demo app in a real browser
- **Linting**: ESLint with TypeScript parser
- **Type checking**: `tsc --noEmit`

## Build Commands

```bash
bun install                # Install dependencies
bun run build              # Build the library (TypeScript → dist/)
bun run dev                # Start dev server with demo app
bun run test               # Run unit tests with Vitest
bun run test:coverage      # Run unit tests with coverage report (target: 90%+)
bun run test:ui            # Run tests with Vitest UI
bunx vitest run src/path/to/file.test.ts   # Run a single unit test file
bunx vitest -t "test name pattern"         # Run unit tests matching a pattern
bun run test:e2e           # Run Playwright browser tests against demo app
bunx playwright test tests/e2e/specific.spec.ts  # Run a single E2E test file
bun run lint               # ESLint check
bun run lint:fix           # ESLint auto-fix
bun run typecheck          # TypeScript type checking without emit
```

## Architecture

### Core Layers

```
┌─────────────────────────────────────────┐
│           Public API (PdfViewer)         │  ← Consumer-facing: mount, search, highlight
├─────────────────────────────────────────┤
│         Viewer Chrome (optional)        │  ← Sidebar (thumbnails), page stepper — feature toggles
├─────────────────────────────────────────┤
│         Highlight Engine                │  ← Computes precise overlay geometry + tooltip
├─────────────────────────────────────────┤
│         Search Engine                   │  ← Case-insensitive normalized text matching
├─────────────────────────────────────────┤
│         Text Index                      │  ← Normalized text + position mapping per page
├─────────────────────────────────────────┤
│         Page Renderer                   │  ← Lazy rendering (visible pages + buffer)
├─────────────────────────────────────────┤
│         pdf.js (pdfjs-dist)             │  ← PDF parsing, canvas rendering, text content
└─────────────────────────────────────────┘
```

### Key Design Decisions

- **Library, not application** — pdflight is distributed as an ESM-only npm package. The demo app is for development, testing, and showcasing features.
- **Framework-agnostic** — vanilla TypeScript with no React/Vue/Angular dependency. Consumers pass a container DOM element.
- **Bundled pdf.js** — `pdfjs-dist` is a direct dependency, not a peer dep. Simpler for consumers.
- **pdf.js text content API over DOM measurement** — `page.getTextContent()` returns glyph-level position data (x, y, width, height, transform). Highlight rectangles are computed from this data, not from measuring `<span>` elements in the text layer. This is the core innovation that makes highlights accurate.
- **Normalized text index** — on each page, all text items from `getTextContent()` are concatenated into a single normalized string with a parallel array mapping each character back to its source item and position. This enables searching across pdf.js's arbitrary text fragmentation boundaries.
- **Highlights are a data layer** — highlights are stored as serializable data (page, character ranges) and rendered as absolutely-positioned `<div>` elements in a highlight layer between the canvas and text layer. They survive zoom/pan/resize by recomputing positions from the original text content data. Consumer is responsible for persistence (serialize/deserialize API provided).
- **Lazy page rendering** — only visible pages plus a buffer are rendered. Designed to handle PDFs up to a few hundred pages without performance issues.
- **Feature toggles for chrome** — sidebar (page thumbnails), page stepper, zoom controls are all opt-in via configuration. When enabled, they work automatically with callbacks for consumer integration.

### Source Structure

```
src/
  index.ts              # Public API exports
  viewer/
    PdfViewer.ts        # Main viewer class: mount, navigation, zoom/pan
    PageRenderer.ts     # Per-page canvas + text layer + highlight layer rendering
    Sidebar.ts          # Optional thumbnail sidebar (feature toggle)
    PageStepper.ts      # Optional page navigation controls (feature toggle)
  search/
    TextIndex.ts        # Builds normalized text + character position map per page
    SearchEngine.ts     # Case-insensitive normalized search across the text index
  highlight/
    HighlightEngine.ts  # Computes highlight rectangles from character ranges
    HighlightLayer.ts   # DOM management for highlight overlay divs + tooltips
    types.ts            # Highlight data types (serializable)
  utils/
    geometry.ts         # Rectangle merging, transform math
    text.ts             # Unicode normalization, whitespace handling
demo/
  index.html            # Demo app entry point
  app.ts                # Demo app logic — exercises ALL library features
  style.css             # Demo app styles
tests/
  unit/                 # Vitest unit tests (mirror src/ structure)
    search/             # TextIndex, SearchEngine tests
    highlight/          # HighlightEngine tests
    utils/              # geometry, text utility tests
  e2e/                  # Playwright browser tests against the demo app
    search.spec.ts      # Search features in real browser
    highlight.spec.ts   # Highlight rendering, tooltips, overlap
    navigation.spec.ts  # Zoom, pan, scroll, page jump, fit modes
    sidebar.spec.ts     # Thumbnail sidebar
    stepper.spec.ts     # Page stepper controls
  fixtures/             # Sample PDF files provided by author for automated testing
```

### How Smart Search Works

1. `TextIndex` calls `page.getTextContent()` and concatenates all `items[].str` values into one string per page
2. Each character in the concatenated string maps back to `(itemIndex, charOffset)` with the item's transform/position data
3. Before concatenation, normalization handles: collapsing whitespace, rejoining hyphenated line breaks, detecting super/subscript via y-offset differences
4. `SearchEngine` does **case-insensitive** substring matching on the normalized string, then maps match ranges back to the original text items
5. Cross-item matches (text split across pdf.js items) work naturally because the index is a flat string
6. The API returns an array of match objects (page, position, text). The consumer decides how to present/navigate them — no built-in search UI or scroll-to behavior.

### How Precise Highlighting Works

1. A highlight is defined as `{ page: number, startChar: number, endChar: number }` in the normalized text index
2. `HighlightEngine` maps this character range back to text content items using the index
3. For each involved text item, it computes a rectangle using the item's `transform` matrix, `width`, and `height` from pdf.js
4. For partial items (highlight starts/ends mid-item), character-level x-offsets are estimated using font metrics
5. Adjacent rectangles on the same line are merged; the result is a set of `DOMRect`-like objects
6. `HighlightLayer` renders these as absolutely-positioned divs, z-indexed between canvas and text layer
7. On viewport changes (zoom/pan/resize), rectangles are recomputed from the source data — no DOM measurement needed

### Highlight Behavior

- **Visual style**: semi-transparent colored overlay (like a highlighter pen). Consumer controls color and opacity per highlight.
- **Tooltip on hover**: when the user hovers over a highlight, a tooltip is shown. Consumer provides tooltip content via a callback.
- **Overlapping highlights**: stack with CSS blending — multiple highlights on the same text visually combine. Each retains its own ID.
- **Persistence**: consumer's responsibility. Library provides `serializeHighlights()` / `deserializeHighlights()` for JSON export/import.
- **Identifiers**: highlights are identified by caller-provided string IDs, enabling external state management.

### Mouse Text Selection (Phase 2 — not in v1)

In v1, highlights are created only via the programmatic API. Phase 2 adds opt-in mouse-based text selection: user selects text, library emits an event with the selection range, consumer decides whether to create a highlight from it.

## Navigation & Viewer Features

- Zoom (pinch/wheel), scroll (vertical page flow), pan (drag to move)
- `goToPage(n)` for programmatic navigation
- Fit-to-width / fit-to-page modes
- **Optional sidebar**: page thumbnails, enabled via config flag. Clickable for navigation.
- **Optional page stepper**: prev/next page controls, enabled via config flag.
- All optional chrome components emit callbacks for consumer integration.

## Testing Strategy

### Coverage Targets

- **Library code (`src/`)**: 90%+ line coverage via Vitest unit tests
- **Public API**: 100% of exported API methods must have automated test coverage
- **Browser behavior**: Playwright E2E tests verify rendering, interaction, and visual correctness in a real browser

### Test Layers

1. **Unit tests (Vitest)** — fast, no browser needed
   - Search normalization, text index building, character mapping
   - Rectangle geometry (merging, transform math, coordinate conversion)
   - Highlight engine (character range → rectangle computation)
   - Serialization/deserialization round-trips
   - All public API method signatures and return types

2. **E2E tests (Playwright)** — real browser against the demo app
   - Load a PDF and verify it renders
   - Search for text and verify matches are returned
   - Apply highlights and verify overlay DOM elements appear at correct positions
   - Hover highlight and verify tooltip appears
   - Overlapping highlights render with blending
   - Zoom/pan and verify highlights reposition correctly
   - Sidebar thumbnails render and navigate on click
   - Page stepper navigates forward/backward
   - Fit-to-width / fit-to-page modes
   - Highlights survive zoom changes (persist through re-render)

3. **Fixture PDFs in `tests/fixtures/`**: provided by the project author — business documents with tables, standard fonts, multi-layout content

### Demo App (`demo/`)

The demo app is a full-featured test harness, not just a minimal example. It exercises **every** library feature:
- PDF loading (file picker or URL)
- Search bar with results display
- Highlight controls: apply highlight on search results, remove highlights, change colors
- Tooltip demonstration
- Overlapping highlight demonstration
- Zoom/pan controls
- Sidebar toggle
- Page stepper toggle
- Fit mode selector
- Serialize/deserialize highlights (export/import JSON)

The demo app serves double duty: it's the Playwright test target and a showcase for consumers.

## Browser Support

Modern evergreen browsers only: Chrome, Firefox, Safari, Edge. No IE11, no legacy mobile.

## Important Conventions

- All coordinates use pdf.js's coordinate system (origin bottom-left, y-up) until the final DOM rendering step, which converts to CSS coordinates (origin top-left, y-down)
- Text positions are always stored as indices into the normalized text index, never as raw strings — this avoids ambiguity with repeated text
- The public API uses `Promise`-based async for all operations that touch pdf.js (loading, searching, page rendering)
- ESM-only package output — no CJS or UMD builds
- Use `bun` for all package management and script running — not `npm` or `yarn`
