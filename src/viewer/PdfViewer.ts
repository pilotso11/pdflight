import * as pdfjs from 'pdfjs-dist';
import type { PageTextIndex } from '../types';
import type { SearchMatch } from '../search/types';
import type { Highlight } from '../highlight/types';
import { searchPages } from '../search/SearchEngine';
import { computeHighlightRects } from '../highlight/HighlightEngine';
import { HighlightLayer } from '../highlight/HighlightLayer';
import { PageRenderer } from './PageRenderer';
import { Sidebar, type PageHighlightInfo } from './Sidebar';
import { ViewerToolbar, resolveToolbarConfig, type ToolbarConfig } from './ViewerToolbar';

export interface PdfViewerOptions {
  initialPage?: number;
  initialZoom?: number;
  fitMode?: 'width' | 'page' | 'none';
  sidebar?: boolean;
  pageStepper?: boolean;
  showSearchMatchCounts?: boolean;
  tooltipContent?: (highlight: Highlight) => string | HTMLElement;
  pageBufferSize?: number;
  toolbar?: ToolbarConfig | boolean;
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
  private options: Omit<Required<PdfViewerOptions>, 'tooltipContent' | 'toolbar'> & { tooltipContent: ((highlight: Highlight) => string | HTMLElement) | null };
  private pdfDocument: pdfjs.PDFDocumentProxy | null = null;
  private currentPage = 1;
  private currentZoom = 1.0;
  private fitMode: 'width' | 'page' | 'none' = 'width';
  private currentRotation = 0;
  private pageRenderers = new Map<number, PageRenderer>();
  private textIndices = new Map<number, PageTextIndex>();
  private highlightLayer = new HighlightLayer();
  private highlights = new Map<string, Highlight>();
  private eventListeners = new Map<EventType, Set<EventListener>>();
  private sidebar: Sidebar | null = null;
  private toolbar: ViewerToolbar | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pageDimensions = new Map<number, { width: number; height: number }>();

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
      showSearchMatchCounts: options.showSearchMatchCounts ?? false,
      tooltipContent: options.tooltipContent ?? null,
      pageBufferSize: options.pageBufferSize ?? 2,
      onPageChange: options.onPageChange ?? (() => {}),
      onZoomChange: options.onZoomChange ?? (() => {}),
    };

    this.fitMode = this.options.fitMode;
    this.currentZoom = this.options.initialZoom;
    this.highlightLayer.setTooltipContent(this.options.tooltipContent);

    // Observe container resizes to reapply fit mode
    this.resizeObserver = new ResizeObserver(() => {
      if (this.fitMode !== 'none' && this.pdfDocument) {
        this.applyFitMode();
      }
    });
    this.resizeObserver.observe(this.container);

    // Create built-in toolbar if configured
    const toolbarConfig = resolveToolbarConfig(options.toolbar);
    if (toolbarConfig) {
      this.toolbar = new ViewerToolbar(this.container, toolbarConfig, {
        onPrevPage: () => this.goToPage(this.currentPage - 1),
        onNextPage: () => this.goToPage(this.currentPage + 1),
        onZoomIn: () => this.setZoom(this.currentZoom + 0.25),
        onZoomOut: () => this.setZoom(Math.max(0.25, this.currentZoom - 0.25)),
        onFitModeChange: (mode) => this.setFitMode(mode),
        onRotateCW: () => this.rotate(90),
        onRotateCCW: () => this.rotate(-90),
      });
    }
  }

  /** Load a PDF from URL or binary data. */
  async load(source: string | ArrayBuffer | Uint8Array): Promise<void> {
    console.log('[PdfViewer] load() called with source:', typeof source);
    this.currentRotation = 0;
    this.pageDimensions.clear();
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

      // Cache unscaled page dimensions from first page for fit calculations
      const firstPage = await this.pdfDocument.getPage(1);
      const unscaledVp = firstPage.getViewport({ scale: 1, rotation: this.currentRotation });
      this.pageDimensions.set(1, { width: unscaledVp.width, height: unscaledVp.height });

      // Apply fit mode to compute initial zoom
      if (this.fitMode !== 'none') {
        this.applyFitMode();
      }

      console.log('[PdfViewer] Calling renderCurrentPage for page:', this.currentPage);
      await this.renderCurrentPage();
      console.log('[PdfViewer] renderCurrentPage completed');

      // Render sidebar thumbnails if connected
      if (this.sidebar) {
        await this.sidebar.render(this.pdfDocument);
        this.sidebar.setActivePage(this.currentPage);
      }

      // Update toolbar state
      this.toolbar?.updatePageInfo(this.currentPage, this.pdfDocument.numPages);
      this.toolbar?.updateZoomLevel(this.currentZoom);
      this.toolbar?.updateFitMode(this.fitMode);
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
    this.renderCurrentPage().then(() => {
      if (this.fitMode !== 'none') {
        this.applyFitMode();
      }
      this.sidebar?.setActivePage(this.currentPage);
      this.sidebar?.scrollToActive();
      this.toolbar?.updatePageInfo(this.currentPage, this.pdfDocument!.numPages);
      this.emit('pagechange', this.currentPage);
    });
  }

  /** Get current page number. */
  getCurrentPage(): number {
    return this.currentPage;
  }

  /** Get total page count. */
  getPageCount(): number {
    return this.pdfDocument?.numPages ?? 0;
  }

  /** Set zoom level. Switches fit mode to 'none' since zoom is now manual. */
  setZoom(scale: number): void {
    if (scale === this.currentZoom) return;
    this.fitMode = 'none';
    this.currentZoom = scale;
    this.toolbar?.updateZoomLevel(scale);
    this.toolbar?.updateFitMode('none');
    this.rerenderAllPages().then(() => this.emit('zoomchange', scale));
  }

  /** Get current zoom level. */
  getZoom(): number {
    return this.currentZoom;
  }

  /** Set fit mode. Recomputes zoom to match the container dimensions. */
  setFitMode(mode: 'width' | 'page' | 'none'): void {
    this.fitMode = mode;
    this.toolbar?.updateFitMode(mode);
    if (mode === 'none' || !this.pdfDocument) return;
    this.applyFitMode();
  }

  /** Get current fit mode. */
  getFitMode(): 'width' | 'page' | 'none' {
    return this.fitMode;
  }

  /** Rotate the page by 90 or -90 degrees. */
  rotate(degrees: 90 | -90): void {
    this.currentRotation = ((this.currentRotation + degrees) % 360 + 360) % 360;
    // Clear dimension cache since rotation changes effective dimensions
    this.pageDimensions.clear();
    this.renderCurrentPage().then(() => {
      // Re-cache dimensions for current page and reapply fit
      if (this.fitMode !== 'none') {
        this.applyFitMode();
      }
      this.sidebar?.setRotation(this.currentRotation);
      this.emit('zoomchange', this.currentZoom);
    });
  }

  /** Get current rotation in degrees (0, 90, 180, 270). */
  getRotation(): number {
    return this.currentRotation;
  }

  /** Search for text across all pages. */
  async search(query: string): Promise<SearchMatch[]> {
    if (!this.pdfDocument) return [];

    // Build text indices for all pages if not already built
    await this.ensureAllTextIndices();

    const indices = Array.from(this.textIndices.values()).sort((a, b) => a.pageNumber - b.pageNumber);
    const results = searchPages(indices, query);

    // Auto-update sidebar match counts if flag is enabled
    if (this.options.showSearchMatchCounts && this.sidebar) {
      const counts = new Map<number, number>();
      for (const match of results) {
        counts.set(match.page, (counts.get(match.page) ?? 0) + 1);
      }
      this.sidebar.updateMatchCounts(counts);
    }

    return results;
  }

  /** Add a highlight. */
  addHighlight(highlight: Highlight): void {
    this.highlights.set(highlight.id, highlight);
    this.renderHighlights();
    this.updateSidebarIndicators();
  }

  /** Add multiple highlights. */
  addHighlights(highlights: Highlight[]): void {
    for (const h of highlights) {
      this.highlights.set(h.id, h);
    }
    this.renderHighlights();
    this.updateSidebarIndicators();
  }

  /** Remove a highlight by ID. */
  removeHighlight(id: string): void {
    this.highlights.delete(id);
    this.highlightLayer.removeHighlight(id);
    this.updateSidebarIndicators();
  }

  /** Remove all highlights. */
  removeAllHighlights(): void {
    this.highlights.clear();
    this.highlightLayer.clear();
    this.updateSidebarIndicators();
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

  /** Set match count badges on sidebar thumbnails (manual override). */
  setSidebarMatchCounts(counts: Map<number, number>): void {
    this.sidebar?.updateMatchCounts(counts);
  }

  /** Clear match count badges from sidebar thumbnails. */
  clearSidebarMatchCounts(): void {
    this.sidebar?.clearMatchCounts();
  }

  /** Connect a sidebar container for page thumbnails. */
  setSidebarContainer(container: HTMLElement): void {
    this.sidebar = new Sidebar(container, {
      onPageClick: (page) => this.goToPage(page),
    });

    // If PDF is already loaded, render thumbnails immediately
    if (this.pdfDocument) {
      this.sidebar.render(this.pdfDocument);
      this.sidebar.setActivePage(this.currentPage);
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
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.sidebar?.destroy();
    this.sidebar = null;
    this.toolbar?.destroy();
    this.toolbar = null;
    this.highlightLayer.destroy();
    this.pageRenderers.forEach((r) => r.destroy());
    this.pageRenderers.clear();
    this.textIndices.clear();
    this.pageDimensions.clear();
    this.highlights.clear();
    this.eventListeners.clear();
    this.pdfDocument = null;
  }

  private async renderCurrentPage(): Promise<void> {
    if (!this.pdfDocument) return;

    console.log('[PdfViewer] renderCurrentPage: clearing container');
    // Remove only page containers, preserving the toolbar
    for (const child of Array.from(this.container.children)) {
      if (!child.classList.contains('pdflight-toolbar')) {
        child.remove();
      }
    }

    console.log('[PdfViewer] Creating PageRenderer');
    const renderer = new PageRenderer(this.currentPage, {
      pageNumber: this.currentPage,
      width: 0,
      height: 0,
      scale: this.currentZoom,
    }, this.currentRotation);
    console.log('[PdfViewer] Calling renderer.render');
    await renderer.render(this.container, this.pdfDocument);
    console.log('[PdfViewer] renderer.render completed');
    this.pageRenderers.set(this.currentPage, renderer);

    // Ensure toolbar stays at the end (bottom) or start (top) of the container
    const toolbarEl = this.container.querySelector('.pdflight-toolbar');
    if (toolbarEl && !toolbarEl.classList.contains('pdflight-toolbar-top')) {
      this.container.appendChild(toolbarEl);
    } else if (toolbarEl?.classList.contains('pdflight-toolbar-top')) {
      this.container.prepend(toolbarEl);
    }

    // Cache page dimensions for fit mode (use unscaled PDF page dimensions)
    if (!this.pageDimensions.has(this.currentPage) && renderer.getPdfPage()) {
      const unscaledVp = renderer.getPdfPage()!.getViewport({ scale: 1, rotation: this.currentRotation });
      this.pageDimensions.set(this.currentPage, { width: unscaledVp.width, height: unscaledVp.height });
    }

    // Mount highlight layer to the page container (not main container)
    // This ensures highlights are positioned relative to the actual PDF page
    const pageContainer = renderer.getPageContainer();
    if (pageContainer) {
      this.highlightLayer.mount(pageContainer);
    }

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
        }, this.currentRotation);
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
          // Get page renderer for accessing PDF page
          const renderer = this.pageRenderers.get(this.currentPage);
          const viewport = renderer?.getViewport();

          // Use unscaled PDF page height (not the scaled viewport height)
          // This is critical for correct highlight positioning at different zoom levels
          const pdfPageHeight = renderer?.getPdfPageHeight() ?? viewport?.height ?? 792;

          // Get unrotated page dimensions for rotation transform
          const pdfPage = renderer?.getPdfPage();
          const unrotatedVp = pdfPage?.getViewport({ scale: 1, rotation: 0 });
          const unrotatedWidth = unrotatedVp?.width ?? 0;
          const unrotatedHeight = unrotatedVp?.height ?? 0;

          const rects = computeHighlightRects(
            textIndex, highlight, pdfPageHeight, this.currentZoom,
            this.currentRotation, unrotatedWidth, unrotatedHeight,
          );
          pageHighlights.push({ highlight, rects });
        }
      }
    }

    this.highlightLayer.render(pageHighlights);
  }

  private updateSidebarIndicators(): void {
    if (!this.sidebar) return;

    const pageInfo = new Map<number, PageHighlightInfo>();
    for (const h of this.highlights.values()) {
      const existing = pageInfo.get(h.page);
      if (existing) {
        existing.count++;
        if (!existing.colors.includes(h.color)) {
          existing.colors.push(h.color);
        }
      } else {
        pageInfo.set(h.page, { colors: [h.color], count: 1 });
      }
    }
    this.sidebar.updateHighlightIndicators(pageInfo);
  }

  /**
   * Compute and apply the zoom level for the current fit mode.
   * Uses the container's client dimensions and the unscaled PDF page size.
   * Padding (40px) accounts for the page container's auto-margin.
   */
  private applyFitMode(): void {
    const dims = this.pageDimensions.get(this.currentPage);
    if (!dims) return;

    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;
    const padding = 40; // matches page container margin (20px each side)

    let newZoom: number;
    if (this.fitMode === 'width') {
      newZoom = (containerWidth - padding) / dims.width;
    } else if (this.fitMode === 'page') {
      const scaleW = (containerWidth - padding) / dims.width;
      const scaleH = (containerHeight - padding) / dims.height;
      newZoom = Math.min(scaleW, scaleH);
    } else {
      return;
    }

    // Clamp to reasonable range and avoid re-render for tiny changes
    newZoom = Math.max(0.1, Math.min(newZoom, 10));
    if (Math.abs(newZoom - this.currentZoom) < 0.001) return;

    this.currentZoom = newZoom;
    this.toolbar?.updateZoomLevel(this.currentZoom);
    this.emit('zoomchange', this.currentZoom);

    // Re-render if PDF is loaded and we have a rendered page
    if (this.pdfDocument && this.pageRenderers.size > 0) {
      this.rerenderAllPages();
    }
  }

  private async rerenderAllPages(): Promise<void> {
    // For now, just re-render current page
    await this.renderCurrentPage();
  }

  private emit(event: EventType, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach((handler) => handler(...args));
  }
}
