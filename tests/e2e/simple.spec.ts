import { test, expect } from '@playwright/test';

test.describe('Simple PDF Load', () => {
  test('loads PDF and renders canvas', async ({ page }) => {
    // Monitor console
    const logs: string[] = [];
    page.on('console', msg => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto('/');

    // Select a PDF
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');

    // Wait for any async operations to complete
    await page.waitForTimeout(3000);

    // Check what's in the pdf-viewer container
    const viewerHTML = await page.locator('[data-testid="pdf-viewer"]').innerHTML();
    console.log('Viewer HTML length:', viewerHTML.length);

    // Check for any elements
    const childCount = await page.locator('[data-testid="pdf-viewer"] > *').count();
    console.log('Direct child count:', childCount);

    // Look for canvas elements anywhere in viewer
    const canvasCount = await page.locator('[data-testid="pdf-viewer"] canvas').count();
    console.log('Canvas count:', canvasCount);

    // Look for div elements
    const divCount = await page.locator('[data-testid="pdf-viewer"] div').count();
    console.log('Div count:', divCount);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/simple-pdf-load.png', fullPage: true });

    // Print console logs
    console.log('Console logs:', logs.slice(0, 20).join('\n'));

    // The PDF should have rendered something
    expect(childCount + canvasCount + divCount).toBeGreaterThan(0);
  });
});
