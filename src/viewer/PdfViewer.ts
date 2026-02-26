import * as pdfjs from 'pdfjs-dist';
import type { PageTextIndex } from '../types';
import type { SearchMatch } from '../search/types';
import type { Highlight } from '../highlight/types';
import { searchPages } from '../search/SearchEngine';
import { computeHighlightRects } from '../highlight/HighlightEngine';
import { HighlightLayer } from '../highlight/HighlightLayer';
import { PageRenderer } from './PageRenderer';

export interface PdfViewerOptions {
  initialPage?: number;
  initialZoom?: number;
  fitMode?: 'width' | 'page' | 'none';
  sidebar?: boolean;
  pageStepper?: boolean;
  tooltipContent?: (highlight: Highlight) => string | HTMLElement;
  pageBufferSize?: number;
  onPageChange?: (page: number) => void;
  onZoomChange?: (scale: number) => void;
}

type EventType = 'pagechange' | 'zoomchange';
type EventListener = (...args: unknown[]) => void;

/**
 * Main PDF viewer class. Manages PDF loading, navigation, search, and highlights.
 */
export class PdfViewer {
  private container: HTMLElement;
  private options: Omit<Required<PdfViewerOptions>, 'tooltipContent'> & { tooltipContent: ((highlight: Highlight) => string | HTMLElement) | null };
  private pdfDocument: pdfjs.PDFDocumentProxy | null = null;
  private currentPage = 1;
  private currentZoom = 1.0;
  private fitMode: 'width' | 'page' | 'none' = 'width';
  private pageRenderers = new Map<number, PageRenderer>();
  private textIndices = new Map<number, PageTextIndex>();
  private highlightLayer = new HighlightLayer();
  private highlights = new Map<string, Highlight>();
  private eventListeners = new Map<EventType, Set<EventListener>>();

  constructor(container: HTMLElement, options: PdfViewerOptions = {}) {
    // Configure pdf.js worker (must be done before loading PDFs)
    const workerUrl = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    this.container = container;
    this.options = {
      initialPage: options.initialPage ?? 1,
      initialZoom: options.initialZoom ?? 1.0,
      fitMode: options.fitMode ?? 'width',
      sidebar: options.sidebar ?? false,
      pageStepper: options.pageStepper ?? false,
      tooltipContent: options.tooltipContent ?? null,
      pageBufferSize: options.pageBufferSize ?? 2,
      onPageChange: options.onPageChange ?? (() => {}),
      onZoomChange: options.onZoomChange ?? (() => {}),
    };

    this.fitMode = this.options.fitMode;
    this.currentZoom = this.options.initialZoom;
    this.highlightLayer.setTooltipContent(this.options.tooltipContent);
  }

  /** Load a PDF from URL or binary data. */
  async load(source: string | ArrayBuffer | Uint8Array): Promise<void> {
    console.log('[PdfViewer] load() called with source:', typeof source);
    try {
      let loadingTask: pdfjs.PDFDocumentLoadingTask;

      if (typeof source === 'string') {
        console.log('[PdfViewer] Loading from URL:', source);
        loadingTask = pdfjs.getDocument(source);
      } else {
        console.log('[PdfViewer] Loading from data');
        loadingTask = pdfjs.getDocument({ data: source });
      }

      loadingTask.promise.then(
        (doc) => console.log('[PdfViewer] Loading task promise resolved'),
        (err) => console.error('[PdfViewer] Loading task promise rejected:', err)
      );

      this.pdfDocument = await loadingTask.promise;
      console.log('[PdfViewer] PDF loaded, pages:', this.pdfDocument.numPages);
      this.currentPage = this.options.initialPage;
      console.log('[PdfViewer] Calling renderCurrentPage for page:', this.currentPage);
      await this.renderCurrentPage();
      console.log('[PdfViewer] renderCurrentPage completed');
    } catch (error) {
      console.error('[PdfViewer] Error in load():', error);
      throw error;
    }
  }

  /** Navigate to a specific page. */
  goToPage(page: number): void {
    if (!this.pdfDocument) return;
    const pageCount = this.pdfDocument.numPages;
    this.currentPage = Math.max(1, Math.min(page, pageCount));
    this.renderCurrentPage().then(() => this.emit('pagechange', this.currentPage));
  }

  /** Get current page number. */
  getCurrentPage(): number {
    return this.currentPage;
  }

  /** Get total page count. */
  getPageCount(): number {
    return this.pdfDocument?.numPages ?? 0;
  }

  /** Set zoom level. */
  setZoom(scale: number): void {
    if (scale === this.currentZoom) return;
    this.currentZoom = scale;
    this.rerenderAllPages().then(() => this.emit('zoomchange', scale));
  }

  /** Get current zoom level. */
  getZoom(): number {
    return this.currentZoom;
  }

  /** Set fit mode. */
  setFitMode(mode: 'width' | 'page' | 'none'): void {
    this.fitMode = mode;
    // Fit mode logic would be implemented here based on container size
    // For now, it's a placeholder for future enhancement
  }

  /** Search for text across all pages. */
  async search(query: string): Promise<SearchMatch[]> {
    if (!this.pdfDocument) return [];

    // Build text indices for all pages if not already built
    await this.ensureAllTextIndices();

    const indices = Array.from(this.textIndices.values()).sort((a, b) => a.pageNumber - b.pageNumber);
    return searchPages(indices, query);
  }

  /** Add a highlight. */
  addHighlight(highlight: Highlight): void {
    this.highlights.set(highlight.id, highlight);
    this.renderHighlights();
  }

  /** Add multiple highlights. */
  addHighlights(highlights: Highlight[]): void {
    for (const h of highlights) {
      this.highlights.set(h.id, h);
    }
    this.renderHighlights();
  }

  /** Remove a highlight by ID. */
  removeHighlight(id: string): void {
    this.highlights.delete(id);
    this.highlightLayer.removeHighlight(id);
  }

  /** Remove all highlights. */
  removeAllHighlights(): void {
    this.highlights.clear();
    this.highlightLayer.clear();
  }

  /** Get all highlights. */
  getHighlights(): Highlight[] {
    return Array.from(this.highlights.values());
  }

  /** Serialize highlights to JSON string. */
  serializeHighlights(): string {
    return JSON.stringify(Array.from(this.highlights.values()));
  }

  /** Deserialize highlights from JSON string. */
  deserializeHighlights(json: string): void {
    try {
      const highlights: Highlight[] = JSON.parse(json);
      this.addHighlights(highlights);
    } catch (e) {
      console.error('Failed to deserialize highlights:', e);
    }
  }

  /** Register an event listener. */
  on(event: EventType, handler: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  /** Unregister an event listener. */
  off(event: EventType, handler: EventListener): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  /** Cleanup resources. */
  destroy(): void {
    this.highlightLayer.destroy();
    this.pageRenderers.forEach((r) => r.destroy());
    this.pageRenderers.clear();
    this.textIndices.clear();
    this.highlights.clear();
    this.eventListeners.clear();
    this.pdfDocument = null;
  }

  private async renderCurrentPage(): Promise<void> {
    if (!this.pdfDocument) return;

    console.log('[PdfViewer] renderCurrentPage: clearing container');
    // Clear container
    this.container.textContent = '';
    this.highlightLayer.mount(this.container);

    console.log('[PdfViewer] Creating PageRenderer');
    const renderer = new PageRenderer(this.currentPage, {
      pageNumber: this.currentPage,
      width: 0,
      height: 0,
      scale: this.currentZoom,
    });
    console.log('[PdfViewer] Calling renderer.render');
    await renderer.render(this.container, this.pdfDocument);
    console.log('[PdfViewer] renderer.render completed');
    this.pageRenderers.set(this.currentPage, renderer);

    // Cache text index
    const textIndex = renderer.getTextIndex();
    if (textIndex) {
      this.textIndices.set(this.currentPage, textIndex);
    }

    this.renderHighlights();
  }

  private async ensureAllTextIndices(): Promise<void> {
    if (!this.pdfDocument) return;

    for (let i = 1; i <= this.pdfDocument.numPages; i++) {
      if (!this.textIndices.has(i)) {
        const renderer = new PageRenderer(i, {
          pageNumber: i,
          width: 0,
          height: 0,
          scale: this.currentZoom,
        });
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = 'position: absolute; visibility: hidden;';
        document.body.appendChild(tempContainer);
        await renderer.render(tempContainer, this.pdfDocument);
        const textIndex = renderer.getTextIndex();
        if (textIndex) {
          this.textIndices.set(i, textIndex);
        }
        renderer.destroy();
        tempContainer.remove();
      }
    }
  }

  private renderHighlights(): void {
    const pageHighlights: Array<{ highlight: Highlight; rects: any[] }> = [];

    for (const highlight of this.highlights.values()) {
      if (highlight.page === this.currentPage) {
        const textIndex = this.textIndices.get(this.currentPage);
        if (textIndex) {
          // Get page viewport dimensions from renderer
          const renderer = this.pageRenderers.get(this.currentPage);
          const viewport = renderer?.getViewport();
          const pageHeight = viewport?.height ?? 792;
          const rects = computeHighlightRects(textIndex, highlight, pageHeight, this.currentZoom);
          pageHighlights.push({ highlight, rects });
        }
      }
    }

    this.highlightLayer.render(pageHighlights);
  }

  private async rerenderAllPages(): Promise<void> {
    // For now, just re-render current page
    await this.renderCurrentPage();
  }

  private emit(event: EventType, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach((handler) => handler(...args));
  }
}
