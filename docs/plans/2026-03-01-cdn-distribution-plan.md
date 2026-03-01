# CDN Distribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce self-contained IIFE and ESM bundles that work from a `<script>` tag or CDN `import`, deployed to GitHub Pages.

**Architecture:** A Vite plugin inlines the pdf.js worker as a blob URL at build time. A new Vite config (`vite.config.cdn.ts`) outputs both IIFE and ESM formats into `dist-cdn/`. A GitHub Action builds and deploys to Pages on push to main.

**Tech Stack:** Vite (build), GitHub Actions (CI/CD), GitHub Pages (hosting)

---

### Task 1: Create the worker inline Vite plugin

This plugin replaces the `import.meta.url`-based worker setup in PdfViewer.ts with a blob URL containing the inlined worker source. It only activates during the CDN build.

**Files:**
- Create: `build/vite-plugin-inline-worker.ts`

**Step 1: Create the plugin**

```typescript
// build/vite-plugin-inline-worker.ts
// Copyright (c) 2026 Seth Osher. MIT License.
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

/**
 * Vite plugin that inlines the pdf.js worker as a blob URL.
 * Replaces the import.meta.url-based worker URL in PdfViewer.ts
 * with a self-contained blob URL created at runtime.
 */
export function inlineWorkerPlugin(): Plugin {
  return {
    name: 'inline-pdfjs-worker',
    transform(code, id) {
      // Only transform PdfViewer.ts
      if (!id.includes('PdfViewer.ts')) return null;

      // Find and replace the worker URL setup
      const workerSetupPattern =
        /const workerUrl = new URL\([^)]+\)\.toString\(\);\s*pdfjs\.GlobalWorkerOptions\.workerSrc = workerUrl;/;

      if (!workerSetupPattern.test(code)) return null;

      // Read the worker source at build time
      const workerPath = resolve(
        process.cwd(),
        'node_modules/pdfjs-dist/build/pdf.worker.mjs',
      );
      const workerSource = readFileSync(workerPath, 'utf-8');

      // Escape backticks and ${} in the worker source for template literal
      const escaped = workerSource
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${');

      const replacement = [
        `const __workerSource = \`${escaped}\`;`,
        `const __workerBlob = new Blob([__workerSource], { type: 'application/javascript' });`,
        `pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(__workerBlob);`,
      ].join('\n');

      return {
        code: code.replace(workerSetupPattern, replacement),
        map: null,
      };
    },
  };
}
```

**Step 2: Verify the file was created correctly**

Run: `bun run typecheck`
Expected: PASS (the plugin is only imported by the CDN vite config, which doesn't exist yet — but the file itself should have no syntax errors)

**Step 3: Commit**

```bash
git add build/vite-plugin-inline-worker.ts
git commit -m "feat: add Vite plugin to inline pdf.js worker as blob URL"
```

---

### Task 2: Create the CDN Vite config

**Files:**
- Create: `vite.config.cdn.ts`
- Modify: `package.json` (add `build:cdn` script)

**Step 1: Create the CDN vite config**

```typescript
// vite.config.cdn.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { inlineWorkerPlugin } from './build/vite-plugin-inline-worker';

export default defineConfig({
  plugins: [inlineWorkerPlugin()],
  build: {
    outDir: 'dist-cdn',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'pdflight',
      fileName: 'pdflight',
      formats: ['es', 'iife'],
    },
    rollupOptions: {
      output: {
        // Ensure IIFE uses .iife.js extension, ESM uses .esm.js
        entryFileNames: (chunkInfo) => {
          return `pdflight.[format].js`;
        },
      },
    },
    // Don't minify for readability during development; consumers can minify
    minify: true,
  },
});
```

**Step 2: Add the build:cdn script to package.json**

In `package.json`, add to the `"scripts"` section:

```json
"build:cdn": "vite build --config vite.config.cdn.ts"
```

**Step 3: Run the CDN build and verify output**

Run: `bun run build:cdn`
Expected: Build succeeds, produces `dist-cdn/pdflight.es.js` and `dist-cdn/pdflight.iife.js`

Note: Vite uses `es` and `iife` as format names in the filename by default. The exact filenames may be `pdflight.es.js` / `pdflight.iife.js`. Check the output and adjust if needed.

**Step 4: Verify the IIFE build contains the inlined worker**

Run: `grep -c "workerBlob" dist-cdn/pdflight.iife.js`
Expected: At least 1 match (the blob URL setup is present)

Run: `grep -c "import.meta.url" dist-cdn/pdflight.iife.js`
Expected: 0 matches (the import.meta.url worker setup was replaced)

**Step 5: Commit**

```bash
git add vite.config.cdn.ts package.json
git commit -m "feat: add CDN build config producing IIFE and ESM bundles"
```

---

### Task 3: Add dist-cdn to .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Add dist-cdn/ to .gitignore**

Add this line to `.gitignore`:

```
dist-cdn/
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore dist-cdn build output"
```

---

### Task 4: Create the example HTML page

This page is deployed to GitHub Pages as a live demo. It shows both script tag and ESM usage patterns with a minimal but functional PDF viewer.

**Files:**
- Create: `cdn/example.html`

**Step 1: Create the example page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>pdflight CDN Example</title>
  <style>
    * { box-sizing: border-box; margin: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
    h1 { margin-bottom: 12px; }
    .controls { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
    .controls input[type="text"] { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; }
    .controls button {
      padding: 6px 12px; background: #007bff; color: white;
      border: none; border-radius: 4px; cursor: pointer;
    }
    .controls button:hover { background: #0056b3; }
    #viewer {
      width: 100%; height: 70vh; border: 1px solid #ddd; border-radius: 4px;
      overflow: auto; background: #525659;
    }
    .usage { margin-top: 20px; padding: 16px; background: #f5f5f5; border-radius: 4px; }
    .usage h2 { margin-bottom: 8px; font-size: 16px; }
    .usage pre { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
    .usage code { font-family: 'SF Mono', Menlo, monospace; }
  </style>
</head>
<body>
  <h1>pdflight CDN Example</h1>

  <div class="controls">
    <input type="file" id="file-input" accept=".pdf">
    <input type="text" id="search-input" placeholder="Search...">
    <button id="search-btn">Search</button>
    <button id="highlight-btn">Highlight Results</button>
    <button id="clear-btn">Clear</button>
    <span id="status"></span>
  </div>

  <div id="viewer"></div>

  <div class="usage">
    <h2>Script Tag Usage</h2>
    <pre><code>&lt;script src="https://pilotso11.github.io/pdflight/pdflight.iife.js"&gt;&lt;/script&gt;
&lt;script&gt;
  const viewer = new pdflight.PdfViewer(document.getElementById('viewer'), {
    toolbar: true
  });
  viewer.load('document.pdf');
&lt;/script&gt;</code></pre>

    <h2>ESM Import Usage</h2>
    <pre><code>&lt;script type="module"&gt;
  import { PdfViewer } from 'https://pilotso11.github.io/pdflight/pdflight.esm.js';
  const viewer = new PdfViewer(document.getElementById('viewer'), {
    toolbar: true
  });
  viewer.load('document.pdf');
&lt;/script&gt;</code></pre>
  </div>

  <!-- Load pdflight via script tag (IIFE build) -->
  <script src="./pdflight.iife.js"></script>
  <script>
    const viewer = new pdflight.PdfViewer(document.getElementById('viewer'), {
      toolbar: true,
    });

    const status = document.getElementById('status');
    let lastMatches = [];

    document.getElementById('file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      status.textContent = 'Loading...';
      const buffer = await file.arrayBuffer();
      await viewer.load(buffer);
      status.textContent = 'Loaded ' + file.name;
    });

    document.getElementById('search-btn').addEventListener('click', async () => {
      const query = document.getElementById('search-input').value.trim();
      if (!query) return;
      lastMatches = await viewer.search(query);
      status.textContent = lastMatches.length + ' matches';
    });

    document.getElementById('highlight-btn').addEventListener('click', () => {
      viewer.removeAllHighlights();
      viewer.addHighlights(lastMatches.map((m, i) => ({
        id: 'h-' + i,
        page: m.page,
        startChar: m.startChar,
        endChar: m.endChar,
        color: 'rgba(255, 255, 0, 0.4)',
      })));
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      viewer.removeAllHighlights();
      lastMatches = [];
      status.textContent = '';
    });
  </script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add cdn/example.html
git commit -m "feat: add CDN example page for GitHub Pages"
```

---

### Task 5: Create the GitHub Actions workflow

**Files:**
- Create: `.github/workflows/pages.yml`

**Step 1: Create the workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install

      - run: bun run build:cdn

      - name: Copy example page to dist-cdn
        run: cp cdn/example.html dist-cdn/

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist-cdn

      - id: deployment
        uses: actions/deploy-pages@v4
```

**Step 2: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "ci: add GitHub Pages deployment workflow"
```

---

### Task 6: Test the CDN build end-to-end locally

**Step 1: Run the CDN build**

Run: `bun run build:cdn`
Expected: Build succeeds, files in `dist-cdn/`

**Step 2: Copy example.html into dist-cdn and serve locally**

Run: `cp cdn/example.html dist-cdn/ && cd dist-cdn && python3 -m http.server 8080`

Open `http://localhost:8080/example.html` in a browser. Load a PDF file. Verify:
- PDF renders
- Search works
- Highlights work
- Toolbar appears

**Step 3: Verify the ESM build also works**

Open browser console on the example page and run:
```javascript
import('http://localhost:8080/pdflight.esm.js').then(m => console.log(Object.keys(m)))
```
Expected: Logs the exported names (PdfViewer, searchPages, etc.)

**Step 4: Check file sizes**

Run: `ls -lh dist-cdn/pdflight.*.js`
Expected: Each file is roughly 1-3MB (pdf.js worker is ~2MB unminified)

---

### Task 7: Update README and CLAUDE.md

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Add CDN usage section to README.md**

After the "Quick Start" section, add:

```markdown
## CDN Usage

Use pdflight directly in HTML without any build tools:

### Script Tag

```html
<script src="https://pilotso11.github.io/pdflight/pdflight.iife.js"></script>
<script>
  const viewer = new pdflight.PdfViewer(document.getElementById('viewer'), {
    toolbar: true,
  });
  viewer.load('document.pdf');
</script>
```

### ES Module

```html
<script type="module">
  import { PdfViewer } from 'https://pilotso11.github.io/pdflight/pdflight.esm.js';
  const viewer = new PdfViewer(document.getElementById('viewer'), {
    toolbar: true,
  });
  viewer.load('document.pdf');
</script>
```

See the [live example](https://pilotso11.github.io/pdflight/example.html).
```

**Step 2: Add build:cdn command to README Development section and CLAUDE.md Build Commands**

Add to both:
```
bun run build:cdn       # Build self-contained CDN bundles (IIFE + ESM)
```

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add CDN usage instructions to README and CLAUDE.md"
```

---

### Task 8: Push and verify GitHub Pages deployment

**Step 1: Push all commits**

```bash
git push
```

**Step 2: Check GitHub Actions**

Go to `https://github.com/pilotso11/pdflight/actions` and verify the Pages workflow runs successfully.

**Step 3: Verify the deployed page**

Open `https://pilotso11.github.io/pdflight/example.html` and verify:
- Page loads
- Can load a PDF via file picker
- Search and highlights work
- Both code examples in the usage section show correct URLs

**Step 4: Remove completed plan docs**

```bash
rm docs/plans/2026-03-01-cdn-distribution-design.md docs/plans/2026-03-01-cdn-distribution-plan.md
git add -A docs/plans/
git commit -m "chore: remove completed CDN plan docs"
```
