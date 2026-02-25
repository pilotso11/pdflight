import { buildPageTextIndex } from './src/search/TextIndex.js';
import { computeHighlightRects } from './src/highlight/HighlightEngine.js';
import type { PdflightTextItem } from './src/types.js';

function makeItem(str: string, overrides?: Partial<PdflightTextItem>): PdflightTextItem {
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

const items = [
  makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] }),
  makeItem(' World', { transform: [12, 0, 0, 12, 135, 500] })
];
const index = buildPageTextIndex(1, items);

console.log('Normalized text:', index.normalizedText);
console.log('CharMap length:', index.charMap.length);
console.log('Items count:', index.items.length);

const rects = computeHighlightRects(index, { page: 1, startChar: 0, endChar: 11, id: 'h1', color: 'yellow' }, 792, 1.0);
console.log('Rects:', JSON.stringify(rects, null, 2));
console.log('Rect count:', rects.length);
