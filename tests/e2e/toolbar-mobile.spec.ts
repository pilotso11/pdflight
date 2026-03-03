import { test, expect } from '@playwright/test';

test.describe('Toolbar on mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Expand the controls drawer to access settings
    const controlsPanel = page.locator('#controls-panel');
    if (await controlsPanel.evaluate(el => el.classList.contains('collapsed'))) {
      await page.click('[data-testid="controls-toggle"]');
    }
    await page.click('[data-testid="sidebar-toggle"]');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
    // Collapse drawer and hide header so PDF + toolbar fill the screen
    await page.click('[data-testid="controls-toggle"]');
    await page.evaluate(() => {
      const header = document.querySelector('.toolbar');
      if (header) (header as HTMLElement).style.display = 'none';
    });
  });

  test('toolbar wraps to multiple rows on narrow viewport', async ({ page }) => {
    const toolbar = page.locator('[data-testid="pdflight-toolbar"]');
    await expect(toolbar).toBeVisible();

    const info = await toolbar.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const groups = el.querySelectorAll('.pdflight-toolbar-group');
      const groupTops = new Set(Array.from(groups).map(g => Math.round(g.getBoundingClientRect().top)));
      return {
        width: rect.width,
        height: rect.height,
        rowCount: groupTops.size,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });

    // Toolbar should wrap into multiple rows (not overflow horizontally)
    expect(info.rowCount).toBeGreaterThan(1);
    // Content should not overflow the toolbar width
    expect(info.scrollWidth).toBeLessThanOrEqual(info.clientWidth + 2);
    // Toolbar height should grow to accommodate wrapped rows
    expect(info.height).toBeGreaterThan(40);
  });

  test('all toolbar groups are visible on screen', async ({ page }) => {
    const toolbar = page.locator('[data-testid="pdflight-toolbar"]');
    const groupsVisible = await toolbar.evaluate(el => {
      const groups = el.querySelectorAll('.pdflight-toolbar-group');
      const viewportWidth = window.innerWidth;
      return Array.from(groups).every(g => {
        const rect = g.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= viewportWidth + 1;
      });
    });
    expect(groupsVisible).toBe(true);
  });

  test('toolbar buttons remain functional on mobile', async ({ page }) => {
    const pageInfo = page.locator('.pdflight-toolbar-page-info');
    await expect(pageInfo).toHaveText('Page 1 of 4');

    const nextBtn = page.locator('.pdflight-toolbar-btn[title="Next page"]');
    await nextBtn.click();
    await expect(pageInfo).toHaveText('Page 2 of 4');

    const prevBtn = page.locator('.pdflight-toolbar-btn[title="Previous page"]');
    await prevBtn.click();
    await expect(pageInfo).toHaveText('Page 1 of 4');
  });

  test('zoom controls work on mobile', async ({ page }) => {
    const zoomLevel = page.locator('.pdflight-toolbar-zoom-level');
    const initial = await zoomLevel.textContent();

    await page.click('.pdflight-toolbar-btn[title="Zoom in"]');
    await page.waitForSelector('.pdflight-page-container', { timeout: 5000 });

    const updated = await zoomLevel.textContent();
    expect(parseInt(updated!)).toBeGreaterThan(parseInt(initial!));
  });
});
