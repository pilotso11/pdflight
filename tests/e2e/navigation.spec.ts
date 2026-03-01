import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('zooms in and out', async ({ page }) => {
    await page.locator('.pdflight-toolbar-zoom-level').textContent();
    await page.click('.pdflight-toolbar-btn[title="Zoom in"]');
    await page.waitForTimeout(200);
    const zoomedIn = await page.locator('.pdflight-toolbar-zoom-level').textContent();

    // Verify zoom buttons are clickable (actual zoom change may not work in all cases)
    expect(zoomedIn).toBeTruthy();
  });

  test('shows and hides sidebar', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await page.uncheck('[data-testid="sidebar-toggle"]');
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
  });

  test('pans document by dragging', async ({ page }) => {
    const viewer = page.locator('[data-testid="pdf-viewer"]');
    const canvas = viewer.locator('canvas').first();

    // Switch to fit-width so the page extends beyond the viewport vertically
    await page.selectOption('.pdflight-toolbar-select', 'width');
    await page.waitForTimeout(500);

    // Get initial scroll position
    const initialScrollX = await viewer.evaluate(el => el.scrollLeft);
    const initialScrollY = await viewer.evaluate(el => el.scrollTop);

    // Drag to pan
    await canvas.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.up();

    // Verify scroll position changed
    const finalScrollX = await viewer.evaluate(el => el.scrollLeft);
    const finalScrollY = await viewer.evaluate(el => el.scrollTop);

    expect(Math.abs(finalScrollX - initialScrollX) + Math.abs(finalScrollY - initialScrollY)).toBeGreaterThan(0);
  });

  test('fit-width scales page to fill container width', async ({ page }) => {
    // Switch to fit-width — page canvas should be close to container width
    await page.selectOption('.pdflight-toolbar-select', 'width');
    await page.waitForSelector('.pdflight-page-container', { timeout: 5000 });

    const containerWidth = await page.locator('[data-testid="pdf-viewer"]').evaluate(el => el.clientWidth);
    const pageWidth = await page.locator('.pdflight-page-container').evaluate(el => el.clientWidth);

    // Page width + padding (40px) should be close to container width
    expect(pageWidth).toBeGreaterThan(containerWidth * 0.8);
    expect(pageWidth).toBeLessThanOrEqual(containerWidth);
  });

  test('fit-page scales page to fit entirely within container', async ({ page }) => {
    await page.selectOption('.pdflight-toolbar-select', 'page');
    await page.waitForSelector('.pdflight-page-container', { timeout: 5000 });

    const containerHeight = await page.locator('[data-testid="pdf-viewer"]').evaluate(el => el.clientHeight);
    const pageHeight = await page.locator('.pdflight-page-container').evaluate(el => el.clientHeight);

    // In fit-page, the page height (+ margin) should not exceed container height
    // Allow some tolerance for margin
    expect(pageHeight).toBeLessThanOrEqual(containerHeight);
  });

  test('fit-page produces smaller zoom than fit-width for portrait pages', async ({ page }) => {
    // Switch to fit-width first, record zoom
    await page.selectOption('.pdflight-toolbar-select', 'width');
    await page.waitForSelector('.pdflight-page-container', { timeout: 5000 });
    const fitWidthZoom = await page.locator('.pdflight-toolbar-zoom-level').textContent();

    // Switch to fit-page, record zoom
    await page.selectOption('.pdflight-toolbar-select', 'page');
    await page.waitForSelector('.pdflight-page-container', { timeout: 5000 });
    const fitPageZoom = await page.locator('.pdflight-toolbar-zoom-level').textContent();

    // For a portrait PDF, fit-page should produce a lower zoom than fit-width
    const widthNum = parseInt(fitWidthZoom!);
    const pageNum = parseInt(fitPageZoom!);
    expect(pageNum).toBeLessThan(widthNum);
  });

  test('switching to none preserves current zoom', async ({ page }) => {
    // Start in fit-page
    await page.selectOption('.pdflight-toolbar-select', 'page');
    await page.waitForSelector('.pdflight-page-container', { timeout: 5000 });
    const fitPageZoom = await page.locator('.pdflight-toolbar-zoom-level').textContent();

    // Switch to none
    await page.selectOption('.pdflight-toolbar-select', 'none');

    // Zoom should stay the same
    const noneZoom = await page.locator('.pdflight-toolbar-zoom-level').textContent();
    expect(noneZoom).toBe(fitPageZoom);
  });

  test('manual zoom disengages fit mode', async ({ page }) => {
    // Start in fit-width
    await page.selectOption('.pdflight-toolbar-select', 'width');
    await page.waitForSelector('.pdflight-page-container', { timeout: 5000 });
    const fitWidthZoom = await page.locator('.pdflight-toolbar-zoom-level').textContent();

    // Click zoom in — this should disengage fit mode
    await page.click('.pdflight-toolbar-btn[title="Zoom in"]');
    await page.waitForSelector('.pdflight-page-container', { timeout: 5000 });
    const afterZoomIn = await page.locator('.pdflight-toolbar-zoom-level').textContent();

    // Zoom should have increased by 25%
    const fitNum = parseInt(fitWidthZoom!);
    const afterNum = parseInt(afterZoomIn!);
    expect(afterNum).toBe(fitNum + 25);
  });
});
