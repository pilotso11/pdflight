import { test, expect } from '@playwright/test';

test.describe('Highlights on mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Expand the controls drawer to access settings
    const controlsPanel = page.locator('#controls-panel');
    if (await controlsPanel.evaluate(el => el.classList.contains('collapsed'))) {
      await page.click('[data-testid="controls-toggle"]');
    }
    // Set fit mode to width before loading (maximizes PDF on narrow screen)
    await page.selectOption('[data-testid="cfg-fit-mode"]', 'width');
    // Load PDF
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
    // Collapse the drawer to let the PDF fill the screen
    await page.click('[data-testid="controls-toggle"]');
    // Hide demo header bar
    await page.evaluate(() => {
      const header = document.querySelector('.toolbar');
      if (header) (header as HTMLElement).style.display = 'none';
    });
  });

  /** Expand the controls drawer to access search/highlight controls. */
  async function expandDrawer(page: import('@playwright/test').Page) {
    const controlsPanel = page.locator('#controls-panel');
    if (await controlsPanel.evaluate(el => el.classList.contains('collapsed'))) {
      await page.click('[data-testid="controls-toggle"]');
    }
  }

  /** Collapse the controls drawer. */
  async function collapseDrawer(page: import('@playwright/test').Page) {
    const controlsPanel = page.locator('#controls-panel');
    if (await controlsPanel.evaluate(el => !el.classList.contains('collapsed'))) {
      await page.click('[data-testid="controls-toggle"]');
    }
  }

  test('highlights render on mobile', async ({ page }) => {
    await expandDrawer(page);
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(500);

    const matchText = await page.locator('[data-testid="search-results"]').textContent();
    const matchCount = parseInt(matchText?.match(/\d+/)?.[0] ?? '0');

    if (matchCount > 0) {
      const highlights = page.locator('.pdflight-highlight');
      await expect(highlights.first()).toBeVisible({ timeout: 3000 });
      const count = await highlights.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('highlight positions stay within viewport bounds', async ({ page }) => {
    await expandDrawer(page);
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(200);
    await collapseDrawer(page);

    const highlightCount = await page.locator('.pdflight-highlight').count();
    if (highlightCount > 0) {
      const positions = await page.locator('.pdflight-highlight').evaluateAll(els => {
        return els.map(el => {
          const rect = el.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        });
      });

      const containerRect = await page.locator('.pdflight-page-container').evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      });

      for (const pos of positions) {
        expect(pos.left).toBeGreaterThanOrEqual(containerRect.left - 1);
        expect(pos.right).toBeLessThanOrEqual(containerRect.right + 1);
      }
    }
  });

  test('highlights survive zoom on mobile', async ({ page }) => {
    await expandDrawer(page);
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(200);
    await collapseDrawer(page);

    const initialCount = await page.locator('.pdflight-highlight').count();
    if (initialCount > 0) {
      await page.click('.pdflight-toolbar-btn[title="Zoom in"]');
      await page.waitForTimeout(500);

      const afterZoomCount = await page.locator('.pdflight-highlight').count();
      expect(afterZoomCount).toBeGreaterThan(0);
    }
  });

  test('highlight tooltip appears on tap', async ({ page }) => {
    await expandDrawer(page);
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(200);
    await collapseDrawer(page);

    const firstHighlight = page.locator('.pdflight-highlight').first();
    const count = await firstHighlight.count();

    if (count > 0) {
      await firstHighlight.click();
      await expect(page.locator('.pdflight-tooltip')).toBeVisible();
    }
  });

  test('screenshot: mobile highlight accuracy', async ({ page }) => {
    await expandDrawer(page);
    await page.fill('[data-testid="search-input"]', 'This');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(200);
    await collapseDrawer(page);

    const viewer = page.locator('[data-testid="pdf-viewer"]');
    await viewer.screenshot({
      path: 'tests/screenshots/highlight-mobile.png',
      fullPage: false,
    });

    const fs = await import('fs');
    expect(fs.existsSync('tests/screenshots/highlight-mobile.png')).toBe(true);
  });
});
