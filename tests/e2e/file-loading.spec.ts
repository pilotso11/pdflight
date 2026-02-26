import { test, expect } from '@playwright/test';
import { join } from 'path';

test.describe('File Loading', () => {
  test('loads PDF via file picker', async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('[data-testid="file-input"]');
    const filePath = join(process.cwd(), 'tests/fixtures/file-sample_150kB.pdf');

    await fileInput.setInputFiles(filePath);
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });

    const canvasCount = await page.locator('[data-testid="pdf-viewer"] canvas').count();
    expect(canvasCount).toBeGreaterThan(0);
  });

  test('loads all fixture PDFs without errors', async ({ page }) => {
    await page.goto('/');

    const fixtures = ['file-sample_150kB.pdf', 'pdf-sample2.pdf'];

    for (const fixture of fixtures) {
      await page.selectOption('[data-testid="demo-pdf-select"]', fixture);
      await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });

      const canvasCount = await page.locator('[data-testid="pdf-viewer"] canvas').count();
      expect(canvasCount).toBeGreaterThan(0);
    }
  });

  test('handles large PDFs', async ({ page }) => {
    await page.goto('/');

    // Use file picker for the large PDF since it's not in dropdown
    const fileInput = page.locator('[data-testid="file-input"]');
    const filePath = join(process.cwd(), 'tests/fixtures/Free_Test_Data_1MB_PDF.pdf');

    await fileInput.setInputFiles(filePath);
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 15000 });

    const canvasCount = await page.locator('[data-testid="pdf-viewer"] canvas').count();
    expect(canvasCount).toBeGreaterThan(0);
  });
});
