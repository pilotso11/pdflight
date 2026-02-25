import { describe, it, expect } from 'vitest';
import { buildPageTextIndex } from '../../../src/search/TextIndex';
import type { PdflightTextItem } from '../../../src/types';

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
