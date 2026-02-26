import { test, expect } from '@playwright/test';

test.describe('Module Loading', () => {
  test('checks if app.ts is running', async ({ page }) => {
    // Log all console messages
    page.on('console', msg => {
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    // Also check for any unhandled errors
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });

    await page.goto('/');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Check if the viewer object was created
    const viewerExists = await page.evaluate(() => {
      return typeof (window as any).viewer !== 'undefined';
    });
    console.log('Viewer exists in window:', viewerExists);

    // Check if we can access the PdfViewer class
    const pdfViewerExists = await page.evaluate(() => {
      return typeof (window as any).PdfViewer !== 'undefined';
    });
    console.log('PdfViewer class exists:', pdfViewerExists);

    // Check the demo app initialization
    const initCalled = await page.evaluate(() => {
      const initBtn = document.querySelector('button');
      return initBtn !== null;
    });
    console.log('Demo app initialized:', initCalled);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/module-load-check.png' });
  });
});
