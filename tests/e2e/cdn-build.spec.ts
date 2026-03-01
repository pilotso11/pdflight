// Copyright (c) 2026 Seth Osher. MIT License.
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { copyFileSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer, type Server } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DIST_CDN = resolve(ROOT, 'dist-cdn');
const CDN_PORT = 8091;

let server: Server;

test.describe('CDN Build', () => {
  // Must run serially — all tests share one static file server
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    // Build the CDN bundles (hardcoded command, no user input)
    execSync('bun run build:cdn', { cwd: ROOT, stdio: 'pipe' });

    // Copy example.html and a test PDF into dist-cdn
    copyFileSync(resolve(ROOT, 'cdn/example.html'), resolve(DIST_CDN, 'example.html'));
    copyFileSync(
      resolve(ROOT, 'tests/fixtures/file-sample_150kB.pdf'),
      resolve(DIST_CDN, 'sample.pdf'),
    );

    // Start a static file server
    server = createServer((req, res) => {
      const url = req.url === '/' ? '/example.html' : req.url!;
      const filePath = resolve(DIST_CDN, url.slice(1));
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = filePath.split('.').pop();
      const contentType: Record<string, string> = {
        html: 'text/html',
        js: 'application/javascript',
        pdf: 'application/pdf',
      };
      res.writeHead(200, { 'Content-Type': contentType[ext ?? ''] ?? 'application/octet-stream' });
      res.end(readFileSync(filePath));
    });

    await new Promise<void>((resolve) => {
      server.listen(CDN_PORT, () => resolve());
    });
  });

  test.afterAll(async () => {
    server?.close();
  });

  test('IIFE bundle produces expected output files', async () => {
    expect(existsSync(resolve(DIST_CDN, 'pdflight.iife.js'))).toBe(true);
    expect(existsSync(resolve(DIST_CDN, 'pdflight.js'))).toBe(true);
  });

  test('IIFE bundle contains inlined worker (no import.meta.url for worker)', async () => {
    const iife = readFileSync(resolve(DIST_CDN, 'pdflight.iife.js'), 'utf-8');
    // Should contain blob URL creation for the worker
    expect(iife).toContain('application/javascript');
    expect(iife).toContain('createObjectURL');
  });

  test('loads PDF via IIFE bundle and renders', async ({ page }) => {
    await page.goto(`http://localhost:${CDN_PORT}/example.html`);

    // Load PDF via JS
    await page.evaluate(async () => {
      const resp = await fetch('/sample.pdf');
      const buffer = await resp.arrayBuffer();
      await (window as any).viewer.load(buffer);
    });

    // Wait for canvas to appear
    await page.waitForSelector('#viewer canvas', { timeout: 10000 });
    const canvasCount = await page.locator('#viewer canvas').count();
    expect(canvasCount).toBeGreaterThan(0);
  });

  test('search works via IIFE bundle', async ({ page }) => {
    await page.goto(`http://localhost:${CDN_PORT}/example.html`);

    await page.evaluate(async () => {
      const resp = await fetch('/sample.pdf');
      const buffer = await resp.arrayBuffer();
      await (window as any).viewer.load(buffer);
    });

    await page.waitForSelector('#viewer canvas', { timeout: 10000 });

    const matchCount = await page.evaluate(async () => {
      const matches = await (window as any).viewer.search('lorem');
      return matches.length;
    });

    expect(matchCount).toBeGreaterThan(0);
  });

  test('highlights work via IIFE bundle', async ({ page }) => {
    await page.goto(`http://localhost:${CDN_PORT}/example.html`);

    await page.evaluate(async () => {
      const resp = await fetch('/sample.pdf');
      const buffer = await resp.arrayBuffer();
      await (window as any).viewer.load(buffer);
    });

    await page.waitForSelector('#viewer canvas', { timeout: 10000 });

    await page.evaluate(async () => {
      const v = (window as any).viewer;
      const matches = await v.search('lorem');
      v.addHighlights(matches.map((m: any, i: number) => ({
        id: 'h-' + i,
        page: m.page,
        startChar: m.startChar,
        endChar: m.endChar,
        color: 'rgba(255, 255, 0, 0.4)',
      })));
    });

    // Wait for highlights to render
    await page.waitForSelector('.pdflight-highlight', { timeout: 5000 });
    const hlCount = await page.locator('.pdflight-highlight').count();
    expect(hlCount).toBeGreaterThan(0);
  });

  test('toolbar is present', async ({ page }) => {
    await page.goto(`http://localhost:${CDN_PORT}/example.html`);

    await page.evaluate(async () => {
      const resp = await fetch('/sample.pdf');
      const buffer = await resp.arrayBuffer();
      await (window as any).viewer.load(buffer);
    });

    await page.waitForSelector('#viewer canvas', { timeout: 10000 });

    // Toolbar should be rendered
    const toolbar = page.locator('.pdflight-toolbar');
    await expect(toolbar).toBeVisible();
  });

  test('ESM bundle exports expected symbols', async ({ page }) => {
    await page.goto(`http://localhost:${CDN_PORT}/example.html`);

    const exports = await page.evaluate(async () => {
      const mod = await import(`http://localhost:${8091}/pdflight.js`);
      return Object.keys(mod);
    });

    expect(exports).toContain('PdfViewer');
    expect(exports).toContain('searchPages');
    expect(exports).toContain('computeHighlightRects');
    expect(exports).toContain('VERSION');
  });
});
