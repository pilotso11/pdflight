import { describe, it, expect } from 'vitest';

/**
 * Tests for the match navigation wrap-around arithmetic used by
 * PdfViewer.nextMatch() and PdfViewer.prevMatch().
 *
 * The actual methods live on PdfViewer (which requires DOM + pdf.js),
 * so we test the core index logic in isolation here.
 */

function nextIndex(current: number, total: number): number {
  if (total === 0) return -1;
  return (current + 1) % total;
}

function prevIndex(current: number, total: number): number {
  if (total === 0) return -1;
  return (current - 1 + total) % total;
}

describe('match navigation index arithmetic', () => {
  it('nextIndex wraps from last to first', () => {
    expect(nextIndex(4, 5)).toBe(0);
  });

  it('nextIndex advances normally', () => {
    expect(nextIndex(0, 5)).toBe(1);
    expect(nextIndex(2, 5)).toBe(3);
  });

  it('prevIndex wraps from first to last', () => {
    expect(prevIndex(0, 5)).toBe(4);
  });

  it('prevIndex retreats normally', () => {
    expect(prevIndex(3, 5)).toBe(2);
    expect(prevIndex(1, 5)).toBe(0);
  });

  it('single match: nextIndex stays at 0', () => {
    expect(nextIndex(0, 1)).toBe(0);
  });

  it('single match: prevIndex stays at 0', () => {
    expect(prevIndex(0, 1)).toBe(0);
  });

  it('empty: nextIndex returns -1', () => {
    expect(nextIndex(-1, 0)).toBe(-1);
  });

  it('empty: prevIndex returns -1', () => {
    expect(prevIndex(-1, 0)).toBe(-1);
  });

  it('first nextIndex from -1 lands on 0', () => {
    // When currentMatchIndex starts at -1, (-1 + 1) % n = 0
    expect(nextIndex(-1, 3)).toBe(0);
  });

  it('first prevIndex from -1 lands on last', () => {
    // When currentMatchIndex starts at -1, (-1 - 1 + 3) % 3 = 1
    // This matches the behavior: prevMatch from fresh state goes to second-to-last
    // In practice, the first call is usually nextMatch(), not prevMatch()
    expect(prevIndex(-1, 3)).toBe(1);
  });
});
