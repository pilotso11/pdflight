import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('zooms in and out', async ({ page }) => {
    const initialZoom = await page.locator('[data-testid="zoom-level"]').textContent();
    await page.click('[data-testid="zoom-in"]');
    const zoomedIn = await page.locator('[data-testid="zoom-level"]').textContent();
    expect(parseInt(zoomedIn!)).toBeGreaterThan(parseInt(initialZoom!));
  });

  test('shows and hides sidebar', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await page.uncheck('[data-testid="sidebar-toggle"]');
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
  });

  test('shows and hides page stepper', async ({ page }) => {
    await page.check('[data-testid="stepper-toggle"]');
    await expect(page.locator('[data-testid="page-stepper"]')).toBeVisible();
  });
});
