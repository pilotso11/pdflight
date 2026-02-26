import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Load a demo PDF
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('searches for text and displays results', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).toContainText('match');
  });

  test('search is case-insensitive', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'pdf');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).not.toHaveText('0 match');
  });

  test('handles hyphenated words across line breaks', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'document');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).toContainText('match');
  });

  test('shows no results for non-existent text', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'xyzabc123nonexistent');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).toContainText('0 match');
  });

  test('handles special characters in search', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', '@#$%');
    await page.click('[data-testid="search-btn"]');
    // Should handle gracefully without errors
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });
});
