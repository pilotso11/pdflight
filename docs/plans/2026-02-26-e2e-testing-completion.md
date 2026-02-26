# E2E Testing Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Playwright E2E test coverage for pdflight PDF viewer library to achieve comprehensive browser-based testing of all public API features and demo app functionality.

**Architecture:** Playwright tests run against the demo app (localhost:5173), testing user interactions end-to-end. Tests verify both visual rendering (screenshots) and functional behavior (DOM manipulation, API calls).

**Tech Stack:** Playwright (@playwright/test), TypeScript, Vitest for unit tests (already at 90%+ coverage)

---

## Current State Assessment

### ✅ Existing E2E Tests (6 files)

| Test File | Coverage | Quality |
|-----------|----------|---------|
| `search.spec.ts` | Basic search text matching, case-insensitive | ⚠️ Minimal - 2 tests only |
| `highlight.spec.ts` | Apply/clear highlights, tooltips, screenshot tests | ⚠️ Partial - missing zoom survival, overlap verification |
| `navigation.spec.ts` | Zoom in/out, sidebar/stepper toggles | ⚠️ Minimal - 3 tests only |
| `simple.spec.ts` | PDF load and render | ✅ Good - basic smoke test |
| `module-test.spec.ts` | Module loading verification | ⚠️ Debug/diagnostic only |
| `debug.spec.ts` | Page load debugging | ⚠️ Debug/diagnostic only |

### ❌ Missing E2E Coverage (High Priority)

**Search Features:**
- Cross-item text matching (pdf.js text fragmentation)
- Hyphenated word handling
- Subscript/superscript detection
- Empty search results
- Special characters and Unicode
- Multiple search terms in sequence

**Highlight Features:**
- Highlight survival through zoom changes
- Highlight survival through pan/scroll
- Highlight survival through resize
- Overlapping highlight visual verification
- Highlight color customization
- Multi-page highlighting
- Partial item highlighting (start/mid/end of item)

**Navigation Features:**
- Pan (drag to move)
- Fit-to-width mode
- Fit-to-page mode
- Programmatic goToPage() navigation
- Scroll position maintenance
- Keyboard navigation (if implemented)

**Sidebar Features:**
- Thumbnail rendering
- Thumbnail click navigation
- Thumbnail active state
- Multi-page PDF thumbnails

**Page Stepper Features:**
- Previous page button
- Next page button
- Page counter accuracy
- Disable at first/last page

**Serialization:**
- Export highlights to JSON
- Import highlights from JSON
- Round-trip data integrity
- Highlight persistence across PDF reload

**File Loading:**
- Load PDF via file picker
- Load different PDF fixtures
- Load large PDFs (1MB+)
- Handle malformed PDFs gracefully

**Edge Cases:**
- Search with no results
- Search on empty document
- Highlight with no search results
- Zoom to min/max limits
- Rapid zoom changes
- Concurrent operations

---

## Implementation Plan

### Task 1: Enhance Search Tests

**Files:**
- Modify: `tests/e2e/search.spec.ts`

**Step 1: Add test for hyphenated word handling**
```typescript
test('handles hyphenated words across line breaks', async ({ page }) => {
  await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
  await page.waitForSelector('[data-testid="pdf-viewer"] canvas');

  // Search for words that may be hyphenated in the PDF
  await page.fill('[data-testid="search-input"]', 'document');
  await page.click('[data-testid="search-btn"]');
  await expect(page.locator('[data-testid="search-results"]')).toContainText('match');
});
```

**Step 2: Add test for empty search results**
```typescript
test('shows no results for non-existent text', async ({ page }) => {
  await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
  await page.waitForSelector('[data-testid="pdf-viewer"] canvas');

  await page.fill('[data-testid="search-input"]', 'xyzabc123nonexistent');
  await page.click('[data-testid="search-btn"]');
  await expect(page.locator('[data-testid="search-results"]')).toContainText('0 match');
});
```

**Step 3: Add test for special characters**
```typescript
test('handles special characters in search', async ({ page }) => {
  await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
  await page.waitForSelector('[data-testid="pdf-viewer"] canvas');

  await page.fill('[data-testid="search-input"]', '@#$%');
  await page.click('[data-testid="search-btn"]');
  // Should handle gracefully without errors
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
});
```

**Step 4: Run tests**
```bash
bunx playwright test tests/e2e/search.spec.ts
```

**Step 5: Commit**
```bash
git add tests/e2e/search.spec.ts
git commit -m "test(e2e): enhance search test coverage"
```

---

### Task 2: Complete Navigation Tests

**Files:**
- Modify: `tests/e2e/navigation.spec.ts`

**Step 1: Add pan/drag test**
```typescript
test('pans document by dragging', async ({ page }) => {
  await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
  await page.waitForSelector('[data-testid="pdf-viewer"] canvas');

  const viewer = page.locator('[data-testid="pdf-viewer"]');
  const canvas = viewer.locator('canvas').first();

  // Get initial scroll position
  const initialScrollX = await viewer.evaluate(el => el.scrollLeft);
  const initialScrollY = await viewer.evaluate(el => el.scrollTop);

  // Drag to pan
  await canvas.hover();
  await page.mouse.down();
  await page.mouse.move(100, 100);
  await page.mouse.up();

  // Verify scroll position changed
  const finalScrollX = await viewer.evaluate(el => el.scrollLeft);
  const finalScrollY = await viewer.evaluate(el => el.scrollTop);

  expect(Math.abs(finalScrollX - initialScrollX) + Math.abs(finalScrollY - initialScrollY)).toBeGreaterThan(0);
});
```

**Step 2: Add fit-to-width test**
```typescript
test('switches to fit-to-width mode', async ({ page }) => {
  await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
  await page.waitForSelector('[data-testid="pdf-viewer"] canvas');

  await page.selectOption('[data-testid="fit-mode"]', 'width');

  // Take screenshot for visual verification
  const viewer = page.locator('[data-testid="pdf-viewer"]');
  await viewer.screenshot({ path: 'tests/screenshots/fit-width.png' });
});
```

**Step 3: Add fit-to-page test**
```typescript
test('switches to fit-to-page mode', async ({ page }) => {
  await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
  await page.waitForSelector('[data-testid="pdf-viewer"] canvas');

  await page.selectOption('[data-testid="fit-mode"]', 'page');

  const viewer = page.locator('[data-testid="pdf-viewer"]');
  await viewer.screenshot({ path: 'tests/screenshots/fit-page.png' });
});
```

**Step 4: Run tests**
```bash
bunx playwright test tests/e2e/navigation.spec.ts
```

**Step 5: Commit**
```bash
git add tests/e2e/navigation.spec.ts
git commit -m "test(e2e): complete navigation test coverage"
```

---

### Task 3: Create Page Stepper Tests

**Files:**
- Create: `tests/e2e/stepper.spec.ts`

**Step 1: Create stepper test file**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Page Stepper', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
    await page.check('[data-testid="stepper-toggle"]');
  });

  test('navigates to next page', async ({ page }) => {
    const initialPage = await page.locator('[data-testid="page-info"]').textContent();
    await page.click('[data-testid="next-page"]');
    const newPage = await page.locator('[data-testid="page-info"]').textContent();
    expect(newPage).not.toBe(initialPage);
  });

  test('navigates to previous page', async ({ page }) => {
    // Go to page 2 first
    await page.click('[data-testid="next-page"]');

    const initialPage = await page.locator('[data-testid="page-info"]').textContent();
    await page.click('[data-testid="prev-page"]');
    const newPage = await page.locator('[data-testid="page-info"]').textContent();
    expect(newPage).not.toBe(initialPage);
  });

  test('disables prev button on first page', async ({ page }) => {
    const prevBtn = page.locator('[data-testid="prev-page"]');
    await expect(prevBtn).toBeDisabled();
  });

  test('shows accurate page count', async ({ page }) => {
    const pageInfo = await page.locator('[data-testid="page-info"]').textContent();
    expect(pageInfo).toMatch(/Page \d+ of \d+/);
  });
});
```

**Step 2: Run tests**
```bash
bunx playwright test tests/e2e/stepper.spec.ts
```

**Step 3: Commit**
```bash
git add tests/e2e/stepper.spec.ts
git commit -m "test(e2e): add page stepper tests"
```

---

### Task 4: Create Sidebar Tests

**Files:**
- Create: `tests/e2e/sidebar.spec.ts`

**Step 1: Create sidebar test file**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 10000 });
  });

  test('shows thumbnails when enabled', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');

    const thumbnails = page.locator('[data-testid="thumbnails"] canvas');
    const count = await thumbnails.count();

    expect(count).toBeGreaterThan(0);
  });

  test('navigates to page on thumbnail click', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');

    const initialPage = await page.locator('[data-testid="page-info"]').textContent();

    // Click second thumbnail if exists
    const thumbnails = page.locator('[data-testid="thumbnails"] canvas');
    if (await thumbnails.count() > 1) {
      await thumbnails.nth(1).click();
      await page.waitForTimeout(500);

      const newPage = await page.locator('[data-testid="page-info"]').textContent();
      expect(newPage).not.toBe(initialPage);
    }
  });

  test('highlights active page thumbnail', async ({ page }) => {
    await page.check('[data-testid="sidebar-toggle"]');

    // Check first thumbnail has active state
    const firstThumb = page.locator('[data-testid="thumbnails"] canvas').first();
    await expect(firstThumb).toBeVisible();
  });
});
```

**Step 2: Run tests**
```bash
bunx playwright test tests/e2e/sidebar.spec.ts
```

**Step 3: Commit**
```bash
git add tests/e2e/sidebar.spec.ts
git commit -m "test(e2e): add sidebar tests"
```

---

### Task 5: Enhance Highlight Tests

**Files:**
- Modify: `tests/e2e/highlight.spec.ts`

**Step 1: Add highlight survival through zoom**
```typescript
test('highlights persist through zoom changes', async ({ page }) => {
  await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
  await page.waitForSelector('[data-testid="pdf-viewer"] canvas');

  // Create highlights
  await page.fill('[data-testid="search-input"]', 'PDF');
  await page.click('[data-testid="search-btn"]');
  await page.click('[data-testid="highlight-all"]');

  const initialCount = await page.locator('.pdflight-highlight').count();

  // Zoom in
  await page.click('[data-testid="zoom-in"]');
  await page.waitForTimeout(500);

  // Verify highlights still exist and repositioned
  const afterZoomCount = await page.locator('.pdflight-highlight').count();
  expect(afterZoomCount).toBe(initialCount);
});
```

**Step 2: Add highlight color change test**
```typescript
test('changes highlight color', async ({ page }) => {
  await page.selectOption('[data-testid="demo-pdf-select"]', 'file-sample_150kB.pdf');
  await page.waitForSelector('[data-testid="pdf-viewer"] canvas');

  // Apply yellow highlights
  await page.fill('[data-testid="search-input"]', 'PDF');
  await page.click('[data-testid="search-btn"]');
  await page.click('[data-testid="highlight-all"]');

  const initialColor = await page.locator('.pdflight-highlight').first().evaluate(el => {
    return window.getComputedStyle(el).backgroundColor;
  });

  // Change to red
  await page.fill('[data-testid="highlight-color"]', '#ff0000');
  await page.click('[data-testid="highlight-all"]');

  const newColor = await page.locator('.pdflight-highlight').first().evaluate(el => {
    return window.getComputedStyle(el).backgroundColor;
  });

  expect(newColor).not.toBe(initialColor);
});
```

**Step 3: Run tests**
```bash
bunx playwright test tests/e2e/highlight.spec.ts
```

**Step 4: Commit**
```bash
git add tests/e2e/highlight.spec.ts
git commit -m "test(e2e): enhance highlight tests"
```

---

### Task 6: Create Serialization Tests

**Files:**
- Create: `tests/e2e/serialization.spec.ts`

**Step 1: Create serialization test file**
```typescript
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

    // Export
    await page.click('[data-testid="export-json"]');

    const jsonText = await page.locator('[data-testid="json-io"]').inputValue();
    const parsed = JSON.parse(jsonText);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0]).toHaveProperty('page');
    expect(parsed[0]).toHaveProperty('startChar');
    expect(parsed[0]).toHaveProperty('endChar');
  });

  test('imports highlights from JSON', async ({ page }) => {
    // Create export data
    const testData = JSON.stringify([
      { page: 0, startChar: 0, endChar: 10, id: 'test-1' }
    ]);

    // Import
    await page.locator('[data-testid="json-io"]').fill(testData);
    await page.click('[data-testid="import-json"]');

    // Verify highlights appear
    await page.waitForTimeout(500);
    const highlights = page.locator('.pdflight-highlight');
    await expect(highlights).toHaveCount(1);
  });

  test('round-trip serialization preserves data', async ({ page }) => {
    // Create highlights
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');

    // Export
    await page.click('[data-testid="export-json"]');
    const exported = await page.locator('[data-testid="json-io"]').inputValue();

    // Clear and import
    await page.click('[data-testid="clear-highlights"]');
    await page.locator('[data-testid="json-io"]').fill(exported);
    await page.click('[data-testid="import-json"]');

    // Verify
    const initialCount = JSON.parse(exported).length;
    const finalCount = await page.locator('.pdflight-highlight').count();
    expect(finalCount).toBeGreaterThanOrEqual(initialCount);
  });
});
```

**Step 2: Run tests**
```bash
bunx playwright test tests/e2e/serialization.spec.ts
```

**Step 3: Commit**
```bash
git add tests/e2e/serialization.spec.ts
git commit -m "test(e2e): add serialization tests"
```

---

### Task 7: Create File Loading Tests

**Files:**
- Create: `tests/e2e/file-loading.spec.ts`

**Step 1: Create file loading test file**
```typescript
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
    await page.selectOption('[data-testid="demo-pdf-select"]', 'Free_Test_Data_1MB_PDF.pdf');

    await page.waitForSelector('[data-testid="pdf-viewer"] canvas', { timeout: 15000 });

    const canvasCount = await page.locator('[data-testid="pdf-viewer"] canvas').count();
    expect(canvasCount).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests**
```bash
bunx playwright test tests/e2e/file-loading.spec.ts
```

**Step 3: Commit**
```bash
git add tests/e2e/file-loading.spec.ts
git commit -m "test(e2e): add file loading tests"
```

---

### Task 8: Clean Up Debug Tests

**Files:**
- Delete: `tests/e2e/module-test.spec.ts`
- Delete: `tests/e2e/debug.spec.ts`

**Step 1: Remove debug test files**
```bash
rm tests/e2e/module-test.spec.ts tests/e2e/debug.spec.ts
```

**Step 2: Run all tests to verify nothing broke**
```bash
bunx playwright test
```

**Step 3: Commit**
```bash
git add tests/e2e/
git commit -m "test(e2e): remove debug/diagnostic test files"
```

---

### Task 9: Run Full Test Suite and Generate Coverage Report

**Step 1: Run all E2E tests**
```bash
bunx playwright test
```

**Step 2: Run with HTML report**
```bash
bunx playwright test --reporter=html
```

**Step 3: Take screenshots for visual verification**
```bash
bunx playwright test --project=chromium
```

**Step 4: Verify coverage against CLAUDE.md requirements**
- Check all public API methods have E2E tests
- Check all demo app features have E2E tests
- Verify all test fixtures are used

**Step 5: Update CLAUDE.md if needed**
```bash
# Update E2E test section with final test count and coverage
```

**Step 6: Commit**
```bash
git add docs/
git commit -m "docs: update E2E testing status in CLAUDE.md"
```

---

## Success Criteria

- [ ] All new tests pass consistently
- [ ] Debug/diagnostic tests removed
- [ ] Test count increased from ~10 to 40+ tests
- [ ] All demo app features have E2E coverage
- [ ] All public API methods covered by E2E tests
- [ ] Screenshots generated for visual verification
- [ ] No flaky tests (all pass 3+ consecutive runs)
- [ ] CLAUDE.md updated with final E2E test status

---

## Test Organization

**Final E2E Test Structure:**
```
tests/e2e/
├── search.spec.ts          # Search functionality
├── highlight.spec.ts        # Highlight features
├── navigation.spec.ts       # Zoom, pan, fit modes
├── stepper.spec.ts          # Page stepper controls
├── sidebar.spec.ts          # Thumbnail sidebar
├── serialization.spec.ts    # Import/export highlights
├── file-loading.spec.ts     # PDF file loading
└── simple.spec.ts           # Basic smoke test
```

**Total: 8 test files, 40+ individual tests**
