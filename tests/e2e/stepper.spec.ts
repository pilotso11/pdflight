import { test, expect } from '@playwright/test';

test.describe('Page Stepper', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('navigates to next page', async ({ page }) => {
    const nextBtn = page.locator('.pdflight-toolbar-btn[title="Next page"]');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();
    await expect(page.locator('.pdflight-toolbar-page-info')).toHaveText('Page 2 of 4');
  });

  test('navigates to previous page', async ({ page }) => {
    // Go to page 2 first
    await page.click('.pdflight-toolbar-btn[title="Next page"]');
    await expect(page.locator('.pdflight-toolbar-page-info')).toHaveText('Page 2 of 4');

    // Go back
    const prevBtn = page.locator('.pdflight-toolbar-btn[title="Previous page"]');
    await prevBtn.click();
    await expect(page.locator('.pdflight-toolbar-page-info')).toHaveText('Page 1 of 4');
  });

  test('prev button stays on page 1 when already on first page', async ({ page }) => {
    await page.click('.pdflight-toolbar-btn[title="Previous page"]');
    await expect(page.locator('.pdflight-toolbar-page-info')).toHaveText('Page 1 of 4');
  });

  test('shows accurate page count', async ({ page }) => {
    const pageInfo = await page.locator('.pdflight-toolbar-page-info').textContent();
    expect(pageInfo).toMatch(/Page \d+ of \d+/);
  });
});
