// Copyright (c) 2026 Seth Osher. MIT License.
/** A match found by the search engine. */
export interface SearchMatch {
  page: number;
  startChar: number;
  endChar: number;
  text: string;
}

/** A visual row of text on a page, computed by y-proximity clustering. */
export interface RowInfo {
  /** 1-based page number. */
  page: number;
  /** 1-based row number from the top of the page. */
  row: number;
  /** Start index in the page's normalized text string (inclusive). */
  startChar: number;
  /** End index in the page's normalized text string (exclusive). */
  endChar: number;
  /** The row's concatenated text content. */
  text: string;
  /** Y-coordinate of the row in PDF space (higher = higher on page). */
  y: number;
}

/** Options for location-constrained text search. */
export interface FindTextOptions {
  /** Constrain search to a specific page (1-based). */
  page?: number;
  /** Prefer results near this row number (1-based from top). */
  nearRow?: number;
  /** Maximum number of results to return. */
  maxResults?: number;
  /**
   * Maximum y-distance (in PDF units) from nearRow to include results.
   * When nearRow is set and maxDistance is omitted, defaults to
   * 5 × average line spacing on the page — roughly ±5 rows of text.
   * Set to Infinity to disable filtering and only sort by proximity.
   */
  maxDistance?: number;
}
