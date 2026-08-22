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
        // Replacement function (not string) so `$&`, `$'`, `` $` `` etc. in the
        // escaped worker source are treated literally instead of as replace()
        // replacement patterns — pdf.worker.mjs v6 contains `$&` sequences.
        code: code.replace(workerSetupPattern, () => replacement),
        map: null,
      };
    },
  };
}
