// Copyright (c) 2026 Seth Osher. MIT License.
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
