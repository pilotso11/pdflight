# CDN Distribution Design

## Goal

Make pdflight usable from plain HTML pages via `<script>` tag or ESM `import` from a CDN URL, with zero build tools required by the consumer.

## Architecture

### Build Output

A new Vite config (`vite.config.cdn.ts`) produces two self-contained files into `dist-cdn/`:

- **`pdflight.iife.js`** — IIFE bundle exposing `window.pdflight` with all public exports
- **`pdflight.esm.js`** — ES module bundle for `import` from CDN URLs

Both files bundle pdfjs-dist and inline the pdf.js web worker as a blob URL. No external dependencies or extra files needed.

### Worker Inlining

The pdf.js worker must run in a separate thread. Current approach uses `import.meta.url` to resolve the worker path, which only works with bundlers.

For CDN builds, a Vite plugin reads the pdf.js worker source at build time, embeds it as a string constant, and creates a blob URL at runtime:

```javascript
const workerBlob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
```

The existing `PdfViewer.ts` worker setup needs to detect whether it's in a CDN build (blob available) vs npm build (use import.meta.url).

### Deployment

GitHub Pages serves the built files from `https://pilotso11.github.io/pdflight/`.

A GitHub Action (`.github/workflows/pages.yml`) triggers on push to `main`:
1. Checkout, install deps with bun
2. Run `bun run build:cdn`
3. Deploy `dist-cdn/` to GitHub Pages

### Consumer Usage

```html
<!-- Script tag -->
<script src="https://pilotso11.github.io/pdflight/pdflight.iife.js"></script>
<script>
  const viewer = new pdflight.PdfViewer(document.getElementById('viewer'));
  viewer.load('document.pdf');
</script>

<!-- ESM import -->
<script type="module">
  import { PdfViewer } from 'https://pilotso11.github.io/pdflight/pdflight.esm.js';
  const viewer = new PdfViewer(document.getElementById('viewer'));
  viewer.load('document.pdf');
</script>
```

### Example Page

An `example.html` is included in `dist-cdn/` and deployed to Pages, serving as live documentation at `https://pilotso11.github.io/pdflight/example.html`.

## What Doesn't Change

- Existing `vite.config.ts` (npm library build) — unchanged
- Existing `vite.config.demo.ts` (dev server) — unchanged
- `src/` source code — minimal change (worker URL detection)
- All existing tests continue to pass
