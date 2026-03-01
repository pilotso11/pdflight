import { test, expect } from '@playwright/test';

test.describe('Viewer Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('renders toolbar at bottom of viewer', async ({ page }) => {
    const toolbar = page.locator('[data-testid="pdflight-toolbar"]');
    await expect(toolbar).toBeVisible();
  });

  test('stepper shows page info and navigates', async ({ page }) => {
    const pageInfo = page.locator('.pdflight-toolbar-page-info');
    await expect(pageInfo).toHaveText('Page 1 of 4');

    await page.click('.pdflight-toolbar-btn[title="Next page"]');
    await expect(pageInfo).toHaveText('Page 2 of 4');

    await page.click('.pdflight-toolbar-btn[title="Previous page"]');
    await expect(pageInfo).toHaveText('Page 1 of 4');
  });

  test('zoom buttons change zoom level', async ({ page }) => {
    const zoomLevel = page.locator('.pdflight-toolbar-zoom-level');
    const initial = await zoomLevel.textContent();
    const initialNum = parseInt(initial!);

    await page.click('.pdflight-toolbar-btn[title="Zoom in"]');
    await page.waitForSelector('.pdflight-page-container', { timeout: 5000 });
    await expect(zoomLevel).toHaveText(`${initialNum + 25}%`);
  });

  test('fit mode dropdown switches modes', async ({ page }) => {
    const zoomLevel = page.locator('.pdflight-toolbar-zoom-level');

    // Get fit-width zoom
    const fitWidthZoom = await zoomLevel.textContent();

    // Switch to fit-page
    await page.selectOption('.pdflight-toolbar-select', 'page');
    await page.waitForSelector('.pdflight-page-container', { timeout: 5000 });
    const fitPageZoom = await zoomLevel.textContent();

    // Fit-page should be smaller for portrait PDF
    expect(parseInt(fitPageZoom!)).toBeLessThan(parseInt(fitWidthZoom!));
  });

  test('rotate buttons rotate the page', async ({ page }) => {
    const canvas = page.locator('.pdflight-page-container canvas').first();
    const initialWidth = await canvas.evaluate(el => el.width);
    const initialHeight = await canvas.evaluate(el => el.height);

    // Portrait PDF: width < height
    expect(initialWidth).toBeLessThan(initialHeight);

    // Rotate 90 degrees clockwise
    await page.click('.pdflight-toolbar-btn[title="Rotate clockwise"]');
    await page.waitForSelector('.pdflight-page-container canvas', { timeout: 5000 });

    const rotatedWidth = await page.locator('.pdflight-page-container canvas').first().evaluate(el => el.width);
    const rotatedHeight = await page.locator('.pdflight-page-container canvas').first().evaluate(el => el.height);

    // After 90 rotation: width > height (landscape)
    expect(rotatedWidth).toBeGreaterThan(rotatedHeight);
  });
});
