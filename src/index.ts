// Copyright (c) 2026 Seth Osher. MIT License.
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
export type { Highlight, HighlightRect, ActiveMatchStyle } from './highlight/types';
export type { PageTextIndex, PdflightTextItem, CharMapping } from './types';

// Injected at build time by Vite from package.json
declare const __PDFLIGHT_VERSION__: string;
export const VERSION: string = typeof __PDFLIGHT_VERSION__ !== 'undefined' ? __PDFLIGHT_VERSION__ : 'dev';
