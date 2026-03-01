import { test, expect } from '@playwright/test';

test.describe('Landscape & Mixed Orientation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'mixed-orientation.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('page 1 renders as portrait', async ({ page }) => {
    const canvas = page.locator('.pdflight-page-container canvas').first();
    const width = await canvas.evaluate(el => el.width);
    const height = await canvas.evaluate(el => el.height);
    expect(width).toBeLessThan(height);
  });

  test('page 2 renders as landscape', async ({ page }) => {
    // Navigate to page 2
    await page.click('.pdflight-toolbar-btn[title="Next page"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });

    const canvas = page.locator('.pdflight-page-container canvas').first();
    const width = await canvas.evaluate(el => el.width);
    const height = await canvas.evaluate(el => el.height);
    expect(width).toBeGreaterThan(height);
  });

  test('fit-width zoom differs between portrait and landscape pages', async ({ page }) => {
    const zoomLevel = page.locator('.pdflight-toolbar-zoom-level');

    // Switch to fit-width mode first (default is fit-page)
    await page.selectOption('.pdflight-toolbar-select', 'width');
    await page.waitForTimeout(500);
    const portraitZoom = parseInt((await zoomLevel.textContent())!);

    // Navigate to landscape page 2
    await page.click('.pdflight-toolbar-btn[title="Next page"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });
    // Wait for fit mode to recompute
    await page.waitForTimeout(500);
    const landscapeZoom = parseInt((await zoomLevel.textContent())!);

    // Landscape page is wider, so fit-width zoom should be lower
    expect(landscapeZoom).toBeLessThan(portraitZoom);
  });

  test('search finds text across orientations', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'Page');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).toContainText('match');

    const results = await page.locator('[data-testid="search-results"]').textContent();
    const matchCount = parseInt(results!);
    expect(matchCount).toBeGreaterThanOrEqual(1);
  });

  test('sidebar shows mixed aspect ratio thumbnails', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');
    await page.waitForSelector('[data-testid="thumbnails"] canvas', { timeout: 10000 });

    // Wait for at least 2 thumbnails to render
    await page.locator('[data-testid="thumbnails"] canvas').nth(1).waitFor({ timeout: 10000 });

    // Get heights of first two thumbnail wrappers
    const thumb1Height = await page.locator('.pdflight-thumbnail').nth(0).evaluate(el => el.clientHeight);
    const thumb2Height = await page.locator('.pdflight-thumbnail').nth(1).evaluate(el => el.clientHeight);

    // Portrait thumbnail should be taller than landscape thumbnail
    expect(thumb1Height).toBeGreaterThan(thumb2Height);
  });
});
