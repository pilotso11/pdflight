import { test, expect } from '@playwright/test';

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('shows thumbnail canvases when sidebar is enabled', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');

    // Wait for at least one thumbnail canvas to render (lazy loading)
    await page.waitForSelector('[data-testid="thumbnails"] canvas', { timeout: 5000 });

    // Verify sidebar is visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

    // Verify thumbnail canvases rendered for visible pages
    const canvases = page.locator('[data-testid="thumbnails"] canvas');
    expect(await canvases.count()).toBeGreaterThanOrEqual(1);
  });

  test('renders page number labels', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');
    await page.waitForSelector('[data-testid="thumbnails"] canvas', { timeout: 5000 });

    // Check that page labels exist
    const labels = page.locator('.pdflight-thumbnail-label');
    expect(await labels.count()).toBe(4); // 4-page PDF

    // First label should say "1"
    await expect(labels.first()).toHaveText('1');
  });

  test('navigates to page on thumbnail click', async ({ page }) => {
    // Enable stepper to see page info
    await page.check('[data-testid="stepper-toggle"]');
    await page.check('[data-testid="sidebar-toggle"]');
    await page.waitForSelector('[data-testid="thumbnails"] canvas', { timeout: 5000 });

    // Initial state: page 1
    await expect(page.locator('[data-testid="page-info"]')).toHaveText('Page 1 of 4');

    // Click the second thumbnail
    const secondThumbnail = page.locator('[data-testid="thumbnails"] canvas').nth(1);
    await secondThumbnail.click();

    // Wait for page to change
    await expect(page.locator('[data-testid="page-info"]')).toHaveText('Page 2 of 4');
  });

  test('highlights active page thumbnail', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');
    await page.waitForSelector('[data-testid="thumbnails"] canvas', { timeout: 5000 });

    // Page 1 thumbnail should be active initially
    const firstThumb = page.locator('.pdflight-thumbnail').first();
    await expect(firstThumb).toHaveClass(/pdflight-thumbnail-active/);

    // Click page 2 thumbnail
    const secondThumb = page.locator('.pdflight-thumbnail').nth(1);
    await page.locator('[data-testid="thumbnails"] canvas').nth(1).click();

    // Wait for navigation
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 5000 });

    // Page 2 should now be active, page 1 should not
    await expect(secondThumb).toHaveClass(/pdflight-thumbnail-active/);
    await expect(firstThumb).not.toHaveClass(/pdflight-thumbnail-active/);
  });

  test('search shows gray match count badges without highlighting', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');
    await page.waitForSelector('[data-testid="thumbnails"] canvas', { timeout: 5000 });

    // Search without highlighting
    await page.fill('[data-testid="search-input"]', 'lorem');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).toHaveText('17 matches');

    // Gray badges should appear (match counts)
    const badges = page.locator('.pdflight-thumbnail-badge');
    await expect(badges).toHaveCount(3);

    // Correct per-page counts
    await expect(page.locator('.pdflight-thumbnail').nth(0).locator('.pdflight-thumbnail-badge')).toHaveText('4');
    await expect(page.locator('.pdflight-thumbnail').nth(1).locator('.pdflight-thumbnail-badge')).toHaveText('8');
    await expect(page.locator('.pdflight-thumbnail').nth(2).locator('.pdflight-thumbnail-badge')).toHaveText('5');

    // No edge bars without highlights
    await expect(page.locator('.pdflight-thumbnail-edge-bar')).toHaveCount(0);
  });

  test('highlighting adds edge bars and changes badge color', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');
    await page.waitForSelector('[data-testid="thumbnails"] canvas', { timeout: 5000 });

    // Search and highlight all
    await page.fill('[data-testid="search-input"]', 'lorem');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).toHaveText('17 matches');
    await page.click('[data-testid="highlight-all"]');

    // Edge bars should appear on highlighted pages
    await expect(page.locator('.pdflight-thumbnail-edge-bar')).toHaveCount(3);

    // Badges still present with correct counts
    await expect(page.locator('.pdflight-thumbnail-badge')).toHaveCount(3);

    // Page 4 should have no indicators
    const page4Thumb = page.locator('.pdflight-thumbnail').nth(3);
    await expect(page4Thumb.locator('.pdflight-thumbnail-edge-bar')).toHaveCount(0);
    await expect(page4Thumb.locator('.pdflight-thumbnail-badge')).toHaveCount(0);
  });

  test('clearing highlights reverts badges to gray match counts', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');
    await page.waitForSelector('[data-testid="thumbnails"] canvas', { timeout: 5000 });

    // Search and highlight
    await page.fill('[data-testid="search-input"]', 'lorem');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).toHaveText('17 matches');
    await page.click('[data-testid="highlight-all"]');

    // Wait for highlight indicators
    await expect(page.locator('.pdflight-thumbnail-edge-bar').first()).toBeVisible();

    // Clear highlights
    await page.click('[data-testid="clear-highlights"]');

    // Edge bars should be gone (no highlights)
    await expect(page.locator('.pdflight-thumbnail-edge-bar')).toHaveCount(0);

    // Gray badges should remain (match counts persist from search)
    await expect(page.locator('.pdflight-thumbnail-badge')).toHaveCount(3);
    await expect(page.locator('.pdflight-thumbnail').nth(0).locator('.pdflight-thumbnail-badge')).toHaveText('4');
  });
});
