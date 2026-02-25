/** A match found by the search engine. */
export interface SearchMatch {
  page: number;
  startChar: number;
  endChar: number;
  text: string;
}
