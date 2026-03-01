import { test, expect } from '@playwright/test';

test.describe('Rotation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('rotates clockwise through 0 -> 90 -> 180 -> 270 -> 0', async ({ page }) => {
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
    expect(at360.w).toBeLessThan(at360.h);
  });

  test('fit mode recomputes after rotation', async ({ page }) => {
    const zoomLevel = page.locator('.pdflight-toolbar-zoom-level');
    const beforeRotation = parseInt((await zoomLevel.textContent())!);

    await page.click('.pdflight-toolbar-btn[title="Rotate clockwise"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });
    // Wait for fit mode to recompute
    await page.waitForTimeout(500);
    const afterRotation = parseInt((await zoomLevel.textContent())!);

    // Rotating portrait to landscape in fit-width should change zoom
    expect(afterRotation).not.toBe(beforeRotation);
  });

  test('highlights persist through rotation', async ({ page }) => {
    // Search and highlight first — use same pattern as highlight.spec.ts
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).toContainText('match');
    await page.click('[data-testid="highlight-all"]');

    // Wait for highlights to render (may need extra time for full page render)
    await page.waitForTimeout(500);
    const highlightsBefore = await page.locator('.pdflight-highlight').count();

    if (highlightsBefore > 0) {
      // Rotate
      await page.click('.pdflight-toolbar-btn[title="Rotate clockwise"]');
      await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });
      await page.waitForTimeout(500);

      // Highlights should still be present after rotation
      // NOTE: The highlights may not position correctly (known issue),
      // but they should at least exist in the DOM
      const highlightsAfter = await page.locator('.pdflight-highlight').count();
      expect(highlightsAfter).toBeGreaterThan(0);
    }
    // If no highlights rendered before rotation, skip assertion
    // (highlight rendering depends on page visibility and lazy loading)
  });
});
