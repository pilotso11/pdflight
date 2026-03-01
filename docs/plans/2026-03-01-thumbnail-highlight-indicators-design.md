# Thumbnail Highlight Indicators — Design

**Date**: 2026-03-01
**Status**: Approved

## Goal

Show which pages have highlights in the thumbnail sidebar, using a colored edge bar and a match count badge.

## Design

### Colored Edge Bar

A 4px vertical bar on the left inside edge of each thumbnail that has highlights. Colors match the actual highlight colors on that page. Multiple colors split the bar vertically in equal segments via CSS `linear-gradient`. Single color pages get a flat color bar.

### Match Count Badge

A small pill badge in the top-right corner of each thumbnail showing the total number of highlights on that page (e.g., "3"). Background color matches the highlight color (or the first color if multiple). White text for contrast.

### Data Flow

- `PdfViewer` computes highlight info per page from `this.highlights`
- On highlight changes (`addHighlight`, `addHighlights`, `removeHighlight`, `removeAllHighlights`), calls `sidebar.updateHighlightIndicators(pageHighlightInfo)`
- `pageHighlightInfo`: `Map<number, { colors: string[]; count: number }>`
- Colors are deduplicated; alpha suffix stripped for visibility at small size

### DOM Structure (per thumbnail)

```
.pdflight-thumbnail
  canvas
  .pdflight-thumbnail-edge-bar   (position: absolute; left: 0; top: 0; bottom: 0; width: 4px)
  .pdflight-thumbnail-badge      (position: absolute; top: 4px; right: 4px; pill shape)
  .pdflight-thumbnail-label
```

Elements are added/removed dynamically — not present when page has no highlights.

## Files to Modify

1. `src/viewer/Sidebar.ts` — add `updateHighlightIndicators()` method
2. `src/viewer/PdfViewer.ts` — call sidebar update on highlight changes
3. `demo/style.css` — styles for edge bar and badge
4. `tests/e2e/sidebar.spec.ts` — tests for indicator visibility and count accuracy

## Testing

- Load PDF, search, highlight all results
- Verify edge bars appear on pages with highlights
- Verify badge shows correct count
- Verify indicators disappear when highlights are cleared
