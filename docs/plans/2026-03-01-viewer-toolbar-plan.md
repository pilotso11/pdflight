# Viewer Toolbar, Rotation & Landscape Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace external demo controls with a built-in frosted-glass toolbar rendered inside the viewer, add 90-degree page rotation, and support landscape/mixed-orientation PDFs with correct fit mode and highlights.

**Architecture:** New `ViewerToolbar` class creates DOM inside the viewer container. `PdfViewer` owns toolbar lifecycle, passes rotation to `PageRenderer` and `Sidebar` via pdf.js `getViewport({ rotation })`. Fit mode uses per-page dimensions from a lazy cache. Mixed-orientation test fixture created with `pdf-lib`.

**Tech Stack:** TypeScript, CSS `backdrop-filter` with `@supports` fallback, pdf.js rotation API, `pdf-lib` (dev dependency for fixture generation).

---

### Task 1: Create mixed-orientation PDF test fixture

**Files:**
- Create: `scripts/create-test-fixtures.ts`
- Create: `tests/fixtures/mixed-orientation.pdf`
- Modify: `demo/index.html` — add fixture to demo dropdown

**Step 1: Install pdf-lib as dev dependency**

Run: `bun add -d pdf-lib`

**Step 2: Write fixture generation script**

```typescript
// scripts/create-test-fixtures.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync } from 'fs';

async function createMixedOrientationPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Page 1: Portrait (595 x 842)
  const p1 = doc.addPage([595, 842]);
  p1.drawText('Portrait Page One', { x: 50, y: 780, size: 24, font, color: rgb(0, 0, 0) });
  p1.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit.', { x: 50, y: 740, size: 12, font });
  p1.drawText('Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', { x: 50, y: 720, size: 12, font });

  // Page 2: Landscape (842 x 595)
  const p2 = doc.addPage([842, 595]);
  p2.drawText('Landscape Page Two', { x: 50, y: 540, size: 24, font, color: rgb(0, 0, 0) });
  p2.drawText('This is a landscape page with ipsum text for search testing.', { x: 50, y: 500, size: 12, font });
  p2.drawText('Highlights should render horizontally on this wide page.', { x: 50, y: 480, size: 12, font });

  // Page 3: Portrait (595 x 842)
  const p3 = doc.addPage([595, 842]);
  p3.drawText('Portrait Page Three', { x: 50, y: 780, size: 24, font, color: rgb(0, 0, 0) });
  p3.drawText('Another portrait page with different ipsum content.', { x: 50, y: 740, size: 12, font });

  const bytes = await doc.save();
  writeFileSync('tests/fixtures/mixed-orientation.pdf', bytes);
  console.log('Created tests/fixtures/mixed-orientation.pdf');
}

createMixedOrientationPdf();
```

**Step 3: Run the script**

Run: `bun run scripts/create-test-fixtures.ts`
Expected: File created at `tests/fixtures/mixed-orientation.pdf`

**Step 4: Add to demo dropdown**

In `demo/index.html`, add after the Sample 2 option:

```html
<option value="mixed-orientation.pdf">Mixed Orientation</option>
```

**Step 5: Verify fixture loads in the demo**

Run: `bun run dev`, open browser, select "Mixed Orientation" from dropdown.
Expected: PDF renders, 3 pages, page 1 is portrait.

**Step 6: Commit**

```bash
git add scripts/create-test-fixtures.ts tests/fixtures/mixed-orientation.pdf demo/index.html package.json bun.lockb
git commit -m "feat: add mixed-orientation PDF test fixture"
```

---

### Task 2: Per-page fit mode dimensions

**Files:**
- Modify: `src/viewer/PdfViewer.ts`

**Step 1: Replace single-page cache with per-page dimension cache**

In `PdfViewer`, replace:

```typescript
private unscaledPageWidth = 0;
private unscaledPageHeight = 0;
```

With:

```typescript
private pageDimensions = new Map<number, { width: number; height: number }>();
```

**Step 2: Cache dimensions during load and page navigation**

In `load()`, replace the first-page dimension caching with:

```typescript
const firstPage = await this.pdfDocument.getPage(1);
const unscaledVp = firstPage.getViewport({ scale: 1 });
this.pageDimensions.set(1, { width: unscaledVp.width, height: unscaledVp.height });
```

In `renderCurrentPage()`, after `renderer.render()`, add:

```typescript
// Cache page dimensions for fit mode
if (!this.pageDimensions.has(this.currentPage)) {
  const pdfPageHeight = renderer.getPdfPageHeight();
  const vp = renderer.getViewport();
  if (vp && pdfPageHeight) {
    const unscaledWidth = vp.width / this.currentZoom;
    const unscaledHeight = pdfPageHeight;
    this.pageDimensions.set(this.currentPage, { width: unscaledWidth, height: unscaledHeight });
  }
}
```

**Step 3: Update applyFitMode to use current page dimensions**

Replace the existing `applyFitMode()`:

```typescript
private applyFitMode(): void {
  const dims = this.pageDimensions.get(this.currentPage);
  if (!dims) return;

  const containerWidth = this.container.clientWidth;
  const containerHeight = this.container.clientHeight;
  const padding = 40;

  let newZoom: number;
  if (this.fitMode === 'width') {
    newZoom = (containerWidth - padding) / dims.width;
  } else if (this.fitMode === 'page') {
    const scaleW = (containerWidth - padding) / dims.width;
    const scaleH = (containerHeight - padding) / dims.height;
    newZoom = Math.min(scaleW, scaleH);
  } else {
    return;
  }

  newZoom = Math.max(0.1, Math.min(newZoom, 10));
  if (Math.abs(newZoom - this.currentZoom) < 0.001) return;

  this.currentZoom = newZoom;
  this.emit('zoomchange', this.currentZoom);

  if (this.pdfDocument && this.pageRenderers.size > 0) {
    this.rerenderAllPages();
  }
}
```

**Step 4: Reapply fit mode on page navigation**

In `goToPage()`, after `renderCurrentPage()` completes and before emitting `pagechange`, add:

```typescript
if (this.fitMode !== 'none') {
  this.applyFitMode();
}
```

**Step 5: Clean up pageDimensions in destroy()**

Add `this.pageDimensions.clear();` in `destroy()`.

**Step 6: Run tests**

Run: `bun run test && bun run test:e2e`
Expected: All pass (existing fit mode tests still work since they use single-page PDFs).

**Step 7: Commit**

```bash
git add src/viewer/PdfViewer.ts
git commit -m "refactor: use per-page dimensions for fit mode calculations"
```

---

### Task 3: Add rotation to PageRenderer

**Files:**
- Modify: `src/viewer/PageRenderer.ts`

**Step 1: Add rotation parameter to PageRenderer**

Add `private rotation = 0;` to the class fields.

Update the constructor to accept rotation:

```typescript
constructor(
  private pageNumber: number,
  viewport: PageViewport,
  rotation = 0,
) {
  this.pageViewport = viewport;
  this.currentScale = viewport.scale;
  this.rotation = rotation;
}
```

**Step 2: Pass rotation to getViewport calls**

In `render()`, change line 71 from:

```typescript
const viewport = this.pdfPage.getViewport({ scale: this.currentScale });
```

To:

```typescript
const viewport = this.pdfPage.getViewport({ scale: this.currentScale, rotation: this.rotation });
```

In `getPdfPageHeight()`, change:

```typescript
const unscaledViewport = this.pdfPage.getViewport({ scale: 1 });
```

To:

```typescript
const unscaledViewport = this.pdfPage.getViewport({ scale: 1, rotation: this.rotation });
```

**Step 3: Run tests**

Run: `bun run test && bun run test:e2e`
Expected: All pass (rotation=0 is the default, behavior unchanged).

**Step 4: Commit**

```bash
git add src/viewer/PageRenderer.ts
git commit -m "feat: add rotation parameter to PageRenderer"
```

---

### Task 4: Add rotation to PdfViewer

**Files:**
- Modify: `src/viewer/PdfViewer.ts`

**Step 1: Add rotation state and public API**

Add field: `private currentRotation = 0;`

Add public methods:

```typescript
/** Rotate the page by 90 or -90 degrees. */
rotate(degrees: 90 | -90): void {
  this.currentRotation = ((this.currentRotation + degrees) % 360 + 360) % 360;
  // Clear dimension cache since rotation changes effective dimensions
  this.pageDimensions.clear();
  this.renderCurrentPage().then(() => {
    // Re-cache dimensions for current page and reapply fit
    if (this.fitMode !== 'none') {
      this.applyFitMode();
    }
    this.sidebar?.setRotation(this.currentRotation);
    this.emit('zoomchange', this.currentZoom);
  });
}

/** Get current rotation in degrees (0, 90, 180, 270). */
getRotation(): number {
  return this.currentRotation;
}
```

**Step 2: Pass rotation to PageRenderer**

In `renderCurrentPage()`, change the PageRenderer constructor call:

```typescript
const renderer = new PageRenderer(this.currentPage, {
  pageNumber: this.currentPage,
  width: 0,
  height: 0,
  scale: this.currentZoom,
}, this.currentRotation);
```

Do the same in `ensureAllTextIndices()`.

**Step 3: Update pageDimensions caching to use rotated viewport**

In `load()`, update the first-page dimension caching:

```typescript
const firstPage = await this.pdfDocument.getPage(1);
const unscaledVp = firstPage.getViewport({ scale: 1, rotation: this.currentRotation });
this.pageDimensions.set(1, { width: unscaledVp.width, height: unscaledVp.height });
```

**Step 4: Reset rotation on new PDF load**

At the top of `load()`, add:

```typescript
this.currentRotation = 0;
this.pageDimensions.clear();
```

**Step 5: Run tests**

Run: `bun run test && bun run test:e2e`
Expected: All pass (no rotation applied by default).

**Step 6: Commit**

```bash
git add src/viewer/PdfViewer.ts
git commit -m "feat: add rotation API to PdfViewer"
```

---

### Task 5: Add rotation to Sidebar

**Files:**
- Modify: `src/viewer/Sidebar.ts`

**Step 1: Add rotation state and setter**

Add field: `private rotation = 0;`

Add public method:

```typescript
/** Update rotation and re-render thumbnails. */
setRotation(rotation: number): void {
  if (this.rotation === rotation) return;
  this.rotation = rotation;
  // Invalidate rendered thumbnails so they re-render with new rotation
  this.rendered.clear();
  // Re-render visible thumbnails
  for (const wrapper of this.wrappers) {
    // Remove existing canvas
    wrapper.querySelector('canvas')?.remove();
  }
  // Update wrapper aspect ratios
  if (this.pdfDocument) {
    this.updateWrapperDimensions();
  }
  // Re-observe to trigger lazy rendering
  if (this.observer) {
    for (const wrapper of this.wrappers) {
      this.observer.unobserve(wrapper);
      this.observer.observe(wrapper);
    }
  }
}
```

**Step 2: Pass rotation to getViewport calls in renderThumbnail**

In `renderThumbnail()`, change:

```typescript
const unscaledViewport = page.getViewport({ scale: 1 });
```

To:

```typescript
const unscaledViewport = page.getViewport({ scale: 1, rotation: this.rotation });
```

And:

```typescript
const viewport = page.getViewport({ scale });
```

To:

```typescript
const viewport = page.getViewport({ scale, rotation: this.rotation });
```

**Step 3: Also pass rotation in render() for initial aspect ratio**

In `render()`, change:

```typescript
const defaultViewport = firstPage.getViewport({ scale: 1 });
```

To:

```typescript
const defaultViewport = firstPage.getViewport({ scale: 1, rotation: this.rotation });
```

**Step 4: Add updateWrapperDimensions helper**

```typescript
private async updateWrapperDimensions(): Promise<void> {
  if (!this.pdfDocument) return;
  const firstPage = await this.pdfDocument.getPage(1);
  const vp = firstPage.getViewport({ scale: 1, rotation: this.rotation });
  const aspect = vp.height / vp.width;
  for (const wrapper of this.wrappers) {
    wrapper.style.height = `${Math.round(THUMBNAIL_WIDTH * aspect)}px`;
  }
}
```

**Step 5: Run tests**

Run: `bun run test && bun run test:e2e`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/viewer/Sidebar.ts
git commit -m "feat: add rotation support to sidebar thumbnails"
```

---

### Task 6: Create ViewerToolbar component

**Files:**
- Create: `src/viewer/ViewerToolbar.ts`
- Modify: `src/index.ts` — add export

**Step 1: Create the ViewerToolbar class**

```typescript
// src/viewer/ViewerToolbar.ts

export interface ToolbarConfig {
  stepper?: boolean;
  zoom?: boolean;
  rotate?: boolean;
  fit?: boolean;
  position?: 'top' | 'bottom';
}

export interface ToolbarCallbacks {
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitModeChange: (mode: 'width' | 'page' | 'none') => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
}

/** Resolve shorthand (boolean) to full config object. */
export function resolveToolbarConfig(
  input: ToolbarConfig | boolean | undefined,
): ToolbarConfig | null {
  if (input === false || input === undefined) return null;
  if (input === true) return { stepper: true, zoom: true, rotate: true, fit: true, position: 'bottom' };
  return {
    stepper: input.stepper ?? true,
    zoom: input.zoom ?? true,
    rotate: input.rotate ?? true,
    fit: input.fit ?? true,
    position: input.position ?? 'bottom',
  };
}

export class ViewerToolbar {
  private el: HTMLElement;
  private config: ToolbarConfig;
  private callbacks: ToolbarCallbacks;

  // Refs to dynamic elements
  private pageInfoEl: HTMLElement | null = null;
  private zoomLevelEl: HTMLElement | null = null;
  private fitSelectEl: HTMLSelectElement | null = null;

  constructor(container: HTMLElement, config: ToolbarConfig, callbacks: ToolbarCallbacks) {
    this.config = config;
    this.callbacks = callbacks;

    this.el = document.createElement('div');
    this.el.className = 'pdflight-toolbar';
    this.el.dataset.testid = 'pdflight-toolbar';
    if (config.position === 'top') {
      this.el.classList.add('pdflight-toolbar-top');
    }

    this.buildControls();

    if (config.position === 'top') {
      container.prepend(this.el);
    } else {
      container.appendChild(this.el);
    }
  }

  /** Update the page info display. */
  updatePageInfo(current: number, total: number): void {
    if (this.pageInfoEl) {
      this.pageInfoEl.textContent = `Page ${current} of ${total}`;
    }
  }

  /** Update the zoom level display. */
  updateZoomLevel(zoom: number): void {
    if (this.zoomLevelEl) {
      this.zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
    }
  }

  /** Update the fit mode selector. */
  updateFitMode(mode: 'width' | 'page' | 'none'): void {
    if (this.fitSelectEl) {
      this.fitSelectEl.value = mode;
    }
  }

  /** Cleanup. */
  destroy(): void {
    this.el.remove();
  }

  private buildControls(): void {
    if (this.config.stepper) this.addStepper();
    if (this.config.rotate) this.addRotate();
    if (this.config.zoom) this.addZoom();
    if (this.config.fit) this.addFitMode();
  }

  private addStepper(): void {
    const group = this.createGroup();

    const prev = document.createElement('button');
    prev.className = 'pdflight-toolbar-btn';
    prev.textContent = '◀';
    prev.title = 'Previous page';
    prev.addEventListener('click', this.callbacks.onPrevPage);

    this.pageInfoEl = document.createElement('span');
    this.pageInfoEl.className = 'pdflight-toolbar-page-info';
    this.pageInfoEl.textContent = 'Page 1 of 1';

    const next = document.createElement('button');
    next.className = 'pdflight-toolbar-btn';
    next.textContent = '▶';
    next.title = 'Next page';
    next.addEventListener('click', this.callbacks.onNextPage);

    group.append(prev, this.pageInfoEl, next);
    this.el.appendChild(group);
  }

  private addRotate(): void {
    const group = this.createGroup();

    const ccw = document.createElement('button');
    ccw.className = 'pdflight-toolbar-btn';
    ccw.textContent = '↺';
    ccw.title = 'Rotate counterclockwise';
    ccw.addEventListener('click', this.callbacks.onRotateCCW);

    const cw = document.createElement('button');
    cw.className = 'pdflight-toolbar-btn';
    cw.textContent = '↻';
    cw.title = 'Rotate clockwise';
    cw.addEventListener('click', this.callbacks.onRotateCW);

    group.append(ccw, cw);
    this.el.appendChild(group);
  }

  private addZoom(): void {
    const group = this.createGroup();

    const out = document.createElement('button');
    out.className = 'pdflight-toolbar-btn';
    out.textContent = '−';
    out.title = 'Zoom out';
    out.addEventListener('click', this.callbacks.onZoomOut);

    this.zoomLevelEl = document.createElement('span');
    this.zoomLevelEl.className = 'pdflight-toolbar-zoom-level';
    this.zoomLevelEl.textContent = '100%';

    const zoomIn = document.createElement('button');
    zoomIn.className = 'pdflight-toolbar-btn';
    zoomIn.textContent = '+';
    zoomIn.title = 'Zoom in';
    zoomIn.addEventListener('click', this.callbacks.onZoomIn);

    group.append(out, this.zoomLevelEl, zoomIn);
    this.el.appendChild(group);
  }

  private addFitMode(): void {
    const group = this.createGroup();

    this.fitSelectEl = document.createElement('select');
    this.fitSelectEl.className = 'pdflight-toolbar-select';
    this.fitSelectEl.title = 'Fit mode';

    for (const [value, label] of [['width', 'Fit Width'], ['page', 'Fit Page'], ['none', 'None']] as const) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      this.fitSelectEl.appendChild(opt);
    }

    this.fitSelectEl.addEventListener('change', () => {
      this.callbacks.onFitModeChange(this.fitSelectEl!.value as 'width' | 'page' | 'none');
    });

    group.appendChild(this.fitSelectEl);
    this.el.appendChild(group);
  }

  private createGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'pdflight-toolbar-group';
    return group;
  }
}
```

**Step 2: Add export to index.ts**

```typescript
export { ViewerToolbar, type ToolbarConfig, type ToolbarCallbacks, resolveToolbarConfig } from './viewer/ViewerToolbar';
```

**Step 3: Run type check**

Run: `bun run typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/viewer/ViewerToolbar.ts src/index.ts
git commit -m "feat: add ViewerToolbar component"
```

---

### Task 7: Add toolbar CSS styles

**Files:**
- Modify: `demo/style.css`

**Step 1: Add toolbar styles with frosted glass + dark fallback**

Append to `demo/style.css`:

```css
/* Built-in viewer toolbar */
.pdflight-toolbar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 12px;
  min-height: 36px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.75);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 -1px 8px rgba(0, 0, 0, 0.08);
  font-size: 13px;
  color: #1a1a1a;
  user-select: none;
}

.pdflight-toolbar-top {
  position: sticky;
  top: 0;
  bottom: auto;
  border-top: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.08);
}

@supports not (backdrop-filter: blur(1px)) {
  .pdflight-toolbar {
    background: rgba(30, 30, 30, 0.9);
    color: #f0f0f0;
    border-color: rgba(255, 255, 255, 0.1);
  }
  .pdflight-toolbar-btn {
    color: #f0f0f0;
  }
  .pdflight-toolbar-select {
    background: rgba(255, 255, 255, 0.15);
    color: #f0f0f0;
    border-color: rgba(255, 255, 255, 0.2);
  }
}

.pdflight-toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}

.pdflight-toolbar-group:last-child {
  border-right: none;
}

.pdflight-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.12s;
}

.pdflight-toolbar-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.pdflight-toolbar-btn:active {
  background: rgba(0, 0, 0, 0.15);
}

.pdflight-toolbar-page-info,
.pdflight-toolbar-zoom-level {
  min-width: 80px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.pdflight-toolbar-select {
  padding: 4px 8px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.5);
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
```

**Step 2: Commit**

```bash
git add demo/style.css
git commit -m "feat: add frosted-glass toolbar styles with dark fallback"
```

---

### Task 8: Wire toolbar into PdfViewer

**Files:**
- Modify: `src/viewer/PdfViewer.ts`

**Step 1: Add toolbar option to PdfViewerOptions**

```typescript
export interface PdfViewerOptions {
  // ... existing options
  toolbar?: ToolbarConfig | boolean;
}
```

Import `ViewerToolbar`, `resolveToolbarConfig`, and `ToolbarConfig` at the top.

**Step 2: Create toolbar in constructor**

After the ResizeObserver setup, add:

```typescript
const toolbarConfig = resolveToolbarConfig(options.toolbar);
if (toolbarConfig) {
  this.toolbar = new ViewerToolbar(this.container, toolbarConfig, {
    onPrevPage: () => this.goToPage(this.currentPage - 1),
    onNextPage: () => this.goToPage(this.currentPage + 1),
    onZoomIn: () => this.setZoom(this.currentZoom + 0.25),
    onZoomOut: () => this.setZoom(Math.max(0.25, this.currentZoom - 0.25)),
    onFitModeChange: (mode) => this.setFitMode(mode),
    onRotateCW: () => this.rotate(90),
    onRotateCCW: () => this.rotate(-90),
  });
}
```

Add field: `private toolbar: ViewerToolbar | null = null;`

**Step 3: Update toolbar state on events**

In `goToPage()`, after emitting `pagechange`:

```typescript
this.toolbar?.updatePageInfo(this.currentPage, this.pdfDocument!.numPages);
```

At the end of `load()` (after sidebar setup):

```typescript
this.toolbar?.updatePageInfo(this.currentPage, this.pdfDocument.numPages);
this.toolbar?.updateZoomLevel(this.currentZoom);
this.toolbar?.updateFitMode(this.fitMode);
```

In `applyFitMode()`, after `this.emit('zoomchange', ...)`:

```typescript
this.toolbar?.updateZoomLevel(this.currentZoom);
```

In `setZoom()`, after the zoom change:

```typescript
this.toolbar?.updateZoomLevel(this.currentZoom);
```

In `setFitMode()`, after applying:

```typescript
this.toolbar?.updateFitMode(mode);
```

**Step 4: Cleanup toolbar in destroy()**

```typescript
this.toolbar?.destroy();
this.toolbar = null;
```

**Step 5: Run tests**

Run: `bun run test && bun run test:e2e`
Expected: All pass (toolbar not enabled in existing tests).

**Step 6: Commit**

```bash
git add src/viewer/PdfViewer.ts
git commit -m "feat: wire ViewerToolbar into PdfViewer lifecycle"
```

---

### Task 9: Update demo app to use built-in toolbar

**Files:**
- Modify: `demo/index.html`
- Modify: `demo/app.ts`

**Step 1: Remove external controls from demo HTML**

In `demo/index.html`:

- Remove the zoom toolbar-section (zoom-out, zoom-level, zoom-in, fit-mode select)
- Remove the stepper-toggle checkbox and label
- Remove the page-stepper div from the footer
- Remove the "Thumbnails" `<h2>` from the sidebar
- Remove the Navigation `<h3>` from the footer (it only contained the stepper)

Keep: file loading, search, sidebar toggle, highlight controls, serialize section.

**Step 2: Update demo app.ts**

- Remove DOM references: `zoomIn`, `zoomOut`, `zoomLevel`, `fitMode`, `stepperToggle`, `pageStepper`, `prevPage`, `nextPage`, `pageInfo`
- Remove all event listeners for those elements
- Remove `updatePageInfo()` function
- Add `toolbar: true` to the PdfViewer constructor options
- Keep sidebar toggle (it controls layout visibility, not a viewer feature)

**Step 3: Verify demo works**

Run: `bun run dev`, test in browser.
Expected: Built-in toolbar at bottom of viewer, all controls functional.

**Step 4: Commit**

```bash
git add demo/index.html demo/app.ts
git commit -m "refactor: use built-in toolbar in demo, remove external controls"
```

---

### Task 10: Update existing E2E tests for new toolbar

**Files:**
- Modify: `tests/e2e/navigation.spec.ts`
- Modify: `tests/e2e/stepper.spec.ts`

**Step 1: Update navigation.spec.ts selectors**

Tests now need to target `[data-testid="pdflight-toolbar"]` and its child elements instead of the external demo controls. The toolbar is now always present since the demo uses `toolbar: true`.

Update selectors:
- Zoom level: `.pdflight-toolbar-zoom-level` instead of `[data-testid="zoom-level"]`
- Zoom buttons: `.pdflight-toolbar-btn` with title attributes instead of `[data-testid="zoom-in"]`
- Fit mode: `.pdflight-toolbar-select` instead of `[data-testid="fit-mode"]`

**Step 2: Update stepper.spec.ts selectors**

- Page info: `.pdflight-toolbar-page-info` instead of `[data-testid="page-info"]`
- Prev/next buttons: `.pdflight-toolbar-btn[title="Previous page"]` / `[title="Next page"]`
- Remove stepper toggle checks (stepper is always in toolbar now)

**Step 3: Run E2E tests**

Run: `bun run test:e2e`
Expected: All pass with new selectors.

**Step 4: Commit**

```bash
git add tests/e2e/navigation.spec.ts tests/e2e/stepper.spec.ts
git commit -m "test: update E2E tests for built-in toolbar selectors"
```

---

### Task 11: Write toolbar E2E tests

**Files:**
- Create: `tests/e2e/toolbar.spec.ts`

**Step 1: Write toolbar-specific tests**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Viewer Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('renders toolbar at bottom of viewer', async ({ page }) => {
    const toolbar = page.locator('[data-testid="pdflight-toolbar"]');
    await expect(toolbar).toBeVisible();
  });

  test('stepper shows page info and navigates', async ({ page }) => {
    const pageInfo = page.locator('.pdflight-toolbar-page-info');
    await expect(pageInfo).toHaveText('Page 1 of 4');

    await page.click('.pdflight-toolbar-btn[title="Next page"]');
    await expect(pageInfo).toHaveText('Page 2 of 4');

    await page.click('.pdflight-toolbar-btn[title="Previous page"]');
    await expect(pageInfo).toHaveText('Page 1 of 4');
  });

  test('zoom buttons change zoom level', async ({ page }) => {
    const zoomLevel = page.locator('.pdflight-toolbar-zoom-level');
    const initial = await zoomLevel.textContent();
    const initialNum = parseInt(initial!);

    await page.click('.pdflight-toolbar-btn[title="Zoom in"]');
    await expect(zoomLevel).toHaveText(`${initialNum + 25}%`);
  });

  test('fit mode dropdown switches modes', async ({ page }) => {
    const zoomLevel = page.locator('.pdflight-toolbar-zoom-level');

    // Get fit-width zoom
    const fitWidthZoom = await zoomLevel.textContent();

    // Switch to fit-page
    await page.selectOption('.pdflight-toolbar-select', 'page');
    const fitPageZoom = await zoomLevel.textContent();

    // Fit-page should be smaller for portrait PDF
    expect(parseInt(fitPageZoom!)).toBeLessThan(parseInt(fitWidthZoom!));
  });

  test('rotate buttons rotate the page', async ({ page }) => {
    const canvas = page.locator('.pdflight-page-container canvas').first();
    const initialWidth = await canvas.evaluate(el => el.width);
    const initialHeight = await canvas.evaluate(el => el.height);

    // Portrait PDF: width < height
    expect(initialWidth).toBeLessThan(initialHeight);

    // Rotate 90 degrees clockwise
    await page.click('.pdflight-toolbar-btn[title="Rotate clockwise"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });

    const rotatedWidth = await page.locator('.pdflight-page-container canvas').first().evaluate(el => el.width);
    const rotatedHeight = await page.locator('.pdflight-page-container canvas').first().evaluate(el => el.height);

    // After 90 rotation: width > height (landscape)
    expect(rotatedWidth).toBeGreaterThan(rotatedHeight);
  });
});
```

**Step 2: Run tests**

Run: `bun run test:e2e -- tests/e2e/toolbar.spec.ts`
Expected: All pass.

**Step 3: Commit**

```bash
git add tests/e2e/toolbar.spec.ts
git commit -m "test: add toolbar E2E tests"
```

---

### Task 12: Write rotation E2E tests

**Files:**
- Create: `tests/e2e/rotation.spec.ts`

**Step 1: Write rotation tests**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Rotation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('rotates clockwise through 0 → 90 → 180 → 270 → 0', async ({ page }) => {
    const getCanvasDims = async () => {
      const canvas = page.locator('.pdflight-page-container canvas').first();
      return {
        w: await canvas.evaluate(el => el.width),
        h: await canvas.evaluate(el => el.height),
      };
    };

    const initial = await getCanvasDims();
    expect(initial.w).toBeLessThan(initial.h); // portrait

    // 90: landscape
    await page.click('.pdflight-toolbar-btn[title="Rotate clockwise"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });
    const at90 = await getCanvasDims();
    expect(at90.w).toBeGreaterThan(at90.h);

    // 180: portrait (upside down)
    await page.click('.pdflight-toolbar-btn[title="Rotate clockwise"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });
    const at180 = await getCanvasDims();
    expect(at180.w).toBeLessThan(at180.h);

    // 270: landscape
    await page.click('.pdflight-toolbar-btn[title="Rotate clockwise"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });
    const at270 = await getCanvasDims();
    expect(at270.w).toBeGreaterThan(at270.h);

    // 360 = 0: portrait again
    await page.click('.pdflight-toolbar-btn[title="Rotate clockwise"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });
    const at360 = await getCanvasDims();
    expect(at360.w).toBe(initial.w);
    expect(at360.h).toBe(initial.h);
  });

  test('fit mode recomputes after rotation', async ({ page }) => {
    const zoomLevel = page.locator('.pdflight-toolbar-zoom-level');
    const beforeRotation = parseInt((await zoomLevel.textContent())!);

    await page.click('.pdflight-toolbar-btn[title="Rotate clockwise"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });
    const afterRotation = parseInt((await zoomLevel.textContent())!);

    // Rotating portrait to landscape in fit-width should change zoom
    expect(afterRotation).not.toBe(beforeRotation);
  });

  test('highlights render correctly on rotated pages', async ({ page }) => {
    // Search and highlight
    await page.fill('[data-testid="search-input"]', 'Lorem');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');

    // Verify highlights exist
    const highlightsBefore = await page.locator('.pdflight-highlight').count();
    expect(highlightsBefore).toBeGreaterThan(0);

    // Rotate
    await page.click('.pdflight-toolbar-btn[title="Rotate clockwise"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });

    // Highlights should still be present after rotation
    const highlightsAfter = await page.locator('.pdflight-highlight').count();
    expect(highlightsAfter).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests**

Run: `bun run test:e2e -- tests/e2e/rotation.spec.ts`
Expected: All pass.

**Step 3: Commit**

```bash
git add tests/e2e/rotation.spec.ts
git commit -m "test: add rotation E2E tests"
```

---

### Task 13: Write landscape/mixed-orientation E2E tests

**Files:**
- Create: `tests/e2e/landscape.spec.ts`

**Step 1: Write landscape and mixed-orientation tests**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Landscape & Mixed Orientation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'mixed-orientation.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('page 1 renders as portrait', async ({ page }) => {
    const canvas = page.locator('.pdflight-page-container canvas').first();
    const width = await canvas.evaluate(el => el.width);
    const height = await canvas.evaluate(el => el.height);
    expect(width).toBeLessThan(height);
  });

  test('page 2 renders as landscape', async ({ page }) => {
    // Navigate to page 2
    await page.click('.pdflight-toolbar-btn[title="Next page"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });

    const canvas = page.locator('.pdflight-page-container canvas').first();
    const width = await canvas.evaluate(el => el.width);
    const height = await canvas.evaluate(el => el.height);
    expect(width).toBeGreaterThan(height);
  });

  test('fit-width zoom differs between portrait and landscape pages', async ({ page }) => {
    const zoomLevel = page.locator('.pdflight-toolbar-zoom-level');
    const portraitZoom = parseInt((await zoomLevel.textContent())!);

    // Navigate to landscape page 2
    await page.click('.pdflight-toolbar-btn[title="Next page"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });
    const landscapeZoom = parseInt((await zoomLevel.textContent())!);

    // Landscape page is wider, so fit-width zoom should be lower
    expect(landscapeZoom).toBeLessThan(portraitZoom);
  });

  test('search finds text across orientations', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'ipsum');
    await page.click('[data-testid="search-btn"]');
    const results = await page.locator('[data-testid="search-results"]').textContent();

    // Should find matches on both portrait and landscape pages
    const matchCount = parseInt(results!);
    expect(matchCount).toBeGreaterThan(1);
  });

  test('sidebar shows mixed aspect ratio thumbnails', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');
    await page.waitForSelector('[data-testid="thumbnails"] canvas', { timeout: 5000 });

    // Get heights of first two thumbnail wrappers
    const thumb1Height = await page.locator('.pdflight-thumbnail').nth(0).evaluate(el => el.clientHeight);
    const thumb2Height = await page.locator('.pdflight-thumbnail').nth(1).evaluate(el => el.clientHeight);

    // Portrait thumbnail should be taller than landscape thumbnail
    expect(thumb1Height).toBeGreaterThan(thumb2Height);
  });
});
```

**Step 2: Run tests**

Run: `bun run test:e2e -- tests/e2e/landscape.spec.ts`
Expected: All pass.

**Step 3: Commit**

```bash
git add tests/e2e/landscape.spec.ts
git commit -m "test: add landscape and mixed-orientation E2E tests"
```

---

### Task 14: Final verification and cleanup

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `bun run test && bun run test:e2e`
Expected: All unit and E2E tests pass.

**Step 2: Run linter and type checker**

Run: `bun run lint && bun run typecheck`
Expected: No errors.

**Step 3: Visual check in browser**

Open `bun run dev` and verify:
- [ ] Toolbar renders at bottom with frosted glass
- [ ] Stepper navigates between pages
- [ ] Zoom +/− works, zoom level updates
- [ ] Fit Width / Fit Page / None all work
- [ ] Rotate CW/CCW works, page re-renders
- [ ] Sidebar thumbnails update on rotation
- [ ] Mixed orientation PDF: zoom changes between portrait/landscape pages
- [ ] Highlights work on rotated pages
- [ ] Highlights work on landscape pages

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup for toolbar, rotation, and landscape support"
```
