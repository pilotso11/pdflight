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
