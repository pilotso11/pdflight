// pdflight - PDF viewer with precise text highlighting and smart search

export { PdfViewer, type PdfViewerOptions } from './viewer/PdfViewer';
export { PageRenderer, type PageViewport } from './viewer/PageRenderer';
export { Sidebar, type SidebarOptions, type PageHighlightInfo } from './viewer/Sidebar';
export { ViewerToolbar, type ToolbarConfig, type ToolbarCallbacks, resolveToolbarConfig } from './viewer/ViewerToolbar';
export { HighlightLayer } from './highlight/HighlightLayer';
export { searchPages } from './search/SearchEngine';
export { buildPageTextIndex } from './search/TextIndex';
export { computeHighlightRects } from './highlight/HighlightEngine';

export type { SearchMatch } from './search/types';
export type { Highlight, HighlightRect } from './highlight/types';
export type { PageTextIndex, PdflightTextItem, CharMapping } from './types';

export const VERSION = '0.1.0';
