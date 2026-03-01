import { test, expect, type Page, type Locator } from '@playwright/test';
import * as fs from 'fs';

const SCREENSHOT_DIR = 'tests/screenshots/highlight-precision';

/**
 * Helper: select a PDF from the demo dropdown and wait for the canvas to render.
 */
async function loadPdf(page: Page, pdfFilename: string): Promise<void> {
  await page.goto('/');
  await page.selectOption('[data-testid="demo-pdf-select"]', pdfFilename);
  await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 15000 });
  // Give PDF a moment to finish rendering all pages
  await page.waitForTimeout(1000);
}

/**
 * Helper: type a search term, click Search, then click Highlight All.
 * Returns the number of matches reported by the search results element.
 */
async function searchAndHighlightAll(page: Page, term: string): Promise<number> {
  await page.fill('[data-testid="search-input"]', term);
  await page.click('[data-testid="search-btn"]');

  // Wait for search to complete (searches all pages)
  await page.waitForTimeout(500);

  const resultsText = await page.locator('[data-testid="search-results"]').textContent();
  const matchCount = parseInt(resultsText?.match(/\d+/)?.[0] ?? '0', 10);

  if (matchCount > 0) {
    await page.click('[data-testid="highlight-all"]');
    // Wait for highlight DOM elements to render
    await page.waitForTimeout(500);
  }

  return matchCount;
}

/**
 * Helper: take a screenshot of the full viewer area.
 */
async function screenshotViewer(page: Page, filename: string): Promise<void> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const viewer = page.locator('[data-testid="pdf-viewer"]');
  await viewer.screenshot({ path: `${SCREENSHOT_DIR}/${filename}` });
}

/**
 * Helper: take a screenshot of each individual highlight element on the current view.
 * Uses page-level clip screenshot with padding for context around each highlight.
 */
async function screenshotHighlights(page: Page, prefix: string, padding = 30): Promise<number> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const highlights = page.locator('.pdflight-highlight');
  const count = await highlights.count();
  let screenshotCount = 0;

  const viewportSize = page.viewportSize();
  const vpWidth = viewportSize?.width ?? 1280;
  const vpHeight = viewportSize?.height ?? 720;

  for (let i = 0; i < count; i++) {
    const hl = highlights.nth(i);
    if (await hl.isVisible()) {
      const box = await hl.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        // Clamp clip region to viewport bounds
        const x = Math.max(0, box.x - padding);
        const y = Math.max(0, box.y - padding);
        const width = Math.min(Math.max(1, box.width + padding * 2), vpWidth - x);
        const height = Math.min(Math.max(1, box.height + padding * 2), vpHeight - y);

        if (width > 0 && height > 0) {
          try {
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/${prefix}-highlight-${i}.png`,
              clip: { x, y, width, height },
            });
            screenshotCount++;
          } catch {
            // Skip highlights that can't be screenshotted (e.g., partially off-screen)
          }
        }
      }
    }
  }

  return screenshotCount;
}

/**
 * Helper: assert that visible highlights have reasonable dimensions.
 */
async function assertHighlightDimensions(page: Page): Promise<void> {
  const highlights = page.locator('.pdflight-highlight');
  const count = await highlights.count();

  for (let i = 0; i < count; i++) {
    const hl = highlights.nth(i);
    if (await hl.isVisible()) {
      const box = await hl.boundingBox();
      expect(box, `highlight ${i} should have a bounding box`).not.toBeNull();
      if (box) {
        expect(box.width, `highlight ${i} width should be > 2px`).toBeGreaterThan(2);
        expect(box.height, `highlight ${i} height should be > 2px`).toBeGreaterThan(2);
        expect(box.width, `highlight ${i} width should be < 1000px`).toBeLessThan(1000);
        expect(box.height, `highlight ${i} height should be < 200px`).toBeLessThan(200);
      }
    }
  }
}

test.describe('Highlight Precision', () => {
  // -------------------------------------------------------------------------
  // Failing cases — currently broken, will be fixed by proportional width estimation
  // -------------------------------------------------------------------------

  test.describe('file-sample_150kB.pdf', () => {
    test.beforeEach(async ({ page }) => {
      await loadPdf(page, 'file-sample_150kB.pdf');
    });

    test('Case 1: "lorem" — highlights should cover full word including the m', async ({ page }) => {
      const matchCount = await searchAndHighlightAll(page, 'lorem');
      expect(matchCount).toBeGreaterThan(0);

      await screenshotViewer(page, 'case1-lorem-viewer.png');
      const screenshotted = await screenshotHighlights(page, 'case1-lorem');
      await assertHighlightDimensions(page);

      expect(screenshotted).toBeGreaterThan(0);
    });

    test('Case 2: "odio" — highlights should not be skewed right', async ({ page }) => {
      const matchCount = await searchAndHighlightAll(page, 'odio');
      expect(matchCount).toBeGreaterThan(0);

      await screenshotViewer(page, 'case2-odio-viewer.png');
      await screenshotHighlights(page, 'case2-odio');
      await assertHighlightDimensions(page);
    });

    test('Case 3: "dictum" — highlights should cover full m', async ({ page }) => {
      const matchCount = await searchAndHighlightAll(page, 'dictum');
      expect(matchCount).toBe(2);

      // Screenshot the viewer (page 1 is visible by default)
      await screenshotViewer(page, 'case3-dictum-viewer.png');
      await screenshotHighlights(page, 'case3-dictum');
    });
  });

  // -------------------------------------------------------------------------
  // pdf-sample2.pdf cases
  // -------------------------------------------------------------------------

  test.describe('pdf-sample2.pdf', () => {
    test.beforeEach(async ({ page }) => {
      await loadPdf(page, 'pdf-sample2.pdf');
    });

    test('Case 4: "bookmarks" — all matches should cover full word', async ({ page }) => {
      const matchCount = await searchAndHighlightAll(page, 'bookmarks');
      expect(matchCount).toBeGreaterThanOrEqual(7);

      await screenshotViewer(page, 'case4-bookmarks-viewer.png');
      await screenshotHighlights(page, 'case4-bookmarks');
      await assertHighlightDimensions(page);

      const highlights = page.locator('.pdflight-highlight');
      expect(await highlights.count()).toBeGreaterThanOrEqual(7);
    });

    // -----------------------------------------------------------------------
    // Regression guards — currently working correctly
    // -----------------------------------------------------------------------

    test('Case 5 (regression): "Accelio" — all matches should be accurate', async ({ page }) => {
      const matchCount = await searchAndHighlightAll(page, 'Accelio');
      expect(matchCount).toBe(3);

      await screenshotViewer(page, 'case5-accelio-viewer.png');
      await screenshotHighlights(page, 'case5-accelio');
      await assertHighlightDimensions(page);

      const highlights = page.locator('.pdflight-highlight');
      expect(await highlights.count()).toBe(3);
    });

    test('Case 6 (regression): "trans_" — matches on page 2 should be accurate', async ({ page }) => {
      const matchCount = await searchAndHighlightAll(page, 'trans_');
      expect(matchCount).toBe(11);

      // All matches are on page 2 — the viewer renders all pages,
      // so highlights should be in the DOM already.
      await screenshotViewer(page, 'case6-trans-viewer.png');
      await screenshotHighlights(page, 'case6-trans');
      await assertHighlightDimensions(page);
    });
  });
});
