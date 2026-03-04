import { describe, it, expect } from 'vitest';
import { normalizeText, collapseWhitespace, rejoinHyphens, normalizeQuotes } from '../../../src/utils/text';

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

  it('normalizes NFC where char count changes', () => {
    // Two separate code points (e + combining acute) → single code point (é)
    const input = 'e\u0301'; // 2 chars
    const result = normalizeText(input);
    expect(result).toBe('\u00E9'); // 1 char
    expect(result.length).toBe(1);
    expect(input.length).toBe(2);
  });

  it('handles multiple combining characters', () => {
    // a + combining ring above + combining acute → normalized form
    const input = 'a\u030A\u0301';
    const result = normalizeText(input);
    // NFC should compose this
    expect(result.length).toBeLessThanOrEqual(input.length);
  });

  it('preserves emoji (surrogate pairs)', () => {
    // Emoji are already NFC-safe, should pass through unchanged
    expect(normalizeText('Hello 🌍 World')).toBe('Hello 🌍 World');
  });

  it('handles emoji with variation selectors', () => {
    // Heart with text variation selector
    expect(normalizeText('❤\uFE0F')).toBe('❤\uFE0F');
  });

  it('handles CJK characters', () => {
    expect(normalizeText('你好世界')).toBe('你好世界');
  });

  it('handles mixed CJK and Latin', () => {
    expect(normalizeText('Hello 世界 test')).toBe('Hello 世界 test');
  });

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });

  it('handles string with only whitespace', () => {
    expect(normalizeText('   \n\t   ')).toBe('');
  });

  it('handles string with only hyphens', () => {
    expect(normalizeText('---')).toBe('---');
  });
});
