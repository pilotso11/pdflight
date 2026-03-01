# Thumbnail Sidebar — Design

**Date**: 2026-03-01
**Status**: Approved

## Goal

Render page thumbnails in the sidebar with lazy loading, click-to-navigate, and current page highlighting.

## Architecture

### New file: `src/viewer/Sidebar.ts`

A `Sidebar` class that manages thumbnail rendering:

- **Constructor**: takes a container element and a callback for page navigation
- **`render(pdfDocument)`**: creates a placeholder div for each page with correct aspect ratio. Sets up `IntersectionObserver` on the sidebar scroll container to lazily render thumbnails as they scroll into view.
- **Thumbnail rendering**: uses `page.render()` with a small viewport (width ~150px). Each thumbnail is a `<canvas>` inside a wrapper div.
- **Click handling**: clicking a thumbnail calls the navigation callback with the page number
- **Active page**: `setActivePage(n)` updates CSS class on the active thumbnail
- **`destroy()`**: disconnects observer, removes elements

### Lazy loading

- Each page starts as a placeholder `<div>` with correct aspect ratio (computed from `page.getViewport()`)
- `IntersectionObserver` watches all placeholders within the sidebar scroll area
- When a placeholder enters the viewport, render its canvas and replace the placeholder content
- Buffer: render 2 pages above/below the visible area (rootMargin)
- Once rendered, a thumbnail stays rendered (no unloading)

### Wiring in PdfViewer.ts

- After PDF loads, if there's a sidebar container provided, create `Sidebar` and call `render()`
- On `pagechange` event, call `sidebar.setActivePage()`
- Expose `setSidebarContainer(el)` for the demo app to connect its `#thumbnails` div

### Demo app changes

- In `app.ts`, after viewer creation, pass the thumbnails container to the viewer
- Sidebar toggle already shows/hides the `<aside>` — no changes needed there

### Visual style

- Thumbnail wrapper: border, slight shadow, cursor pointer
- Active thumbnail: highlighted border (e.g., 2px blue)
- Page number label below each thumbnail

## Testing

- Existing `sidebar.spec.ts` tests check for canvases and click navigation
- Add test for lazy loading: verify that off-screen thumbnails don't have canvases until scrolled
