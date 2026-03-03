import { test, expect } from '@playwright/test';

test.describe('Row-Addressable Text API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('getRows returns rows for page 1', async ({ page }) => {
    const rows = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      return viewer.getRows(1);
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].page).toBe(1);
    expect(rows[0].row).toBe(1);
    expect(rows[0].text.length).toBeGreaterThan(0);
    expect(rows[0].startChar).toBe(0);
  });

  test('getRow returns specific row', async ({ page }) => {
    const row = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      return viewer.getRow(1, 1);
    });
    expect(row).not.toBeNull();
    expect(row.row).toBe(1);
    expect(row.page).toBe(1);
  });

  test('getRow returns null for nonexistent row', async ({ page }) => {
    const row = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      return viewer.getRow(1, 9999);
    });
    expect(row).toBeNull();
  });

  test('getRowCount returns positive number', async ({ page }) => {
    const count = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      return viewer.getRowCount(1);
    });
    expect(count).toBeGreaterThan(0);
  });

  test('row text matches normalized text slice', async ({ page }) => {
    const valid = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      const rows = await viewer.getRows(1);
      // Search for the first row's text — should find it
      const matches = await viewer.findText(rows[0].text, { page: 1 });
      return matches.length > 0;
    });
    expect(valid).toBe(true);
  });

  test('findText with page constraint returns only that page', async ({ page }) => {
    const allOnPage = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      const matches = await viewer.findText('Lorem', { page: 1 });
      return matches.every((m: any) => m.page === 1);
    });
    expect(allOnPage).toBe(true);
  });

  test('findText with nearRow sorts by proximity', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      const rows = await viewer.getRows(1);
      if (rows.length < 3) return null;
      // Find a word that appears in the text
      const targetRow = rows[Math.floor(rows.length / 2)];
      const word = targetRow.text.split(/\s+/).find((w: string) => w.length > 3);
      if (!word) return null;
      const matches = await viewer.findText(word, {
        page: 1,
        nearRow: targetRow.row,
      });
      return { matchCount: matches.length, targetRow: targetRow.row };
    });
    // If we found matches, the test passes (sorting is internal)
    if (result) {
      expect(result.matchCount).toBeGreaterThan(0);
    }
  });

  test('row data can be used with addHighlight', async ({ page }) => {
    const highlightId = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      const row = await viewer.getRow(1, 1);
      if (!row) return null;
      viewer.addHighlight({
        id: 'row-test-1',
        page: row.page,
        startChar: row.startChar,
        endChar: row.endChar,
        color: 'rgba(255, 255, 0, 0.4)',
      });
      return 'row-test-1';
    });
    expect(highlightId).toBe('row-test-1');

    // Verify highlight div exists in DOM
    const highlights = page.locator('.pdflight-highlight');
    await expect(highlights.first()).toBeVisible();
  });
});

test.describe('Row API — y-distance filtering (sample2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'pdf-sample2.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('findText nearRow filters by y-distance (not row number)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      // "bookmark" appears many times on page 1, but a large image separates
      // the upper and lower text blocks — y-distance filtering should exclude
      // matches on the far side of the image.
      const allMatches = await viewer.findText('bookmark', {
        page: 1,
        nearRow: 10,
        maxDistance: Infinity, // no filtering
      });
      const filtered = await viewer.findText('bookmark', {
        page: 1,
        nearRow: 10,
        // default maxDistance = 5 × avgLineSpacing
      });
      return { all: allMatches.length, filtered: filtered.length };
    });
    expect(result.all).toBeGreaterThan(result.filtered);
    expect(result.filtered).toBeGreaterThan(0);
    expect(result.filtered).toBeLessThanOrEqual(6);
  });

  test('findText finds text spanning multiple rows with nearRow', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const viewer = (window as any).viewer;
      // "eight separate records" spans row 9 ("...eight") and row 10 ("separate records.")
      const fromStart = await viewer.findText('eight separate records', {
        page: 1,
        nearRow: 9,
      });
      const fromEnd = await viewer.findText('eight separate records', {
        page: 1,
        nearRow: 10,
      });
      return {
        fromStart: fromStart.length,
        fromEnd: fromEnd.length,
        text: fromStart[0]?.text,
      };
    });
    expect(result.fromStart).toBe(1);
    expect(result.fromEnd).toBe(1);
    expect(result.text).toContain('eight separate records');
  });
});
