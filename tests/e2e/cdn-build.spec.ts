// Copyright (c) 2026 Seth Osher. MIT License.
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync } from 'fs';
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

    // Create unversioned copies (mirrors what the GitHub Action does)
    const files = readdirSync(DIST_CDN);
    const iifeVersioned = files.find(f => /^pdflight-[\d.]+\.iife\.js$/.test(f));
    const esmVersioned = files.find(f => /^pdflight-[\d.]+\.js$/.test(f));
    if (iifeVersioned) {
      copyFileSync(resolve(DIST_CDN, iifeVersioned), resolve(DIST_CDN, 'pdflight.iife.js'));
    }
    if (esmVersioned) {
      copyFileSync(resolve(DIST_CDN, esmVersioned), resolve(DIST_CDN, 'pdflight.js'));
    }

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

  test('produces versioned and unversioned output files', async () => {
    const files = readdirSync(DIST_CDN);
    // Versioned files from the build
    expect(files.some(f => /^pdflight-[\d.]+\.iife\.js$/.test(f))).toBe(true);
    expect(files.some(f => /^pdflight-[\d.]+\.js$/.test(f))).toBe(true);
    // Unversioned copies (latest)
    expect(existsSync(resolve(DIST_CDN, 'pdflight.iife.js'))).toBe(true);
    expect(existsSync(resolve(DIST_CDN, 'pdflight.js'))).toBe(true);
  });

  test('IIFE bundle contains inlined worker', async () => {
    const iife = readFileSync(resolve(DIST_CDN, 'pdflight.iife.js'), 'utf-8');
    expect(iife).toContain('application/javascript');
    expect(iife).toContain('createObjectURL');
  });

  test('loads PDF via IIFE bundle and renders', async ({ page }) => {
    await page.goto(`http://localhost:${CDN_PORT}/example.html`);

    await page.evaluate(async () => {
      const resp = await fetch('/sample.pdf');
      const buffer = await resp.arrayBuffer();
      await (window as any).viewer.load(buffer);
    });

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

    const toolbar = page.locator('.pdflight-toolbar');
    await expect(toolbar).toBeVisible();
  });

  test('ESM bundle exports expected symbols including VERSION', async ({ page }) => {
    await page.goto(`http://localhost:${CDN_PORT}/example.html`);

    const result = await page.evaluate(async (port) => {
      const mod = await import(`http://localhost:${port}/pdflight.js`);
      return { keys: Object.keys(mod), version: mod.VERSION };
    }, CDN_PORT);

    expect(result.keys).toContain('PdfViewer');
    expect(result.keys).toContain('searchPages');
    expect(result.keys).toContain('computeHighlightRects');
    expect(result.keys).toContain('VERSION');
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
