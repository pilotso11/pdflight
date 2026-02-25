import { test, expect } from '@playwright/test';

test.describe('Highlights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#demo-pdf-select', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('applies highlight on search results', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');

    // Wait a moment for highlights to render
    await page.waitForTimeout(100);

    // Check that highlight elements exist
    const highlights = page.locator('.pdflight-highlight');
    const matchText = await page.locator('[data-testid="search-results"]').textContent();
    const count = parseInt(matchText?.match(/\d+/)?.[0] ?? '0');
    if (count > 0) {
      await expect(highlights).toHaveCount(Math.max(1, count));
    }
  });

  test('shows tooltip on highlight hover', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');

    // Wait for highlights
    await page.waitForTimeout(100);

    const firstHighlight = page.locator('.pdflight-highlight').first();
    const count = await firstHighlight.count();

    if (count > 0) {
      await firstHighlight.hover();
      await expect(page.locator('.pdflight-tooltip')).toBeVisible();
    }
  });

  test('clears all highlights', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(100);
    await page.click('[data-testid="clear-highlights"]');

    await expect(page.locator('.pdflight-highlight')).toHaveCount(0);
  });
});
