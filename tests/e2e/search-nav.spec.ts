import { test, expect } from '@playwright/test';

test.describe('Search Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('search shows counter and next advances', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'Lorem');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).toHaveText('17 matches');

    // After search, auto-nextMatch should set counter to 1/17
    const counter = page.locator('[data-testid="match-counter"]');
    await expect(counter).toHaveText('1/17');

    // Click next to advance
    await page.click('[data-testid="next-match"]');
    await expect(counter).toHaveText('2/17');
  });

  test('prev wraps around from first match', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'Lorem');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="search-results"]')).toHaveText('17 matches');

    const counter = page.locator('[data-testid="match-counter"]');
    await expect(counter).toHaveText('1/17');

    // Click prev — should wrap to last match (17/17)
    await page.click('[data-testid="prev-match"]');
    await expect(counter).toHaveText('17/17');
  });

  test('buttons disabled with no search results', async ({ page }) => {
    // Before any search, buttons should be disabled
    await expect(page.locator('[data-testid="prev-match"]')).toBeDisabled();
    await expect(page.locator('[data-testid="next-match"]')).toBeDisabled();

    // Search for nonexistent text
    await page.fill('[data-testid="search-input"]', 'xyznonexistent999');
    await page.click('[data-testid="search-btn"]');

    await expect(page.locator('[data-testid="prev-match"]')).toBeDisabled();
    await expect(page.locator('[data-testid="next-match"]')).toBeDisabled();
    await expect(page.locator('[data-testid="match-counter"]')).toHaveText('0/0');
  });

  test('new search resets match navigation', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'Lorem');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="match-counter"]')).toHaveText('1/17');

    // Advance a few times
    await page.click('[data-testid="next-match"]');
    await expect(page.locator('[data-testid="match-counter"]')).toHaveText('2/17');

    // New search should reset to 1/N
    await page.fill('[data-testid="search-input"]', 'odio');
    await page.click('[data-testid="search-btn"]');
    const counter = page.locator('[data-testid="match-counter"]');
    const text = await counter.textContent();
    expect(text).toMatch(/^1\/\d+$/);
  });

  test('toolbar searchNav section visible by default', async ({ page }) => {
    // searchNav checkbox is now checked by default — no need to enable it
    // Toolbar should have match-info element visible without Apply
    await expect(page.locator('[data-testid="match-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="prev-match-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="next-match-btn"]')).toBeVisible();
  });

  test('active match scrolls into view after nextMatch', async ({ page }) => {
    // Use fit-width mode so the page is tall and some matches are off-screen
    await page.selectOption('[data-testid="cfg-fit-mode"]', 'width');
    await page.click('[data-testid="apply-config"]');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });

    await page.fill('[data-testid="search-input"]', 'Lorem');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="match-counter"]')).toHaveText('1/17');

    // Navigate to a later match that's likely off-screen
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="next-match"]');
    }
    await expect(page.locator('[data-testid="match-counter"]')).toHaveText('6/17');

    // The active highlight element should be visible in the viewport
    const activeEl = page.locator('.pdflight-highlight[data-highlight-id="__pdflight_active_match__"]').first();
    await expect(activeEl).toBeVisible();
    await expect(activeEl).toBeInViewport();
  });

  test('outline mode renders border instead of background', async ({ page }) => {
    // Default mode is outline — search and check the active match element
    await page.fill('[data-testid="search-input"]', 'Lorem');
    await page.click('[data-testid="search-btn"]');
    await expect(page.locator('[data-testid="match-counter"]')).toHaveText('1/17');

    const activeEl = page.locator('.pdflight-highlight[data-highlight-id="__pdflight_active_match__"]').first();
    await expect(activeEl).toBeVisible();

    // Outline mode: should have border, transparent background
    const styles = await activeEl.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        borderStyle: cs.borderStyle,
        borderWidth: cs.borderWidth,
        backgroundColor: cs.backgroundColor,
      };
    });
    expect(styles.borderStyle).not.toBe('none');
    expect(styles.borderWidth).not.toBe('0px');
    expect(styles.backgroundColor).toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
  });
});
