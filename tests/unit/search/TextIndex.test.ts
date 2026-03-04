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

  it('maps separator space to correct item when empty items are skipped', () => {
    // Items: [0] "Hello" (y=500), [1] "" (empty, skipped), [2] "World" (y=400, different line)
    // The separator space between "Hello" and "World" should map to item 0 (not item 1)
    const items = [
      makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] }),
      makeItem('', { transform: [12, 0, 0, 12, 200, 500] }),
      makeItem('World', { transform: [12, 0, 0, 12, 100, 400] }),
    ];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toBe('Hello World');
    // The space at index 5 should map to item 0 (the actual previous non-empty item)
    expect(index.charMap[5]).toEqual({ itemIndex: 0, charOffset: 5 });
  });

  it('handles NFC normalization of combining characters', () => {
    // e + combining acute accent (2 code points) → é (1 code point in NFC)
    const items = [makeItem('e\u0301')];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toBe('\u00E9');
  });

  it('handles CJK text items', () => {
    const items = [makeItem('你好'), makeItem('世界')];
    const index = buildPageTextIndex(1, items);
    // Same y-coordinate, so no space inserted between items on same line
    expect(index.normalizedText).toBe('你好世界');
  });

  it('handles emoji (surrogate pairs)', () => {
    const items = [makeItem('Hello 🌍')];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toBe('Hello 🌍');
  });

  it('handles multiple consecutive empty items', () => {
    const items = [
      makeItem('Start'),
      makeItem(''),
      makeItem(''),
      makeItem(''),
      makeItem('End'),
    ];
    const index = buildPageTextIndex(1, items);
    // All on same line (same y=500), so no space separator
    expect(index.normalizedText).toBe('StartEnd');
  });

  it('handles items on same line without inserting space', () => {
    // Items at same y position should concatenate directly
    const items = [
      makeItem('Hel', { transform: [12, 0, 0, 12, 100, 500] }),
      makeItem('lo', { transform: [12, 0, 0, 12, 121, 500] }),
    ];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toBe('Hello');
  });

  it('inserts space between items on different lines', () => {
    const items = [
      makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] }),
      makeItem('World', { transform: [12, 0, 0, 12, 100, 480] }),
    ];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toBe('Hello World');
  });

  it('charMap length matches normalizedText length', () => {
    const items = [
      makeItem('Hello', { transform: [12, 0, 0, 12, 100, 500] }),
      makeItem('World', { transform: [12, 0, 0, 12, 100, 480] }),
    ];
    const index = buildPageTextIndex(1, items);
    expect(index.charMap.length).toBe(index.normalizedText.length);
  });

  it('handles smart quotes normalization in index', () => {
    const items = [makeItem('\u201CHello\u201D \u2018World\u2019')];
    const index = buildPageTextIndex(1, items);
    expect(index.normalizedText).toBe('"Hello" \'World\'');
  });
});
