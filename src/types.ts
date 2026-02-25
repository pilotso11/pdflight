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
