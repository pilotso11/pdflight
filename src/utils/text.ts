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

/**
 * Relative width ratios for Latin characters in proportional fonts.
 * Values are relative to an "average" character width of 1.0.
 * Based on typical serif/sans-serif font metrics.
 */
const CHAR_WIDTH_RATIOS: Record<string, number> = {
  // Narrow
  'i': 0.45, 'j': 0.45, 'l': 0.45, '!': 0.45, '|': 0.35, '.': 0.45,
  ',': 0.45, ';': 0.45, ':': 0.45, "'": 0.35, '"': 0.55, '`': 0.45,
  '1': 0.65, 'f': 0.55, 't': 0.55, 'r': 0.55,
  // Medium-narrow
  'a': 0.85, 'b': 0.85, 'c': 0.75, 'd': 0.85, 'e': 0.80, 'g': 0.85,
  'h': 0.85, 'k': 0.80, 'n': 0.85, 'o': 0.85, 'p': 0.85, 'q': 0.85,
  's': 0.70, 'u': 0.85, 'v': 0.80, 'x': 0.80, 'y': 0.80, 'z': 0.75,
  // Digits
  '0': 0.85, '2': 0.85, '3': 0.85, '4': 0.85, '5': 0.85,
  '6': 0.85, '7': 0.80, '8': 0.85, '9': 0.85,
  // Wide
  'm': 1.30, 'w': 1.20, 'M': 1.35, 'W': 1.40, 'O': 1.10, 'Q': 1.10,
  'D': 1.05, 'G': 1.10, 'H': 1.05, 'N': 1.05, 'U': 1.05,
  // Uppercase medium
  'A': 1.00, 'B': 0.95, 'C': 0.95, 'E': 0.90, 'F': 0.85, 'I': 0.55,
  'J': 0.65, 'K': 0.95, 'L': 0.85, 'P': 0.90, 'R': 0.95, 'S': 0.85,
  'T': 0.90, 'V': 0.95, 'X': 0.95, 'Y': 0.95, 'Z': 0.90,
  // Space
  ' ': 0.50,
  // Common punctuation
  '-': 0.55, '_': 0.75, '(': 0.50, ')': 0.50, '[': 0.50, ']': 0.50,
  '{': 0.55, '}': 0.55, '/': 0.55, '\\': 0.55,
  '@': 1.30, '#': 0.90, '$': 0.85, '%': 1.10, '&': 1.00,
  '*': 0.65, '+': 0.85, '=': 0.85, '<': 0.85, '>': 0.85,
  '?': 0.70, '~': 0.85,
};

/** Get the relative width ratio for a character (1.0 = average). */
export function getCharWidthRatio(ch: string): number {
  return CHAR_WIDTH_RATIOS[ch] ?? 1.0;
}

const MONOSPACE_PATTERNS = [
  /courier/i, /consolas/i, /monaco/i, /mono/i, /fixed/i,
  /lucidaconsole/i, /menlo/i, /inconsolata/i, /source\s*code/i,
  /fira\s*code/i, /jetbrains/i, /hack/i, /droid\s*sans\s*mono/i,
];

/** Detect if a font is monospace based on its name. */
export function isMonospaceFont(fontName: string): boolean {
  const name = fontName.replace(/[-_\s]/g, '');
  return MONOSPACE_PATTERNS.some((pat) => pat.test(name));
}

/**
 * Estimate per-character widths using proportional ratios.
 * For monospace fonts, returns even distribution.
 * Sum of returned widths always equals totalWidth.
 */
export function estimateProportionalCharWidths(
  str: string,
  totalWidth: number,
  fontName: string,
): number[] {
  if (str.length === 0) return [];
  if (str.length === 1) return [totalWidth];

  if (isMonospaceFont(fontName)) {
    const w = totalWidth / str.length;
    return Array(str.length).fill(w);
  }

  const rawWidths = Array.from(str, (ch) => getCharWidthRatio(ch));
  const rawSum = rawWidths.reduce((a, b) => a + b, 0);

  if (rawSum === 0) {
    const w = totalWidth / str.length;
    return Array(str.length).fill(w);
  }

  const scale = totalWidth / rawSum;
  return rawWidths.map((w) => w * scale);
}
