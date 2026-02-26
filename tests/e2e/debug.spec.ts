import { test, expect } from '@playwright/test';

test.describe('Debug', () => {
  test('debug page load', async ({ page }) => {
    // Monitor network requests
    page.on('request', request => {
      console.log('Request:', request.url());
    });
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log('Response error:', response.url(), response.status());
      } else {
        console.log('Response:', response.url(), response.status());
      }
    });

    await page.goto('/');

    // Take a screenshot
    await page.screenshot({ path: 'tests/screenshots/debug-page-load.png' });

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check if the select element exists
    const selectExists = await page.locator('[data-testid="demo-pdf-select"]').count();
    console.log('Select element count:', selectExists);

    // Check if it's visible
    const isVisible = await page.locator('[data-testid="demo-pdf-select"]').isVisible();
    console.log('Select element visible:', isVisible);

    // Try to get the page title
    const title = await page.title();
    console.log('Page title:', title);

    // Check for any console messages
    page.on('console', msg => {
      console.log(`Console [${msg.type()}]:`, msg.text());
    });

    // Wait a bit and try to select
    await page.waitForTimeout(2000);

    // Try selecting with force
    try {
      await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf', { timeout: 5000 });
      console.log('Successfully selected option');

      // Wait longer for PDF to load and render
      await page.waitForTimeout(5000);

      // Check if canvas exists
      const canvasCount = await page.locator('[data-testid="pdf-viewer"] canvas').count();
      console.log('Canvas count:', canvasCount);

      // Take screenshot before checking canvas
      await page.screenshot({ path: 'tests/screenshots/debug-before-canvas-check.png' });

      // Wait for PDF to load
      await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
      console.log('PDF canvas loaded');

      // Take another screenshot
      await page.screenshot({ path: 'tests/screenshots/debug-after-pdf-load.png' });
    } catch (e) {
      console.log('Error selecting option:', e);
      await page.screenshot({ path: 'tests/screenshots/debug-error.png' });
      throw e;
    }
  });
});
