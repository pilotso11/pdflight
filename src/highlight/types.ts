// Copyright (c) 2026 Seth Osher. MIT License.
/** Style configuration for the active search match highlight. */
export interface ActiveMatchStyle {
  color?: string;
  mode?: 'highlight' | 'outline';
}

/** A highlight to be rendered on the PDF. */
export interface Highlight {
  id: string;
  page: number;
  startChar: number;
  endChar: number;
  color: string;
  style?: 'highlight' | 'outline';
}

/** A computed rectangle for rendering a highlight overlay. */
export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
