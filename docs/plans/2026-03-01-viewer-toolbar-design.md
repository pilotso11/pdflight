# Built-in Viewer Toolbar, Rotation & Landscape Support

**Goal:** Replace external demo controls with a built-in toolbar rendered by the library inside the viewer container. Add page rotation. Support landscape and mixed-orientation PDFs correctly.

**Architecture:** New `ViewerToolbar` class manages DOM for stepper, zoom, fit mode, and rotate controls. Toolbar is created and owned by `PdfViewer` when enabled via config. Rotation state lives in `PdfViewer` and is passed through to `PageRenderer` and `Sidebar`. Fit mode uses current page dimensions instead of first-page-only.

**Tech Stack:** Vanilla TypeScript DOM, CSS with `backdrop-filter` progressive enhancement, pdf.js rotation via `getViewport({ rotation })`.

---

## 1. ViewerToolbar Component

### Layout

```
│ ◀ Prev  Page 1 of 4  Next ▶  │  ↺ ↻  │  − 195% +  │  Fit Width ▼  │
└─ stepper ─────────────────────┴ rotate ┴── zoom ─────┴── fit mode ───┘
```

### API

```typescript
toolbar?: {
  stepper?: boolean;              // default true
  zoom?: boolean;                 // default true
  rotate?: boolean;               // default true
  fit?: boolean;                  // default true
  position?: 'top' | 'bottom';   // default 'bottom'
} | boolean;  // true = all defaults, false = no toolbar
```

### Styling

Frosted glass effect with dark fallback:

```css
.pdflight-toolbar {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.75);
  /* Fallback for browsers without backdrop-filter */
}

@supports not (backdrop-filter: blur(1px)) {
  .pdflight-toolbar {
    background: rgba(30, 30, 30, 0.9);
    color: white;
  }
}
```

- Compact height (~36px)
- Rounded corners, subtle shadow
- Position: sticky top or bottom of viewer container
- Control groups separated by subtle dividers

### File

`src/viewer/ViewerToolbar.ts` — new class.

### Behavior

- Toolbar calls back into `PdfViewer` for all actions (goToPage, setZoom, setFitMode, rotate)
- `PdfViewer` updates toolbar state after actions (current page, zoom level, fit mode, rotation)
- Toolbar updates are synchronous DOM mutations, no framework needed

---

## 2. Rotation

### State

`PdfViewer.currentRotation: number` — 0, 90, 180, or 270 degrees. Persists across page navigation. Resets on new PDF load.

### Public API

```typescript
rotate(degrees: 90 | -90): void;  // relative rotation
getRotation(): number;             // returns 0, 90, 180, 270
```

### Implementation

- `PageRenderer.render()` passes rotation to `pdfPage.getViewport({ scale, rotation })`
- pdf.js handles canvas rotation and text content coordinate adjustment
- Highlight pipeline works unchanged — `getTextContent()` returns transforms in the rotated coordinate space, and `getViewport()` returns the rotated page dimensions

### Impact on fit mode

When rotation is 90 or 270, the page's effective width and height swap. `applyFitMode()` uses the rotated dimensions (which pdf.js provides via the rotated viewport).

### Toolbar controls

Two buttons: counterclockwise (↺) and clockwise (↻). Each adds/subtracts 90, wrapping at 360/0.

---

## 3. Sidebar Changes

- **Remove "Thumbnails" heading** from `demo/index.html` — it's demo-only HTML and self-evident
- **Rotation support** — `Sidebar.render()` and `renderThumbnail()` accept rotation parameter
- When rotation changes, already-rendered thumbnails are invalidated and re-rendered
- Wrapper dimensions adjust for rotated aspect ratio (swap width/height at 90/270)

---

## 4. Fit Mode: Per-Page Dimensions

**Current behavior:** `applyFitMode()` uses cached first-page dimensions for all pages.

**New behavior:** Use the current page's unscaled dimensions. When navigating between pages with different sizes (portrait ↔ landscape), fit mode recomputes zoom automatically.

**Implementation:**
- Cache per-page unscaled dimensions in a `Map<number, { width, height }>` (populated lazily)
- `applyFitMode()` reads from this map using `currentPage`
- `goToPage()` triggers `applyFitMode()` after render if fit mode is active

---

## 5. Test Fixtures

### Mixed-orientation PDF

Create programmatically (script in `tests/fixtures/`):
- Page 1: Portrait (595 × 842 pt) with text — "Portrait page with sample text"
- Page 2: Landscape (842 × 595 pt) with text — "Landscape page with sample text"
- Page 3: Portrait (595 × 842 pt) with text — "Another portrait page"

This tests:
- Fit mode recomputation across page navigation
- Sidebar thumbnails with mixed aspect ratios
- Search + highlights across different orientations
- Rotation applied to mixed pages

---

## 6. Demo App Changes

### Move into library toolbar
- Page stepper (prev/next/page info)
- Zoom controls (−/+/level)
- Fit mode selector
- Rotate controls (new)

### Keep in demo header
- File loading (Open PDF, demo dropdown)
- Search (input, button, results)
- Sidebar toggle checkbox

### Keep in demo footer
- Highlight controls (highlight all, clear, color picker)
- Serialize (export/import JSON)

### Demo toolbar wiring
- Remove external stepper/zoom/fit HTML from demo
- Initialize viewer with `toolbar: true` (or with feature mask)
- Sidebar toggle still external (it controls layout, not viewer chrome)

---

## 7. E2E Tests

### Toolbar tests (`tests/e2e/toolbar.spec.ts`)
- Toolbar renders when enabled
- Stepper shows correct page info and navigates
- Zoom buttons change zoom level
- Fit mode dropdown switches modes
- Rotate buttons rotate the page
- Toolbar position (top/bottom) works
- Individual feature masks hide/show control groups

### Rotation tests (`tests/e2e/rotation.spec.ts`)
- Rotate clockwise cycles 0 → 90 → 180 → 270 → 0
- Rotate counterclockwise cycles in reverse
- Page dimensions change after rotation (width/height swap at 90/270)
- Highlights render correctly on rotated pages
- Fit mode recomputes after rotation
- Sidebar thumbnails update after rotation

### Landscape/mixed tests (`tests/e2e/landscape.spec.ts`)
- Landscape page renders with correct aspect ratio
- Fit-width on landscape vs portrait produces different zoom levels
- Fit-page on landscape vs portrait works correctly
- Navigation between portrait and landscape pages recomputes fit
- Search finds text on landscape pages
- Highlights render horizontally on native landscape pages
- Sidebar shows mixed aspect ratio thumbnails

---

## 8. Files Changed/Created

### New files
- `src/viewer/ViewerToolbar.ts` — toolbar component
- `tests/fixtures/mixed-orientation.pdf` — test fixture
- `tests/e2e/toolbar.spec.ts` — toolbar E2E tests
- `tests/e2e/rotation.spec.ts` — rotation E2E tests
- `tests/e2e/landscape.spec.ts` — landscape/mixed E2E tests

### Modified files
- `src/viewer/PdfViewer.ts` — rotation state, toolbar integration, per-page fit mode
- `src/viewer/PageRenderer.ts` — pass rotation to getViewport
- `src/viewer/Sidebar.ts` — rotation support in thumbnails
- `src/index.ts` — export ViewerToolbar and types
- `demo/index.html` — remove stepper/zoom/fit HTML, remove "Thumbnails" heading
- `demo/app.ts` — remove external control wiring, use toolbar config
- `demo/style.css` — toolbar styles (frosted glass + fallback)
