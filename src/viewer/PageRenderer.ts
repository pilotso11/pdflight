import * as pdfjs from 'pdfjs-dist';
import type { PageTextIndex, PdflightTextItem } from '../types';
import { estimateProportionalCharWidths } from '../utils/text.js';

export interface PageViewport {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * Manages rendering of a single PDF page: canvas, text layer, and highlight layer.
 */
export class PageRenderer {
  private container: HTMLElement | null = null;
  private pageContainer: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private textLayerDiv: HTMLDivElement | null = null;
  private pdfPage: pdfjs.PDFPageProxy | null = null;
  private textIndex: PageTextIndex | null = null;
  private currentScale = 1.0;
  private pageViewport: PageViewport;

  constructor(
    private pageNumber: number,
    viewport: PageViewport,
  ) {
    this.pageViewport = viewport;
    this.currentScale = viewport.scale;
  }

  /** Get the page viewport. */
  getViewport(): PageViewport {
    return this.pageViewport;
  }

  /** Update the page viewport. */
  setViewport(viewport: PageViewport): void {
    this.pageViewport = viewport;
  }

  /** Get the text index for this page (built during first render). */
  getTextIndex(): PageTextIndex | null {
    return this.textIndex;
  }

  /** Get the page container element (for mounting highlight layer). */
  getPageContainer(): HTMLElement | null {
    return this.pageContainer;
  }

  /** Get the unscaled PDF page height (in PDF points, not CSS pixels). */
  getPdfPageHeight(): number {
    if (!this.pdfPage) return 0;
    const unscaledViewport = this.pdfPage.getViewport({ scale: 1 });
    return unscaledViewport.height;
  }

  /** Get the PDF page proxy. */
  getPdfPage(): pdfjs.PDFPageProxy | null {
    return this.pdfPage;
  }

  /** Render the page to a container. */
  async render(container: HTMLElement, pdfDocument: pdfjs.PDFDocumentProxy): Promise<void> {
    console.log('[PageRenderer] render starting for page', this.pageNumber);
    this.container = container;
    this.pdfPage = await pdfDocument.getPage(this.pageNumber);
    console.log('[PageRenderer] Got PDF page');
    const viewport = this.pdfPage.getViewport({ scale: this.currentScale });
    console.log('[PageRenderer] Got viewport:', viewport.width, 'x', viewport.height);

    // Update pageViewport with actual dimensions
    this.pageViewport = {
      pageNumber: this.pageNumber,
      width: viewport.width,
      height: viewport.height,
      scale: this.currentScale,
    };

    // Create canvas
    console.log('[PageRenderer] Creating canvas');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pdflight-canvas';
    this.canvas.width = viewport.width;
    this.canvas.height = viewport.height;
    this.canvas.style.cssText = `width: ${viewport.width}px; height: ${viewport.height}px;`;

    // Create text layer container
    this.textLayerDiv = document.createElement('div');
    this.textLayerDiv.className = 'pdflight-text-layer';
    this.textLayerDiv.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${viewport.width}px;
      height: ${viewport.height}px;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    `;

    // Render PDF to canvas
    console.log('[PageRenderer] Getting 2D context');
    const context = this.canvas.getContext('2d');
    if (!context) {
      console.error('[PageRenderer] Failed to get 2D context!');
      return;
    }
    const renderContext = {
      canvasContext: context,
      viewport,
    } as any; // Using any due to pdf.js type definitions
    console.log('[PageRenderer] Starting PDF render to canvas');
    await this.pdfPage.render(renderContext).promise;
    console.log('[PageRenderer] PDF render to canvas completed');

    // Render text layer
    console.log('[PageRenderer] Getting text content');
    const textContent = await this.pdfPage.getTextContent() as any;
    console.log('[PageRenderer] Got text content, items:', textContent.items.length);
    await this.renderTextLayer(textContent, viewport);

    // Build text index
    this.textIndex = await this.buildTextIndex(textContent);

    // Assemble the page container
    console.log('[PageRenderer] Assembling page container');
    this.pageContainer = document.createElement('div');
    this.pageContainer.className = 'pdflight-page-container';
    this.pageContainer.style.cssText = `
      position: relative;
      width: ${viewport.width}px;
      height: ${viewport.height}px;
      margin: 20px auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    this.pageContainer.appendChild(this.canvas);
    this.pageContainer.appendChild(this.textLayerDiv);

    console.log('[PageRenderer] Appending page container to DOM');
    container.appendChild(this.pageContainer);
    console.log('[PageRenderer] render completed');
  }

  private async renderTextLayer(textContent: any, viewport: any): Promise<void> {
    // Try to use pdf.js text layer rendering if available
    try {
      const pdfViewerModule = await import('pdfjs-dist/web/pdf_viewer.mjs') as any;
      const TextLayer = pdfViewerModule.TextLayer;

      if (TextLayer) {
        const textLayer = new TextLayer({
          textContentSource: textContent,
          container: this.textLayerDiv!,
          viewport,
          textDivs: [],
        });

        await textLayer.render();
        return;
      }
    } catch {
      // Fall through to simple text rendering
    }

    // Fallback: simple text rendering
    this.renderSimpleTextLayer(textContent, viewport);
  }

  private renderSimpleTextLayer(textContent: any, viewport: any): void {
    const textLayer = this.textLayerDiv!;

    for (const item of textContent.items) {
      const textItem = item;
      if (!textItem.str) continue;

      const div = document.createElement('div');
      div.textContent = textItem.str;

      const tx = textItem.transform[4];
      const ty = textItem.transform[5];
      const fontSize = textItem.transform[0];

      // Convert PDF coordinates to CSS coordinates
      const cssX = tx;
      const cssY = viewport.height - ty - fontSize;

      div.style.cssText = `
        position: absolute;
        left: ${cssX}px;
        top: ${cssY}px;
        font-size: ${fontSize}px;
        font-family: ${textItem.fontName || 'sans-serif'};
        white-space: pre;
        transform-origin: 0% 0%;
      `;

      textLayer.appendChild(div);
    }
  }

  private async buildTextIndex(textContent: any): Promise<PageTextIndex> {
    const { buildPageTextIndex } = await import('../search/TextIndex.js');

    const items: PdflightTextItem[] = [];

    for (const item of textContent.items) {
      const textItem = item;
      const charWidths = this.estimateCharWidths(textItem);

      items.push({
        str: textItem.str || '',
        transform: [...textItem.transform],
        width: textItem.width || 0,
        height: textItem.height || textItem.transform[0] || 0,
        fontName: textItem.fontName || '',
        hasEOL: textItem.hasEOL || false,
        charWidths,
      });
    }

    return buildPageTextIndex(this.pageNumber, items);
  }

  private estimateCharWidths(textItem: any): number[] {
    const str = textItem.str || '';
    const totalWidth = textItem.width || 0;
    const fontName = textItem.fontName || '';

    if (str.length === 0) return [];
    if (totalWidth === 0) {
      const fontSize = textItem.transform[0];
      return Array(str.length).fill(fontSize * 0.5);
    }

    return estimateProportionalCharWidths(str, totalWidth, fontName);
  }

  /** Update zoom level and re-render. */
  async setZoom(scale: number, pdfDocument: pdfjs.PDFDocumentProxy): Promise<void> {
    if (this.currentScale === scale || !this.container) return;

    this.currentScale = scale;

    // Re-render the page
    await this.render(this.container, pdfDocument);
  }

  /** Cleanup resources. */
  destroy(): void {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    if (this.textLayerDiv) {
      this.textLayerDiv.remove();
      this.textLayerDiv = null;
    }
    if (this.container) {
      this.container.textContent = '';
      this.container = null;
    }
    this.pdfPage = null;
    this.textIndex = null;
  }
}
