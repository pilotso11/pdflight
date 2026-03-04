import { test, expect } from '@playwright/test';

test.describe('Rotated Text Highlights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'rotated-wordcloud.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('search finds non-rotated text in word cloud', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'Python');
    await page.click('[data-testid="search-btn"]');

    const resultText = await page.locator('[data-testid="search-results"]').textContent();
    const count = parseInt(resultText?.match(/\d+/)?.[0] ?? '0');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('highlights render on non-rotated word cloud text', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'AI');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(200);

    const highlights = page.locator('.pdflight-highlight');
    await expect(highlights.first()).toBeVisible();
  });

  test('search finds rotated text items (90° rotation)', async ({ page }) => {
    // "LLM", "Git", "Rust" have 90° rotated transforms in this word cloud
    await page.fill('[data-testid="search-input"]', 'LLM');
    await page.click('[data-testid="search-btn"]');

    const resultText = await page.locator('[data-testid="search-results"]').textContent();
    const count = parseInt(resultText?.match(/\d+/)?.[0] ?? '0');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('highlights on rotated text have reasonable dimensions', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'TypeScript');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(200);

    const highlights = page.locator('.pdflight-highlight');
    const count = await highlights.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify highlight rects have reasonable dimensions (not collapsed to 0)
    // Small rotated text items can be as short as ~2.5px tall
    for (let i = 0; i < count; i++) {
      const box = await highlights.nth(i).boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(2);
        expect(box.height).toBeGreaterThan(2);
      }
    }
  });

  test('rotated text highlights have CSS transform rotation', async ({ page }) => {
    // "LLM" has a 90° rotated transform in the word cloud PDF
    await page.fill('[data-testid="search-input"]', 'LLM');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(200);

    const highlights = page.locator('.pdflight-highlight');
    const count = await highlights.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // At least one highlight should have a CSS rotate transform
    let hasRotated = false;
    for (let i = 0; i < count; i++) {
      const transform = await highlights.nth(i).evaluate(
        (el) => window.getComputedStyle(el).transform,
      );
      // CSS computed transform is a matrix() when rotation is applied
      // 'none' means no rotation
      if (transform && transform !== 'none') {
        hasRotated = true;
        // Also verify transform-origin is 0 0
        const origin = await highlights.nth(i).evaluate(
          (el) => window.getComputedStyle(el).transformOrigin,
        );
        expect(origin).toContain('0');
      }
    }
    expect(hasRotated).toBe(true);
  });

});

test.describe('Diagonal Text Highlights (word-cloud2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'word-cloud2.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('search finds diagonal text', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'Python');
    await page.click('[data-testid="search-btn"]');

    const resultText = await page.locator('[data-testid="search-results"]').textContent();
    const count = parseInt(resultText?.match(/\d+/)?.[0] ?? '0');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('diagonal text highlights have non-90° CSS rotation', async ({ page }) => {
    // "Python" is at ~45° in this word cloud
    await page.fill('[data-testid="search-input"]', 'Python');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(200);

    const highlights = page.locator('.pdflight-highlight');
    const count = await highlights.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify the highlight has a non-trivial rotation (not 0° or 90°)
    const transform = await highlights.first().evaluate(
      (el) => el.style.transform,
    );
    expect(transform).toMatch(/rotate\(.+deg\)/);
    // Extract angle and verify it's diagonal (not axis-aligned)
    const angle = parseFloat(transform.match(/rotate\((.+)deg\)/)?.[1] ?? '0');
    expect(Math.abs(angle)).toBeGreaterThan(10);
    expect(Math.abs(angle)).toBeLessThan(80);
  });

  test('highlights on diagonal text have reasonable dimensions', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'Docker');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(200);

    const highlights = page.locator('.pdflight-highlight');
    const count = await highlights.count();
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const box = await highlights.nth(i).boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(5);
        expect(box.height).toBeGreaterThan(3);
      }
    }
  });

  test('multiple diagonal words highlight simultaneously', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'AI');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.waitForTimeout(200);

    const highlights = page.locator('.pdflight-highlight');
    await expect(highlights.first()).toBeVisible();
  });
});
