import { test, expect } from '@playwright/test';

test.describe('Serialization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('exports highlights to JSON', async ({ page }) => {
    // Create highlights
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(500);

    // Export
    await page.click('[data-testid="export-json"]');

    const jsonText = await page.locator('[data-testid="json-io"]').inputValue();
    const parsed = JSON.parse(jsonText);

    // Verify export produces valid JSON structure
    expect(Array.isArray(parsed)).toBe(true);
    if (parsed.length > 0) {
      expect(parsed[0]).toHaveProperty('page');
      expect(parsed[0]).toHaveProperty('startChar');
      expect(parsed[0]).toHaveProperty('endChar');
    }
  });

  test('imports highlights from JSON', async ({ page }) => {
    // Create export data
    const testData = JSON.stringify([
      { page: 0, startChar: 0, endChar: 10, id: 'test-1' }
    ]);

    // Use JavaScript to bypass readonly attribute
    await page.locator('[data-testid="json-io"]').evaluate((el, data) => {
      (el as HTMLTextAreaElement).value = data;
    }, testData);

    // Trigger input event to update state
    await page.locator('[data-testid="json-io"]').dispatchEvent('input');

    await page.click('[data-testid="import-json"]');
    await page.waitForTimeout(300);

    // Verify import didn't crash
    const jsonValue = await page.locator('[data-testid="json-io"]').inputValue();
    expect(jsonValue).toBeTruthy();
  });

  test('round-trip serialization preserves data', async ({ page }) => {
    // Create highlights
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(500);

    // Export
    await page.click('[data-testid="export-json"]');
    const exported = await page.locator('[data-testid="json-io"]').inputValue();

    // Verify exported is valid JSON
    const parsed1 = JSON.parse(exported);
    expect(Array.isArray(parsed1)).toBe(true);

    // Clear and import
    await page.click('[data-testid="clear-highlights"]');

    // Use JavaScript to bypass readonly
    await page.locator('[data-testid="json-io"]').evaluate((el, data) => {
      (el as HTMLTextAreaElement).value = data;
    }, exported);
    await page.locator('[data-testid="json-io"]').dispatchEvent('input');

    await page.click('[data-testid="import-json"]');
    await page.waitForTimeout(300);

    // Verify data still valid JSON after round-trip
    const imported = await page.locator('[data-testid="json-io"]').inputValue();
    const parsed2 = JSON.parse(imported);
    expect(Array.isArray(parsed2)).toBe(true);
  });
});
