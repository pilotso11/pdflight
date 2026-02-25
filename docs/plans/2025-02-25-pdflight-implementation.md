# pdflight Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript PDF viewer library with precise text highlighting and smart search, built on pdf.js.

**Architecture:** Layered library — utilities at the bottom (geometry, text), TextIndex builds normalized searchable text from pdf.js, SearchEngine finds matches, HighlightEngine computes pixel-accurate rectangles using font metrics, PageRenderer manages the DOM layers, PdfViewer wires it all together. Demo app exercises every feature and serves as Playwright test target.

**Tech Stack:** Bun, TypeScript, Vite (library mode + dev server), pdfjs-dist, Vitest + coverage-v8, Playwright, ESLint

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.eslintrc.cjs`
- Create: `.gitignore`
- Create: `src/index.ts` (empty placeholder)

**Step 1: Create package.json**

```json
{
  "name": "pdflight",
  "version": "0.1.0",
  "type": "module",
  "description": "PDF viewer with precise text highlighting and smart search",
  "main": "./dist/pdflight.js",
  "module": "./dist/pdflight.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/pdflight.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "dev": "vite serve demo",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix",
    "typecheck": "tsc --noEmit",
    "preview": "vite preview --outDir dist-demo"
  },
  "license": "MIT",
  "devDependencies": {}
}
```

**Step 2: Install dependencies**

Run:
```bash
bun add pdfjs-dist
bun add -d typescript vite vite-plugin-dts vitest @vitest/coverage-v8 @vitest/ui @playwright/test eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin jsdom
```

Expected: `bun.lockb` created, `node_modules/` populated.

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests", "demo"]
}
```

**Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'pdflight',
      fileName: 'pdflight',
      formats: ['es'],
    },
    rollupOptions: {
      // pdfjs-dist is bundled (not externalized) per design decision
    },
  },
});
```

**Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
```

**Step 6: Create playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'bun run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
```

**Step 7: Create .eslintrc.cjs**

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
  },
};
```

**Step 8: Create .gitignore**

```
node_modules/
dist/
dist-demo/
*.log
.DS_Store
bun.lockb
coverage/
test-results/
playwright-report/
```

**Step 9: Create src/index.ts placeholder**

```typescript
// pdflight - PDF viewer with precise text highlighting and smart search
// Public API exports will be added as modules are built.
export const VERSION = '0.1.0';
```

**Step 10: Move sample PDFs to tests/fixtures/**

Run:
```bash
mkdir -p tests/fixtures
cp samples/* tests/fixtures/
```

**Step 11: Verify setup**

Run:
```bash
bun run typecheck
bun run test
bun run build
```

Expected: All three pass. Tests show 0 test suites (none written yet). Build produces `dist/pdflight.js`.

**Step 12: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Bun, Vite, Vitest, Playwright"
```

---

## Task 2: Text Utilities

**Files:**
- Create: `src/utils/text.ts`
- Create: `tests/unit/utils/text.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/utils/text.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeText, collapseWhitespace, rejoinHyphens, normalizeQuotes } from '../../src/utils/text';

describe('collapseWhitespace', () => {
  it('collapses multiple spaces to single space', () => {
    expect(collapseWhitespace('hello   world')).toBe('hello world');
  });

  it('collapses newlines and tabs to single space', () => {
    expect(collapseWhitespace('hello\n\t  world')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(collapseWhitespace('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(collapseWhitespace('')).toBe('');
  });
});

describe('rejoinHyphens', () => {
  it('rejoins hyphenated line breaks', () => {
    expect(rejoinHyphens('exam-\nple')).toBe('example');
  });

  it('rejoins hyphen at end followed by space-newline', () => {
    expect(rejoinHyphens('docu-\n ment')).toBe('document');
  });

  it('preserves legitimate hyphens', () => {
    expect(rejoinHyphens('well-known')).toBe('well-known');
  });

  it('handles multiple hyphenations', () => {
    expect(rejoinHyphens('ex-\nam-\nple')).toBe('example');
  });
});

describe('normalizeQuotes', () => {
  it('converts smart double quotes to ASCII', () => {
    expect(normalizeQuotes('\u201Chello\u201D')).toBe('"hello"');
  });

  it('converts smart single quotes to ASCII', () => {
    expect(normalizeQuotes('\u2018hello\u2019')).toBe("'hello'");
  });

  it('preserves ASCII quotes', () => {
    expect(normalizeQuotes('"hello"')).toBe('"hello"');
  });
});

describe('normalizeText', () => {
  it('applies all normalizations', () => {
    expect(normalizeText('  exam-\nple   \u201Ctest\u201D  ')).toBe('example "test"');
  });

  it('applies NFC unicode normalization', () => {
    // e + combining acute = é in NFC
    expect(normalizeText('e\u0301')).toBe('\u00E9');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/unit/utils/text.test.ts`
Expected: FAIL — modules not found.

**Step 3: Implement the utilities**

Create `src/utils/text.ts`:

```typescript
/**
 * Collapse multiple whitespace characters (spaces, tabs, newlines) into a single space.
 * Trims leading and trailing whitespace.
 */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Rejoin words that were hyphenated across line breaks.
 * Matches: word-\n or word-\n<space> followed by lowercase continuation.
 * Preserves legitimate compound hyphens (no newline after hyphen).
 */
export function rejoinHyphens(text: string): string {
  return text.replace(/-\s*\n\s*/g, '');
}

/**
 * Convert smart/curly quotes to their ASCII equivalents.
 */
export function normalizeQuotes(text: string): string {
  return text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

/**
 * Full text normalization pipeline:
 * 1. Unicode NFC normalization
 * 2. Smart quotes → ASCII
 * 3. Rejoin hyphenated line breaks
 * 4. Collapse whitespace
 */
export function normalizeText(text: string): string {
  let result = text.normalize('NFC');
  result = normalizeQuotes(result);
  result = rejoinHyphens(result);
  result = collapseWhitespace(result);
  return result;
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/unit/utils/text.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/utils/text.ts tests/unit/utils/text.test.ts
git commit -m "feat: add text normalization utilities with tests"
```

---

## Task 3: Geometry Utilities

**Files:**
- Create: `src/utils/geometry.ts`
- Create: `tests/unit/utils/geometry.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/utils/geometry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  rectFromTransform,
  pdfRectToCssRect,
  mergeAdjacentRects,
  sliceRectHorizontal,
} from '../../src/utils/geometry';

describe('rectFromTransform', () => {
  it('computes rect from simple unrotated transform', () => {
    // transform = [fontSize, 0, 0, fontSize, x, y]
    const rect = rectFromTransform([12, 0, 0, 12, 100, 500], 60, 12);
    expect(rect.x).toBeCloseTo(100);
    expect(rect.y).toBeCloseTo(500);
    expect(rect.width).toBeCloseTo(60);
    expect(rect.height).toBeCloseTo(12);
  });

  it('handles scaled transform', () => {
    // transform with scaleX=2 doubles the width
    const rect = rectFromTransform([24, 0, 0, 12, 100, 500], 60, 12);
    expect(rect.width).toBeCloseTo(120);
    expect(rect.height).toBeCloseTo(12);
  });
});

describe('pdfRectToCssRect', () => {
  it('converts PDF coords (bottom-left origin) to CSS coords (top-left origin)', () => {
    const pdfRect = { x: 100, y: 500, width: 60, height: 12 };
    const pageHeight = 792; // standard US letter
    const scale = 1.0;
    const css = pdfRectToCssRect(pdfRect, pageHeight, scale);
    // CSS y = pageHeight - pdfY - height
    expect(css.x).toBeCloseTo(100);
    expect(css.y).toBeCloseTo(792 - 500 - 12);
    expect(css.width).toBeCloseTo(60);
    expect(css.height).toBeCloseTo(12);
  });

  it('applies scale factor', () => {
    const pdfRect = { x: 100, y: 500, width: 60, height: 12 };
    const css = pdfRectToCssRect(pdfRect, 792, 2.0);
    expect(css.x).toBeCloseTo(200);
    expect(css.y).toBeCloseTo((792 - 500 - 12) * 2);
    expect(css.width).toBeCloseTo(120);
    expect(css.height).toBeCloseTo(24);
  });
});

describe('mergeAdjacentRects', () => {
  it('merges horizontally adjacent rects on the same line', () => {
    const rects = [
      { x: 100, y: 200, width: 30, height: 12 },
      { x: 130, y: 200, width: 40, height: 12 },
    ];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(1);
    expect(merged[0].x).toBeCloseTo(100);
    expect(merged[0].width).toBeCloseTo(70);
  });

  it('does not merge rects on different lines', () => {
    const rects = [
      { x: 100, y: 200, width: 30, height: 12 },
      { x: 100, y: 220, width: 40, height: 12 },
    ];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(2);
  });

  it('handles empty input', () => {
    expect(mergeAdjacentRects([], 2)).toEqual([]);
  });

  it('handles single rect', () => {
    const rects = [{ x: 100, y: 200, width: 30, height: 12 }];
    const merged = mergeAdjacentRects(rects, 2);
    expect(merged).toHaveLength(1);
  });
});

describe('sliceRectHorizontal', () => {
  it('slices a rect by start and end fractions', () => {
    const rect = { x: 100, y: 200, width: 100, height: 12 };
    const sliced = sliceRectHorizontal(rect, 0.2, 0.7);
    expect(sliced.x).toBeCloseTo(120);
    expect(sliced.width).toBeCloseTo(50);
    expect(sliced.y).toBe(200);
    expect(sliced.height).toBe(12);
  });

  it('returns full rect for 0 to 1', () => {
    const rect = { x: 100, y: 200, width: 100, height: 12 };
    const sliced = sliceRectHorizontal(rect, 0, 1);
    expect(sliced).toEqual(rect);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/unit/utils/geometry.test.ts`
Expected: FAIL — modules not found.

**Step 3: Implement the geometry utilities**

Create `src/utils/geometry.ts`:

```typescript
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute a bounding rectangle from a pdf.js text item transform.
 * transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
 * itemWidth and itemHeight are from the TextItem in PDF units.
 *
 * For non-rotated text: rect is simply (tx, ty, width * scaleRatioX, height).
 * The scaleRatioX accounts for transforms where scaleX != fontSize.
 */
export function rectFromTransform(
  transform: number[],
  itemWidth: number,
  itemHeight: number,
): Rect {
  const [scaleX, skewY, skewX, scaleY, tx, ty] = transform;
  // For unrotated text, scaleX ≈ fontSize. The itemWidth is already in
  // user-space units, but if the transform has a different horizontal scale
  // than vertical, we need to account for it.
  const scaleRatioX = Math.sqrt(scaleX * scaleX + skewY * skewY) /
    Math.sqrt(scaleY * scaleY + skewX * skewX);

  return {
    x: tx,
    y: ty,
    width: itemWidth * scaleRatioX,
    height: itemHeight,
  };
}

/**
 * Convert a rectangle from PDF coordinate space (origin bottom-left, y-up)
 * to CSS coordinate space (origin top-left, y-down).
 */
export function pdfRectToCssRect(
  rect: Rect,
  pageHeight: number,
  scale: number,
): Rect {
  return {
    x: rect.x * scale,
    y: (pageHeight - rect.y - rect.height) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/**
 * Merge horizontally adjacent rectangles that are on the same line.
 * Two rects are "on the same line" if their y values differ by less than tolerance.
 * Two rects are "adjacent" if the gap between them is less than tolerance.
 */
export function mergeAdjacentRects(rects: Rect[], tolerance: number): Rect[] {
  if (rects.length <= 1) return [...rects];

  // Sort by y (line), then by x (position within line)
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: Rect[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    const sameLine = Math.abs(current.y - last.y) < tolerance;
    const adjacent = current.x <= last.x + last.width + tolerance;

    if (sameLine && adjacent) {
      // Extend the last rect to cover current
      const newRight = Math.max(last.x + last.width, current.x + current.width);
      last.width = newRight - last.x;
      last.height = Math.max(last.height, current.height);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Slice a rectangle horizontally by start and end fractions (0 to 1).
 * Used for partial-item highlights.
 */
export function sliceRectHorizontal(
  rect: Rect,
  startFraction: number,
  endFraction: number,
): Rect {
  return {
    x: rect.x + rect.width * startFraction,
    y: rect.y,
    width: rect.width * (endFraction - startFraction),
    height: rect.height,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/unit/utils/geometry.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/utils/geometry.ts tests/unit/utils/geometry.test.ts
git commit -m "feat: add geometry utilities with tests"
```

---

## Task 4: Highlight & Search Types

**Files:**
- Create: `src/highlight/types.ts`
- Create: `src/search/types.ts`
- Create: `src/types.ts`

**Step 1: Create the shared types**

Create `src/types.ts`:

```typescript
/** A text item extracted from pdf.js getTextContent(), enriched with per-char widths. */
export interface PdflightTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
  charWidths: number[];
}

/** Maps a character in the normalized string back to its source text item. */
export interface CharMapping {
  itemIndex: number;
  charOffset: number;
}

/** Normalized text index for one page. */
export interface PageTextIndex {
  pageNumber: number;
  normalizedText: string;
  charMap: CharMapping[];
  items: PdflightTextItem[];
}
```

Create `src/search/types.ts`:

```typescript
/** A match found by the search engine. */
export interface SearchMatch {
  page: number;
  startChar: number;
  endChar: number;
  text: string;
}
```

Create `src/highlight/types.ts`:

```typescript
/** A highlight to be rendered on the PDF. */
export interface Highlight {
  id: string;
  page: number;
  startChar: number;
  endChar: number;
  color: string;
}

/** A computed rectangle for rendering a highlight overlay. */
export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS — no type errors.

**Step 3: Commit**

```bash
git add src/types.ts src/search/types.ts src/highlight/types.ts
git commit -m "feat: add core type definitions"
```

---

## Task 5: TextIndex — Build Normalized Text from pdf.js Data

**Files:**
- Create: `src/search/TextIndex.ts`
- Create: `tests/unit/search/TextIndex.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/search/TextIndex.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildPageTextIndex } from '../../src/search/TextIndex';
import type { PdflightTextItem } from '../../src/types';

/** Helper: create a minimal text item for testing. */
function makeItem(str: string, overrides?: Partial<PdflightTextItem>): PdflightTextItem {
  return {
    str,
    transform: [12, 0, 0, 12, 100, 500],
    width: str.length * 7, // ~7 units per char
    height: 12,
    fontName: 'TestFont',
    hasEOL: false,
    charWidths: Array(str.length).fill(7),
    ...overrides,
  };
}

describe('buildPageTextIndex', () => {
  it('concatenates items into a single normalized string', () => {
    const items = [makeItem('Hello '), makeItem('World')];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toBe('Hello World');
    expect(index.pageNumber).toBe(1);
  });

  it('builds charMap mapping each char back to source item', () => {
    const items = [makeItem('AB'), makeItem('CD')];
    const index = buildPageTextIndex(1, items);
    // 'AB CD' after normalization (space between items)
    // charMap[0] -> item 0, char 0 (A)
    // charMap[1] -> item 0, char 1 (B)
    expect(index.charMap[0]).toEqual({ itemIndex: 0, charOffset: 0 });
    expect(index.charMap[1]).toEqual({ itemIndex: 0, charOffset: 1 });
  });

  it('collapses whitespace across items', () => {
    const items = [makeItem('Hello  '), makeItem('  World')];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toBe('Hello World');
  });

  it('rejoins hyphenated words across items', () => {
    const items = [
      makeItem('exam-', { hasEOL: true }),
      makeItem('ple of text'),
    ];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toContain('example');
  });

  it('normalizes smart quotes', () => {
    const items = [makeItem('\u201CHello\u201D')];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toBe('"Hello"');
  });

  it('handles empty items', () => {
    const items = [makeItem(''), makeItem('Hello')];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toBe('Hello');
  });

  it('preserves items array reference', () => {
    const items = [makeItem('Test')];
    const index = buildPageTextIndex(1, items);
    expect(index.items).toBe(items);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/unit/search/TextIndex.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement TextIndex**

Create `src/search/TextIndex.ts`:

```typescript
import type { PdflightTextItem, CharMapping, PageTextIndex } from '../types';
import { normalizeQuotes, rejoinHyphens } from '../utils/text';

/**
 * Build a PageTextIndex from an array of PdflightTextItems.
 *
 * Concatenates all item strings into a single normalized string and builds
 * a parallel charMap array that maps each character in the normalized string
 * back to its source item and character offset.
 *
 * Normalization:
 * 1. NFC unicode normalization
 * 2. Smart quotes → ASCII
 * 3. Rejoin hyphenated line breaks (item ending with '-' + hasEOL)
 * 4. Collapse whitespace (multiple spaces/newlines → single space)
 */
export function buildPageTextIndex(
  pageNumber: number,
  items: PdflightTextItem[],
): PageTextIndex {
  // Phase 1: Build raw concatenated string with per-char source tracking.
  // We insert a space between items unless the previous item ends with a
  // hyphen + EOL (which will be rejoined).
  let rawText = '';
  const rawCharMap: CharMapping[] = [];

  for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
    const item = items[itemIdx];
    if (item.str.length === 0) continue;

    // Add separator space between items (unless hyphenated line break)
    if (rawText.length > 0) {
      const prevItem = findPrevNonEmpty(items, itemIdx);
      const isHyphenBreak = prevItem !== null &&
        prevItem.str.endsWith('-') && prevItem.hasEOL;

      if (isHyphenBreak) {
        // Remove the trailing hyphen from rawText for rejoining
        rawText = rawText.slice(0, -1);
        rawCharMap.pop();
      } else {
        // Insert space separator
        rawText += ' ';
        // Map separator space to end of previous item
        rawCharMap.push({ itemIndex: itemIdx - 1, charOffset: items[itemIdx - 1].str.length });
      }
    }

    for (let charIdx = 0; charIdx < item.str.length; charIdx++) {
      rawText += item.str[charIdx];
      rawCharMap.push({ itemIndex: itemIdx, charOffset: charIdx });
    }
  }

  // Phase 2: Apply normalizations while maintaining charMap correspondence.
  // We normalize the raw text and rebuild the charMap to match.
  let normalized = rawText.normalize('NFC');
  normalized = normalizeQuotes(normalized);

  // Phase 3: Collapse whitespace while tracking charMap positions.
  const finalText: string[] = [];
  const finalCharMap: CharMapping[] = [];
  let prevWasSpace = false;
  let leadingWhitespace = true;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const isSpace = /\s/.test(ch);

    if (isSpace) {
      if (!leadingWhitespace && !prevWasSpace) {
        finalText.push(' ');
        finalCharMap.push(rawCharMap[i] ?? { itemIndex: 0, charOffset: 0 });
      }
      prevWasSpace = true;
    } else {
      leadingWhitespace = false;
      prevWasSpace = false;
      finalText.push(ch);
      finalCharMap.push(rawCharMap[i] ?? { itemIndex: 0, charOffset: 0 });
    }
  }

  // Trim trailing space
  if (finalText.length > 0 && finalText[finalText.length - 1] === ' ') {
    finalText.pop();
    finalCharMap.pop();
  }

  return {
    pageNumber,
    normalizedText: finalText.join(''),
    charMap: finalCharMap,
    items,
  };
}

function findPrevNonEmpty(items: PdflightTextItem[], currentIdx: number): PdflightTextItem | null {
  for (let i = currentIdx - 1; i >= 0; i--) {
    if (items[i].str.length > 0) return items[i];
  }
  return null;
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/unit/search/TextIndex.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/search/TextIndex.ts tests/unit/search/TextIndex.test.ts
git commit -m "feat: add TextIndex for normalized text + charMap construction"
```

---

## Task 6: SearchEngine

**Files:**
- Create: `src/search/SearchEngine.ts`
- Create: `tests/unit/search/SearchEngine.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/search/SearchEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { searchPages } from '../../src/search/SearchEngine';
import { buildPageTextIndex } from '../../src/search/TextIndex';
import type { PdflightTextItem } from '../../src/types';

function makeItem(str: string): PdflightTextItem {
  return {
    str,
    transform: [12, 0, 0, 12, 100, 500],
    width: str.length * 7,
    height: 12,
    fontName: 'TestFont',
    hasEOL: false,
    charWidths: Array(str.length).fill(7),
  };
}

describe('searchPages', () => {
  it('finds a simple match', () => {
    const index = buildPageTextIndex(1, [makeItem('Hello World')]);
    const results = searchPages([index], 'World');
    expect(results).toHaveLength(1);
    expect(results[0].page).toBe(1);
    expect(results[0].text).toBe('World');
  });

  it('is case-insensitive', () => {
    const index = buildPageTextIndex(1, [makeItem('Hello World')]);
    const results = searchPages([index], 'hello');
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('Hello');
  });

  it('finds multiple matches on same page', () => {
    const index = buildPageTextIndex(1, [makeItem('the cat and the dog')]);
    const results = searchPages([index], 'the');
    expect(results).toHaveLength(2);
  });

  it('finds matches across multiple pages', () => {
    const page1 = buildPageTextIndex(1, [makeItem('Hello World')]);
    const page2 = buildPageTextIndex(2, [makeItem('Hello Again')]);
    const results = searchPages([page1, page2], 'Hello');
    expect(results).toHaveLength(2);
    expect(results[0].page).toBe(1);
    expect(results[1].page).toBe(2);
  });

  it('finds match spanning across items', () => {
    const index = buildPageTextIndex(1, [makeItem('Hel'), makeItem('lo World')]);
    const results = searchPages([index], 'Hello');
    expect(results).toHaveLength(1);
  });

  it('returns correct startChar and endChar', () => {
    const index = buildPageTextIndex(1, [makeItem('Hello World')]);
    const results = searchPages([index], 'World');
    expect(results[0].startChar).toBe(6);
    expect(results[0].endChar).toBe(11);
  });

  it('returns empty array for no matches', () => {
    const index = buildPageTextIndex(1, [makeItem('Hello World')]);
    const results = searchPages([index], 'xyz');
    expect(results).toHaveLength(0);
  });

  it('handles empty query', () => {
    const index = buildPageTextIndex(1, [makeItem('Hello')]);
    const results = searchPages([index], '');
    expect(results).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/unit/search/SearchEngine.test.ts`
Expected: FAIL.

**Step 3: Implement SearchEngine**

Create `src/search/SearchEngine.ts`:

```typescript
import type { PageTextIndex } from '../types';
import type { SearchMatch } from './types';

/**
 * Search across all page text indices for a query string.
 * Case-insensitive substring matching on the normalized text.
 * Returns matches ordered by page, then by position within page.
 */
export function searchPages(
  pages: PageTextIndex[],
  query: string,
): SearchMatch[] {
  if (!query || query.length === 0) return [];

  const queryLower = query.toLowerCase();
  const results: SearchMatch[] = [];

  for (const page of pages) {
    const textLower = page.normalizedText.toLowerCase();
    let searchFrom = 0;

    while (searchFrom <= textLower.length - queryLower.length) {
      const idx = textLower.indexOf(queryLower, searchFrom);
      if (idx === -1) break;

      results.push({
        page: page.pageNumber,
        startChar: idx,
        endChar: idx + queryLower.length,
        text: page.normalizedText.slice(idx, idx + queryLower.length),
      });

      searchFrom = idx + 1; // Allow overlapping matches
    }
  }

  return results;
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/unit/search/SearchEngine.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/search/SearchEngine.ts tests/unit/search/SearchEngine.test.ts
git commit -m "feat: add SearchEngine with case-insensitive normalized search"
```

---

## Task 7: HighlightEngine — Compute Highlight Rectangles

**Files:**
- Create: `src/highlight/HighlightEngine.ts`
- Create: `tests/unit/highlight/HighlightEngine.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/highlight/HighlightEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeHighlightRects } from '../../src/highlight/HighlightEngine';
import { buildPageTextIndex } from '../../src/search/TextIndex';
import type { PdflightTextItem } from '../../src/types';

function makeItem(
  str: string,
  overrides?: Partial<PdflightTextItem>,
): PdflightTextItem {
  const charWidths = Array.from(str, () => 7);
  return {
    str,
    transform: [12, 0, 0, 12, 100, 500],
    width: str.length * 7,
    height: 12,
    fontName: 'TestFont',
    hasEOL: false,
    charWidths,
    ...overrides,
  };
}

describe('computeHighlightRects', () => {
  const pageHeight = 792;
  const zoomScale = 1.5;

  it('computes rect for full-item highlight', () => {
    const items = [makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] })];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 1, startChar: 0, endChar: 5, id: 'h1', color: 'yellow' }, pageHeight, zoomScale);
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBeCloseTo(100 * zoomScale);
    expect(rects[0].y).toBeCloseTo((792 - 500 - 12) * zoomScale);
    expect(rects[0].width).toBeCloseTo(5 * 7 * zoomScale);
    expect(rects[0].height).toBeCloseTo(12 * zoomScale);
  });

  it('computes rect for partial-item highlight (start offset)', () => {
    const items = [makeItem('Hello', { charWidths: [5, 6, 7, 8, 9] })];
    const index = buildPageTextIndex(1, items);
    // Highlight chars 1-3 ('ell')
    const rects = computeHighlightRects(index, { page: 1, startChar: 1, endChar: 3, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBeCloseTo(100 + 5); // 100 + first char width
    expect(rects[0].width).toBeCloseTo(6 + 7); // 'e' + 'l'
  });

  it('computes rects for highlight spanning multiple items', () => {
    const items = [makeItem('Hello '), makeItem('World')];
    const index = buildPageTextIndex(1, items);
    // Highlight entire 'Hello World' (including the space)
    const rects = computeHighlightRects(index, { page: 1, startChar: 0, endChar: 11, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(2);
  });

  it('merges adjacent rects on same line', () => {
    const items = [makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] }), makeItem(' World', { transform: [12, 0, 0, 12, 135, 500] })];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 1, startChar: 0, endChar: 11, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(1); // Should merge into one rect
  });

  it('returns empty array for highlight on different page', () => {
    const items = [makeItem('Hello')];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 2, startChar: 0, endChar: 5, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(0);
  });

  it('handles endChar at item boundary', () => {
    const items = [makeItem('Hello'), makeItem('World')];
    const index = buildPageTextIndex(1, items);
    const rects = computeHighlightRects(index, { page: 1, startChar: 0, endChar: 5, id: 'h1', color: 'yellow' }, 792, 1.0);
    expect(rects).toHaveLength(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/unit/highlight/HighlightEngine.test.ts`
Expected: FAIL.

**Step 3: Implement HighlightEngine**

Create `src/highlight/HighlightEngine.ts`:

```typescript
import type { PageTextIndex, CharMapping } from '../types';
import type { Highlight, HighlightRect } from './types';
import { rectFromTransform, pdfRectToCssRect, mergeAdjacentRects, sliceRectHorizontal } from '../utils/geometry';

interface ItemRange {
  itemIndex: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Compute highlight rectangles for a highlight on a specific page.
 * Uses per-character width data from the TextIndex for accurate partial-item positioning.
 * Merges adjacent rectangles on the same line.
 */
export function computeHighlightRects(
  pageIndex: PageTextIndex,
  highlight: Highlight,
  pageHeight: number,
  scale: number,
): HighlightRect[] {
  if (highlight.page !== pageIndex.pageNumber) {
    return [];
  }

  const { startChar, endChar } = highlight;
  if (startChar >= endChar || endChar > pageIndex.charMap.length) {
    return [];
  }

  // Map character range to item ranges
  const itemRanges = mapCharRangeToItems(pageIndex, startChar, endChar);

  // Compute rects for each item range
  const rects: HighlightRect[] = [];
  for (const range of itemRanges) {
    const item = pageIndex.items[range.itemIndex];
    const itemRect = rectFromTransform(item.transform, item.width, item.height);
    const cssRect = pdfRectToCssRect(itemRect, pageHeight, scale);

    if (range.startOffset === 0 && range.endOffset === item.str.length) {
      // Full item highlight
      rects.push(cssRect);
    } else {
      // Partial item highlight — use charWidths for precision
      const startFraction = sumWidths(item.charWidths, 0, range.startOffset) / sumWidths(item.charWidths);
      const endFraction = sumWidths(item.charWidths, 0, range.endOffset) / sumWidths(item.charWidths);
      const partialRect = sliceRectHorizontal(cssRect, startFraction, endFraction);
      rects.push(partialRect);
    }
  }

  // Merge adjacent rects on the same line (within 2px tolerance)
  return mergeAdjacentRects(rects, 2 * scale);
}

function mapCharRangeToItems(
  pageIndex: PageTextIndex,
  startChar: number,
  endChar: number,
): ItemRange[] {
  const ranges: ItemRange[] = [];
  let currentRange: ItemRange | null = null;

  for (let i = startChar; i < endChar; i++) {
    const mapping = pageIndex.charMap[i];
    if (!currentRange || currentRange.itemIndex !== mapping.itemIndex) {
      if (currentRange) {
        ranges.push(currentRange);
      }
      currentRange = { itemIndex: mapping.itemIndex, startOffset: mapping.charOffset, endOffset: mapping.charOffset + 1 };
    } else {
      currentRange.endOffset = Math.max(currentRange.endOffset, mapping.charOffset + 1);
    }
  }

  if (currentRange) {
    ranges.push(currentRange);
  }

  return ranges;
}

function sumWidths(widths: number[], start = 0, end = widths.length): number {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += widths[i] ?? 0;
  }
  return sum;
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/unit/highlight/HighlightEngine.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/highlight/HighlightEngine.ts tests/unit/highlight/HighlightEngine.test.ts
git commit -m "feat: add HighlightEngine with per-char-width accurate rectangles"
```

---

## Task 8: HighlightLayer — DOM Rendering of Highlights

**Files:**
- Create: `src/highlight/HighlightLayer.ts`

**Step 1: Create HighlightLayer class**

Create `src/highlight/HighlightLayer.ts`:

```typescript
import type { HighlightRect } from './types';
import type { Highlight } from './types';

export type TooltipContentFn = (highlight: Highlight) => string | HTMLElement;

/**
 * Manages DOM rendering of highlight overlays.
 * Creates/removes div elements for each highlight rect, handles tooltip on hover.
 */
export class HighlightLayer {
  private container: HTMLElement | null = null;
  private highlightElements = new Map<string, HTMLElement[]>();
  private tooltipElement: HTMLElement | null = null;
  private tooltipContentFn: TooltipContentFn | null = null;
  private hideTooltipTimer: number | null = null;

  constructor() {}

  /** Mount the highlight layer into a parent container. */
  mount(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'pdflight-highlight-layer';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `;
    parent.appendChild(this.container);
  }

  /** Set the tooltip content callback. */
  setTooltipContent(fn: TooltipContentFn | null): void {
    this.tooltipContentFn = fn;
  }

  /** Render highlights for a specific page. */
  render(pageHighlights: Array<{ highlight: Highlight; rects: HighlightRect[] }>): void {
    if (!this.container) return;

    // Clear existing highlights for this page
    this.clear();

    for (const { highlight, rects } of pageHighlights) {
      const elements: HTMLElement[] = [];

      for (const rect of rects) {
        const el = this.createHighlightElement(highlight, rect);
        this.container!.appendChild(el);
        elements.push(el);
      }

      this.highlightElements.set(highlight.id, elements);
    }
  }

  /** Clear all highlights. */
  clear(): void {
    this.highlightElements.forEach((els) => {
      els.forEach((el) => el.remove());
    });
    this.highlightElements.clear();
    this.hideTooltip();
  }

  /** Remove a specific highlight. */
  removeHighlight(id: string): void {
    const elements = this.highlightElements.get(id);
    if (elements) {
      elements.forEach((el) => el.remove());
      this.highlightElements.delete(id);
    }
  }

  private createHighlightElement(highlight: Highlight, rect: HighlightRect): HTMLElement {
    const el = document.createElement('div');
    el.className = 'pdflight-highlight';
    el.dataset.highlightId = highlight.id;
    el.style.cssText = `
      position: absolute;
      left: ${rect.x}px;
      top: ${rect.y}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background-color: ${highlight.color};
      mix-blend-mode: multiply;
      pointer-events: auto;
      cursor: pointer;
    `;

    // Hover events for tooltip
    el.addEventListener('mouseenter', () => this.showTooltip(highlight, rect));
    el.addEventListener('mouseleave', () => this.scheduleHideTooltip());

    return el;
  }

  private showTooltip(highlight: Highlight, rect: HighlightRect): void {
    if (!this.container || !this.tooltipContentFn) return;

    this.hideTooltip();

    const content = this.tooltipContentFn(highlight);
    if (!content) return;

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'pdflight-tooltip';
    this.tooltipElement.style.cssText = `
      position: absolute;
      left: ${rect.x}px;
      top: ${rect.y + rect.height + 4}px;
      background: #333;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 10;
      white-space: nowrap;
    `;

    if (typeof content === 'string') {
      this.tooltipElement.textContent = content;
    } else {
      this.tooltipElement.appendChild(content);
    }

    this.container.appendChild(this.tooltipElement);
  }

  private scheduleHideTooltip(): void {
    if (this.hideTooltipTimer !== null) {
      clearTimeout(this.hideTooltipTimer);
    }
    this.hideTooltipTimer = window.setTimeout(() => this.hideTooltip(), 100);
  }

  private hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
  }

  /** Cleanup. */
  destroy(): void {
    this.clear();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/highlight/HighlightLayer.ts
git commit -m "feat: add HighlightLayer for DOM rendering of highlights and tooltips"
```

---

## Task 9: PageRenderer — Canvas + Text Layer Integration

**Files:**
- Create: `src/viewer/PageRenderer.ts`

**Step 1: Create PageRenderer class**

Create `src/viewer/PageRenderer.ts`:

```typescript
import * as pdfjs from 'pdfjs-dist';
import type { PageTextIndex, PdflightTextItem } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

export interface PageViewport {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * Manages rendering of a single PDF page: canvas, text layer, and highlight layer.
 */
export class PageRenderer {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private textLayerDiv: HTMLDivElement | null = null;
  private pdfPage: pdfjs.PDFPageProxy | null = null;
  private textIndex: PageTextIndex | null = null;
  private currentScale = 1.0;

  constructor(
    private pageNumber: number,
    private pageViewport: PageViewport,
  ) {}

  /** Get the text index for this page (built during first render). */
  getTextIndex(): PageTextIndex | null {
    return this.textIndex;
  }

  /** Render the page to a container. */
  async render(container: HTMLElement, pdfDocument: pdfjs.PDFDocumentProxy): Promise<void> {
    this.container = container;
    this.pdfPage = await pdfDocument.getPage(this.pageNumber);
    const viewport = this.pdfPage.getViewport({ scale: this.currentScale });

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pdflight-canvas';
    this.canvas.width = viewport.width;
    this.canvas.height = viewport.height;
    this.canvas.style.cssText = `width: ${viewport.width}px; height: ${viewport.height}px;`;

    // Create text layer container
    this.textLayerDiv = document.createElement('div');
    this.textLayerDiv.className = 'pdflight-text-layer';
    this.textLayerDiv.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${viewport.width}px;
      height: ${viewport.height}px;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    `;

    // Render PDF to canvas
    const renderContext = {
      canvasContext: this.canvas.getContext('2d')!,
      viewport,
    };
    await this.pdfPage.render(renderContext).promise;

    // Render text layer
    const textContent = await this.pdfPage.getTextContent();
    await this.renderTextLayer(textContent, viewport);

    // Build text index
    this.textIndex = await this.buildTextIndex(textContent);

    // Assemble the page container
    const pageContainer = document.createElement('div');
    pageContainer.className = 'pdflight-page-container';
    pageContainer.style.cssText = `
      position: relative;
      width: ${viewport.width}px;
      height: ${viewport.height}px;
      margin: 20px auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    pageContainer.appendChild(this.canvas);
    pageContainer.appendChild(this.textLayerDiv);

    container.appendChild(pageContainer);
  }

  private async renderTextLayer(textContent: pdfjs.TextContent, viewport: pdfjs.PageViewport): Promise<void> {
    // Import pdf.js text layer rendering
    const { TextLayer } = await import('pdfjs-dist/web/pdf_viewer.mjs');

    const textLayer = new TextLayer({
      textContentSource: textContent,
      container: this.textLayerDiv!,
      viewport,
      textDivs: [],
    });

    await textLayer.render();
  }

  private async buildTextIndex(textContent: pdfjs.TextContent): Promise<PageTextIndex> {
    const { buildPageTextIndex } = await import('../search/TextIndex.js');

    // Fetch font data for per-character widths
    const items: PdflightTextItem[] = [];

    for (const item of textContent.items) {
      const font = await this.pdfPage!.commonObjs.get(item.fontName);
      const charWidths = await this.getCharWidths(font, item.str, item.height);

      items.push({
        str: item.str,
        transform: [...item.transform],
        width: item.width,
        height: item.height || 0,
        fontName: item.fontName,
        hasEOL: item.hasEOL || false,
        charWidths,
      });
    }

    return buildPageTextIndex(this.pageNumber, items);
  }

  private async getCharWidths(font: any, str: string, fontSize: number): Promise<number[]> {
    // Try to get widths from font object
    const widths: number[] = [];
    const defaultWidth = font.defaultWidth || 500;

    for (const char of str) {
      const charCode = char.charCodeAt(0);
      const fontWidth = (font.widths && font.widths[charCode]) ?? defaultWidth;
      // Width is in 1/1000 em units; scale by fontSize/1000
      widths.push((fontWidth * fontSize) / 1000);
    }

    return widths;
  }

  /** Update zoom level and re-render. */
  async setZoom(scale: number, pdfDocument: pdfjs.PDFDocumentProxy): Promise<void> {
    if (this.currentScale === scale) return;
    this.currentScale = scale;
    if (this.container && this.pdfDocument) {
      await this.render(this.container, pdfDocument);
    }
  }

  /** Cleanup resources. */
  destroy(): void {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    if (this.textLayerDiv) {
      this.textLayerDiv.remove();
      this.textLayerDiv = null;
    }
    if (this.container) {
      this.container.textContent = '';
      this.container = null;
    }
    this.pdfPage = null;
    this.textIndex = null;
  }
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (may have warnings about pdf.js dynamic imports — acceptable for now).

**Step 3: Commit**

```bash
git add src/viewer/PageRenderer.ts
git commit -m "feat: add PageRenderer with pdf.js canvas and text layer rendering"
```

---

## Task 10: PdfViewer — Main API Class

**Files:**
- Modify: `src/index.ts`
- Create: `src/viewer/PdfViewer.ts`

**Step 1: Create PdfViewer class**

Create `src/viewer/PdfViewer.ts`:

```typescript
import * as pdfjs from 'pdfjs-dist';
import type { PageTextIndex } from '../types';
import type { SearchMatch } from '../search/types';
import type { Highlight } from '../highlight/types';
import { searchPages } from '../search/SearchEngine';
import { computeHighlightRects } from '../highlight/HighlightEngine';
import { HighlightLayer } from '../highlight/HighlightLayer';
import { PageRenderer } from './PageRenderer';

export interface PdfViewerOptions {
  initialPage?: number;
  initialZoom?: number;
  fitMode?: 'width' | 'page' | 'none';
  sidebar?: boolean;
  pageStepper?: boolean;
  tooltipContent?: (highlight: Highlight) => string | HTMLElement;
  pageBufferSize?: number;
  onPageChange?: (page: number) => void;
  onZoomChange?: (scale: number) => void;
}

type EventType = 'pagechange' | 'zoomchange' | 'highlighthover' | 'highlightclick';
type EventListener = (...args: unknown[]) => void;

/**
 * Main PDF viewer class. Manages PDF loading, navigation, search, and highlights.
 */
export class PdfViewer {
  private container: HTMLElement;
  private options: Required<PdfViewerOptions>;
  private pdfDocument: pdfjs.PDFDocumentProxy | null = null;
  private currentPage = 1;
  private currentZoom = 1.0;
  private fitMode: 'width' | 'page' | 'none' = 'width';
  private pageRenderers = new Map<number, PageRenderer>();
  private textIndices = new Map<number, PageTextIndex>();
  private highlightLayer = new HighlightLayer();
  private highlights = new Map<string, Highlight>();
  private eventListeners = new Map<EventType, Set<EventListener>>();

  constructor(container: HTMLElement, options: PdfViewerOptions = {}) {
    this.container = container;
    this.options = {
      initialPage: options.initialPage ?? 1,
      initialZoom: options.initialZoom ?? 1.0,
      fitMode: options.fitMode ?? 'width',
      sidebar: options.sidebar ?? false,
      pageStepper: options.pageStepper ?? false,
      tooltipContent: options.tooltipContent ?? null,
      pageBufferSize: options.pageBufferSize ?? 2,
      onPageChange: options.onPageChange ?? (() => {}),
      onZoomChange: options.onZoomChange ?? (() => {}),
    };

    this.fitMode = this.options.fitMode;
    this.currentZoom = this.options.initialZoom;
    this.highlightLayer.setTooltipContent(this.options.tooltipContent);
  }

  /** Load a PDF from URL or binary data. */
  async load(source: string | ArrayBuffer | Uint8Array): Promise<void> {
    let loadingTask: pdfjs.PDFDocumentLoadingTask;

    if (typeof source === 'string') {
      loadingTask = pdfjs.getDocument(source);
    } else {
      loadingTask = pdfjs.getDocument({ data: source });
    }

    this.pdfDocument = await loadingTask.promise;
    this.currentPage = this.options.initialPage;
    await this.renderCurrentPage();
  }

  /** Navigate to a specific page. */
  goToPage(page: number): void {
    if (!this.pdfDocument) return;
    const pageCount = this.pdfDocument.numPages;
    this.currentPage = Math.max(1, Math.min(page, pageCount));
    this.renderCurrentPage().then(() => this.emit('pagechange', this.currentPage));
  }

  /** Get current page number. */
  getCurrentPage(): number {
    return this.currentPage;
  }

  /** Get total page count. */
  getPageCount(): number {
    return this.pdfDocument?.numPages ?? 0;
  }

  /** Set zoom level. */
  setZoom(scale: number): void {
    if (scale === this.currentZoom) return;
    this.currentZoom = scale;
    this.rerenderAllPages().then(() => this.emit('zoomchange', scale));
  }

  /** Get current zoom level. */
  getZoom(): number {
    return this.currentZoom;
  }

  /** Set fit mode. */
  setFitMode(mode: 'width' | 'page' | 'none'): void {
    this.fitMode = mode;
    // TODO: Implement fit-to-width/page logic
  }

  /** Search for text across all pages. */
  async search(query: string): Promise<SearchMatch[]> {
    if (!this.pdfDocument) return [];

    // Build text indices for all pages if not already built
    await this.ensureAllTextIndices();

    const indices = Array.from(this.textIndices.values()).sort((a, b) => a.pageNumber - b.pageNumber);
    return searchPages(indices, query);
  }

  /** Add a highlight. */
  addHighlight(highlight: Highlight): void {
    this.highlights.set(highlight.id, highlight);
    this.renderHighlights();
  }

  /** Add multiple highlights. */
  addHighlights(highlights: Highlight[]): void {
    for (const h of highlights) {
      this.highlights.set(h.id, h);
    }
    this.renderHighlights();
  }

  /** Remove a highlight by ID. */
  removeHighlight(id: string): void {
    this.highlights.delete(id);
    this.highlightLayer.removeHighlight(id);
  }

  /** Remove all highlights. */
  removeAllHighlights(): void {
    this.highlights.clear();
    this.highlightLayer.clear();
  }

  /** Get all highlights. */
  getHighlights(): Highlight[] {
    return Array.from(this.highlights.values());
  }

  /** Serialize highlights to JSON string. */
  serializeHighlights(): string {
    return JSON.stringify(Array.from(this.highlights.values()));
  }

  /** Deserialize highlights from JSON string. */
  deserializeHighlights(json: string): void {
    try {
      const highlights: Highlight[] = JSON.parse(json);
      this.addHighlights(highlights);
    } catch (e) {
      console.error('Failed to deserialize highlights:', e);
    }
  }

  /** Register an event listener. */
  on(event: EventType, handler: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  /** Unregister an event listener. */
  off(event: EventType, handler: EventListener): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  /** Cleanup resources. */
  destroy(): void {
    this.highlightLayer.destroy();
    this.pageRenderers.forEach((r) => r.destroy());
    this.pageRenderers.clear();
    this.textIndices.clear();
    this.highlights.clear();
    this.eventListeners.clear();
    this.pdfDocument = null;
  }

  private async renderCurrentPage(): Promise<void> {
    if (!this.pdfDocument) return;

    // Clear container
    this.container.textContent = '';
    this.highlightLayer.mount(this.container);

    const renderer = new PageRenderer(this.currentPage, { pageNumber: this.currentPage, width: 0, height: 0, scale: this.currentZoom });
    await renderer.render(this.container, this.pdfDocument);
    this.pageRenderers.set(this.currentPage, renderer);

    // Cache text index
    const textIndex = renderer.getTextIndex();
    if (textIndex) {
      this.textIndices.set(this.currentPage, textIndex);
    }

    this.renderHighlights();
  }

  private async ensureAllTextIndices(): Promise<void> {
    if (!this.pdfDocument) return;

    for (let i = 1; i <= this.pdfDocument.numPages; i++) {
      if (!this.textIndices.has(i)) {
        const renderer = new PageRenderer(i, { pageNumber: i, width: 0, height: 0, scale: this.currentZoom });
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = 'position: absolute; visibility: hidden;';
        document.body.appendChild(tempContainer);
        await renderer.render(tempContainer, this.pdfDocument);
        const textIndex = renderer.getTextIndex();
        if (textIndex) {
          this.textIndices.set(i, textIndex);
        }
        renderer.destroy();
        tempContainer.remove();
      }
    }
  }

  private renderHighlights(): void {
    const pageHighlights: Array<{ highlight: Highlight; rects: any[] }> = [];

    for (const highlight of this.highlights.values()) {
      if (highlight.page === this.currentPage) {
        const textIndex = this.textIndices.get(this.currentPage);
        if (textIndex) {
          // Get page viewport dimensions from renderer
          const renderer = this.pageRenderers.get(this.currentPage);
          const pageHeight = renderer ? 792 : 792; // TODO: Get actual page height
          const rects = computeHighlightRects(textIndex, highlight, pageHeight, this.currentZoom);
          pageHighlights.push({ highlight, rects });
        }
      }
    }

    this.highlightLayer.render(pageHighlights);
  }

  private async rerenderAllPages(): Promise<void> {
    // For now, just re-render current page
    await this.renderCurrentPage();
  }

  private emit(event: EventType, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach((handler) => handler(...args));
  }
}
```

**Step 2: Update index.ts to export public API**

Modify `src/index.ts`:

```typescript
// pdflight - PDF viewer with precise text highlighting and smart search

export { PdfViewer, type PdfViewerOptions } from './viewer/PdfViewer';
export type { SearchMatch } from './search/types';
export type { Highlight, HighlightRect } from './highlight/types';
export type { PageTextIndex, PdflightTextItem } from './types';

export const VERSION = '0.1.0';
```

**Step 3: Run typecheck and build**

Run: `bun run typecheck && bun run build`
Expected: PASS, build produces `dist/`.

**Step 4: Commit**

```bash
git add src/index.ts src/viewer/PdfViewer.ts
git commit -m "feat: add PdfViewer main API class with search and highlight methods"
```

---

## Task 11: Demo App — HTML Entry Point

**Files:**
- Create: `demo/index.html`
- Create: `demo/style.css`
- Create: `vite.config.demo.ts`

**Step 1: Create demo HTML**

Create `demo/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>pdflight Demo</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <header class="toolbar">
      <h1>pdflight Demo</h1>
      <div class="toolbar-section">
        <label for="file-input" class="btn">Open PDF</label>
        <input type="file" id="file-input" accept=".pdf" data-testid="file-input">
        <select id="demo-pdf" data-testid="demo-pdf-select">
          <option value="">Load demo PDF...</option>
          <option value="file-sample_150kB.pdf">Sample 150KB</option>
          <option value="pdf-sample2.pdf">Sample 2</option>
        </select>
      </div>
      <div class="toolbar-section">
        <input type="text" id="search-input" placeholder="Search..." data-testid="search-input">
        <button id="search-btn" data-testid="search-btn">Search</button>
        <span id="search-results" data-testid="search-results"></span>
      </div>
      <div class="toolbar-section">
        <button id="zoom-out" data-testid="zoom-out">−</button>
        <span id="zoom-level" data-testid="zoom-level">100%</span>
        <button id="zoom-in" data-testid="zoom-in">+</button>
        <select id="fit-mode" data-testid="fit-mode">
          <option value="width">Fit Width</option>
          <option value="page">Fit Page</option>
          <option value="none">None</option>
        </select>
      </div>
      <div class="toolbar-section">
        <label><input type="checkbox" id="sidebar-toggle" data-testid="sidebar-toggle"> Sidebar</label>
        <label><input type="checkbox" id="stepper-toggle" data-testid="stepper-toggle"> Stepper</label>
      </div>
    </header>

    <div id="viewer-container" class="viewer-container">
      <aside id="sidebar" class="sidebar hidden" data-testid="sidebar">
        <h2>Thumbnails</h2>
        <div id="thumbnails" data-testid="thumbnails"></div>
      </aside>

      <main id="pdf-viewer" class="pdf-viewer" data-testid="pdf-viewer"></main>
    </div>

    <footer id="controls-panel" class="controls-panel">
      <div class="control-section">
        <h3>Highlights</h3>
        <button id="highlight-all" data-testid="highlight-all">Highlight All Search Results</button>
        <button id="clear-highlights" data-testid="clear-highlights">Clear All</button>
        <input type="color" id="highlight-color" value="#ffff00" data-testid="highlight-color">
      </div>
      <div class="control-section">
        <h3>Navigation</h3>
        <div id="page-stepper" class="page-stepper hidden" data-testid="page-stepper">
          <button id="prev-page" data-testid="prev-page">◀ Prev</button>
          <span id="page-info" data-testid="page-info">Page 1 of 1</span>
          <button id="next-page" data-testid="next-page">Next ▶</button>
        </div>
      </div>
      <div class="control-section">
        <h3>Serialize</h3>
        <button id="export-json" data-testid="export-json">Export JSON</button>
        <button id="import-json" data-testid="import-json">Import JSON</button>
        <textarea id="json-io" data-testid="json-io" readonly></textarea>
      </div>
    </footer>
  </div>

  <script type="module" src="./app.ts"></script>
</body>
</html>
```

**Step 2: Create demo CSS**

Create `demo/style.css`:

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.toolbar {
  display: flex;
  gap: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar h1 { margin: 0; font-size: 18px; }

.toolbar-section {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn {
  padding: 6px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn:hover { background: #0056b3; }

#file-input { display: none; }

.viewer-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 200px;
  background: #f9f9f9;
  border-right: 1px solid #ddd;
  overflow-y: auto;
  padding: 12px;
}

.sidebar.hidden { display: none; }

.pdf-viewer {
  flex: 1;
  overflow-y: auto;
  background: #525659;
  padding: 20px;
}

.controls-panel {
  display: flex;
  gap: 24px;
  padding: 12px;
  background: #f5f5f5;
  border-top: 1px solid #ddd;
}

.control-section { display: flex; flex-direction: column; gap: 8px; }

.control-section h3 { margin: 0; font-size: 14px; }

.page-stepper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.page-stepper.hidden { display: none; }

.pdflight-page-container {
  background: white;
  margin: 20px auto;
}

.pdflight-tooltip {
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

#json-io {
  width: 300px;
  height: 60px;
  font-family: monospace;
  font-size: 11px;
  resize: none;
}
```

**Step 3: Create demo Vite config**

Create `vite.config.demo.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
```

**Step 4: Update package.json with demo script**

Add to `package.json` scripts:

```json
"dev": "vite --config vite.config.demo.ts",
"preview": "vite build --config vite.config.demo.ts && vite preview --config vite.config.demo.ts",
```

**Step 5: Commit**

```bash
git add demo/ vite.config.demo.ts
git commit -m "feat: add demo app HTML structure and styling"
```

---

## Task 12: Demo App — TypeScript Logic

**Files:**
- Create: `demo/app.ts`

**Step 1: Create demo app logic**

Create `demo/app.ts`:

```typescript
import { PdfViewer, type SearchMatch, type Highlight } from '../src/index';

// DOM elements
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const demoPdfSelect = document.getElementById('demo-pdf-select') as HTMLSelectElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchBtn = document.getElementById('search-btn') as HTMLButtonElement;
const searchResults = document.getElementById('search-results') as HTMLSpanElement;
const zoomIn = document.getElementById('zoom-in') as HTMLButtonElement;
const zoomOut = document.getElementById('zoom-out') as HTMLButtonElement;
const zoomLevel = document.getElementById('zoom-level') as HTMLSpanElement;
const fitMode = document.getElementById('fit-mode') as HTMLSelectElement;
const sidebarToggle = document.getElementById('sidebar-toggle') as HTMLInputElement;
const stepperToggle = document.getElementById('stepper-toggle') as HTMLInputElement;
const sidebar = document.getElementById('sidebar') as HTMLElement;
const thumbnails = document.getElementById('thumbnails') as HTMLElement;
const pageStepper = document.getElementById('page-stepper') as HTMLElement;
const prevPage = document.getElementById('prev-page') as HTMLButtonElement;
const nextPage = document.getElementById('next-page') as HTMLButtonElement;
const pageInfo = document.getElementById('page-info') as HTMLSpanElement;
const highlightAll = document.getElementById('highlight-all') as HTMLButtonElement;
const clearHighlights = document.getElementById('clear-highlights') as HTMLButtonElement;
const highlightColor = document.getElementById('highlight-color') as HTMLInputElement;
const exportJson = document.getElementById('export-json') as HTMLButtonElement;
const importJson = document.getElementById('import-json') as HTMLButtonElement;
const jsonIo = document.getElementById('json-io') as HTMLTextAreaElement;

const pdfViewerContainer = document.getElementById('pdf-viewer')!;

// State
let viewer: PdfViewer | null = null;
let currentSearchResults: SearchMatch[] = [];
let currentHighlightColor = '#ffff0080'; // 50% opacity yellow

// Initialize
function init() {
  viewer = new PdfViewer(pdfViewerContainer, {
    tooltipContent: (h: Highlight) => `Highlight: ${h.id}`,
  });

  // File input
  const openBtn = document.querySelector('.btn');
  openBtn?.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // Demo PDF dropdown
  demoPdfSelect.addEventListener('change', handleDemoPdfSelect);

  // Search
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleSearch());

  // Zoom
  zoomIn.addEventListener('click', () => viewer?.setZoom(viewer.getZoom() + 0.25));
  zoomOut.addEventListener('click', () => viewer?.setZoom(Math.max(0.25, viewer.getZoom() - 0.25)));
  viewer?.on('zoomchange', (zoom: number) => zoomLevel.textContent = `${Math.round(zoom * 100)}%`);

  // Fit mode
  fitMode.addEventListener('change', () => viewer?.setFitMode(fitMode.value as 'width' | 'page' | 'none'));

  // Sidebar
  sidebarToggle.addEventListener('change', () => {
    sidebar.classList.toggle('hidden', !sidebarToggle.checked);
  });

  // Stepper
  stepperToggle.addEventListener('change', () => {
    pageStepper.classList.toggle('hidden', !stepperToggle.checked);
  });

  // Navigation
  prevPage.addEventListener('click', () => viewer?.goToPage(viewer.getCurrentPage() - 1));
  nextPage.addEventListener('click', () => viewer?.goToPage(viewer.getCurrentPage() + 1));
  viewer?.on('pagechange', updatePageInfo);

  // Highlights
  highlightAll.addEventListener('click', highlightAllResults);
  clearHighlights.addEventListener('click', () => viewer?.removeAllHighlights());
  highlightColor.addEventListener('input', () => {
    currentHighlightColor = highlightColor.value + '80'; // Add 50% opacity
  });

  // Serialize
  exportJson.addEventListener('click', () => {
    if (viewer) jsonIo.value = viewer.serializeHighlights();
  });
  importJson.addEventListener('click', () => {
    if (viewer && jsonIo.value) viewer.deserializeHighlights(jsonIo.value);
  });
}

async function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    await viewer?.load(arrayBuffer);
    updatePageInfo();
  }
}

async function handleDemoPdfSelect(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  if (value) {
    await viewer?.load(`/tests/fixtures/${value}`);
    updatePageInfo();
  }
}

async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  currentSearchResults = await viewer!.search(query);
  searchResults.textContent = `${currentSearchResults.length} match${currentSearchResults.length !== 1 ? 'es' : ''}`;
}

function highlightAllResults() {
  viewer?.removeAllHighlights();
  const highlights: Highlight[] = currentSearchResults.map((match, i) => ({
    id: `highlight-${i}`,
    page: match.page,
    startChar: match.startChar,
    endChar: match.endChar,
    color: currentHighlightColor,
  }));
  viewer?.addHighlights(highlights);
}

function updatePageInfo() {
  if (!viewer) return;
  pageInfo.textContent = `Page ${viewer.getCurrentPage()} of ${viewer.getPageCount()}`;
}

// Start
init();
```

**Step 2: Update demo Vite config for library mode**

Update `vite.config.demo.ts` to resolve the library:

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'demo',
  resolve: {
    alias: {
      '../src': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
```

**Step 3: Run dev server to verify**

Run: `bun run dev`
Expected: Server starts at http://localhost:5173, no errors in console.

**Step 4: Commit**

```bash
git add demo/app.ts vite.config.demo.ts package.json
git commit -m "feat: add demo app TypeScript logic exercising all library features"
```

---

## Task 13: E2E Tests — Playwright Setup

**Files:**
- Create: `tests/e2e/search.spec.ts`
- Create: `tests/e2e/highlight.spec.ts`
- Create: `tests/e2e/navigation.spec.ts`

**Step 1: Create search E2E test**

Create `tests/e2e/search.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Load a demo PDF
    await page.selectOption('#demo-pdf-select', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas');
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
});
```

**Step 2: Create highlight E2E test**

Create `tests/e2e/highlight.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Highlights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#demo-pdf-select', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas');
  });

  test('applies highlight on search results', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    // Check that highlight elements exist
    const highlights = page.locator('.pdflight-highlight');
    const matchText = await page.locator('[data-testid="search-results"]').textContent();
    const count = parseInt(matchText ?? '0') || 0;
    await expect(highlights).toHaveCount(count);
  });

  test('shows tooltip on highlight hover', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.locator('.pdflight-highlight').first().hover();
    await expect(page.locator('.pdflight-tooltip')).toBeVisible();
  });

  test('clears all highlights', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'PDF');
    await page.click('[data-testid="search-btn"]');
    await page.click('[data-testid="highlight-all"]');
    await page.click('[data-testid="clear-highlights"]');
    await expect(page.locator('.pdflight-highlight')).toHaveCount(0);
  });
});
```

**Step 3: Create navigation E2E test**

Create `tests/e2e/navigation.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#demo-pdf-select', 'file-sample_150kB.pdf');
    await page.waitForSelector('[data-testid="pdf-viewer"] canvas');
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
```

**Step 4: Update playwright config for demo app**

Update `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'bun run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

**Step 5: Run E2E tests**

Run: `bun run test:e2e`
Expected: Tests pass (may need fixture PDF adjustments).

**Step 6: Commit**

```bash
git add tests/e2e/ playwright.config.ts
git commit -m "feat: add Playwright E2E tests for search, highlights, navigation"
```

---

## Task 14: Final Polish — Coverage & Exports

**Step 1: Run full test suite with coverage**

Run: `bun run test:coverage`
Expected: See coverage report. If below 90%, add tests for uncovered branches.

**Step 2: Ensure all public API is exported**

Verify `src/index.ts` exports:
- `PdfViewer`, `PdfViewerOptions`
- `SearchMatch`
- `Highlight`, `HighlightRect`
- `PageTextIndex`, `PdflightTextItem`

**Step 3: Build final package**

Run: `bun run build`
Expected: `dist/` contains `pdflight.js`, `pdflight.js.map`, `index.d.ts`.

**Step 4: Update README**

Create `README.md`:

```markdown
# pdflight

PDF viewer library with precise text highlighting and smart search.

## Features

- **Precise text highlighting** — overlays that accurately cover rendered text
- **Smart search** — handles subscripts, superscripts, hyphenated words, cross-column text
- **Zero dependencies** — bundles pdf.js, no peer deps
- **Framework-agnostic** — vanilla TypeScript, works with any framework

## Quick Start

\`\`\`typescript
import { PdfViewer } from 'pdflight';

const viewer = new PdfViewer(containerElement);
await viewer.load('/path/to/document.pdf');

// Search
const matches = await viewer.search('search term');

// Highlight
viewer.addHighlights(matches.map((m, i) => ({
  id: \`h-\${i}\`,
  page: m.page,
  startChar: m.startChar,
  endChar: m.endChar,
  color: 'rgba(255, 255, 0, 0.5)',
})));
\`\`\`

## Demo

Run \`bun run dev\` and open http://localhost:5173

## License

MIT
```

**Step 5: Final commit**

```bash
git add README.md
git commit -m "docs: add README and finalize v1 implementation"
```

---

## Completion Checklist

- [ ] All unit tests pass: `bun run test`
- [ ] Coverage >=90%: `bun run test:coverage`
- [ ] E2E tests pass: `bun run test:e2e`
- [ ] Build succeeds: `bun run build`
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Lint passes: `bun run lint`
- [ ] Demo app runs: `bun run dev`
- [ ] All public API methods have tests
- [ ] README documents usage
- [ ] CLAUDE.md reflects actual implementation

---

**Total estimated implementation time:** 15-20 hours across 14 tasks.

**Key checkpoints:** After Task 6 (core search), Task 8 (highlights), Task 10 (full viewer), Task 12 (demo app), Task 14 (final polish).
