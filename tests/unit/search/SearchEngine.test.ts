import { describe, it, expect } from 'vitest';
import { searchPages } from '../../../src/search/SearchEngine';
import { buildPageTextIndex } from '../../../src/search/TextIndex';
import type { PdflightTextItem } from '../../../src/types';

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
