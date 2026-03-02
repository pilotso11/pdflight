// Copyright (c) 2026 Seth Osher. MIT License.
import type { HighlightRect } from './types';
import type { Highlight } from './types';

export type TooltipContentFn = (highlight: Highlight) => string | HTMLElement;

/**
 * Manages DOM rendering of highlight overlays.
 * Creates/removes div elements for each highlight rect, handles tooltip on hover.
 */
export class HighlightLayer {
  private container: HTMLElement | null = null;
  private highlightElements = new Map<string, HTMLElement[]>();
  private tooltipElement: HTMLElement | null = null;
  private tooltipContentFn: TooltipContentFn | null = null;
  private hideTooltipTimer: number | null = null;

  constructor() {}

  /** Mount the highlight layer into a parent container. */
  mount(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'pdflight-highlight-layer';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `;
    parent.appendChild(this.container);
  }

  /** Set the tooltip content callback. */
  setTooltipContent(fn: TooltipContentFn | null): void {
    this.tooltipContentFn = fn;
  }

  /** Render highlights for a specific page. */
  render(pageHighlights: Array<{ highlight: Highlight; rects: HighlightRect[] }>): void {
    if (!this.container) return;

    // Clear existing highlights for this page
    this.clear();

    for (const { highlight, rects } of pageHighlights) {
      const elements: HTMLElement[] = [];

      for (const rect of rects) {
        const el = this.createHighlightElement(highlight, rect);
        this.container!.appendChild(el);
        elements.push(el);
      }

      this.highlightElements.set(highlight.id, elements);
    }
  }

  /** Clear all highlights. */
  clear(): void {
    this.highlightElements.forEach((els) => {
      els.forEach((el) => el.remove());
    });
    this.highlightElements.clear();
    this.hideTooltip();
  }

  /** Get the DOM elements for a highlight by ID. */
  getHighlightElements(id: string): HTMLElement[] | undefined {
    return this.highlightElements.get(id);
  }

  /** Remove a specific highlight. */
  removeHighlight(id: string): void {
    const elements = this.highlightElements.get(id);
    if (elements) {
      elements.forEach((el) => el.remove());
      this.highlightElements.delete(id);
    }
  }

  private createHighlightElement(highlight: Highlight, rect: HighlightRect): HTMLElement {
    const el = document.createElement('div');
    el.className = 'pdflight-highlight';
    el.dataset.highlightId = highlight.id;

    const isOutline = highlight.style === 'outline';
    const baseStyle = `
      position: absolute;
      left: ${rect.x}px;
      top: ${rect.y}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      pointer-events: auto;
      cursor: pointer;
    `;

    if (isOutline) {
      el.style.cssText = `${baseStyle}
        border: 2px solid ${highlight.color};
        background: transparent;
        mix-blend-mode: normal;
        box-sizing: border-box;
      `;
    } else {
      el.style.cssText = `${baseStyle}
        background-color: ${highlight.color};
        mix-blend-mode: multiply;
      `;
    }

    // Hover events for tooltip
    el.addEventListener('mouseenter', () => this.showTooltip(highlight, rect));
    el.addEventListener('mouseleave', () => this.scheduleHideTooltip());

    return el;
  }

  private showTooltip(highlight: Highlight, rect: HighlightRect): void {
    if (!this.container || !this.tooltipContentFn) return;

    this.hideTooltip();

    const content = this.tooltipContentFn(highlight);
    if (!content) return;

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'pdflight-tooltip';
    this.tooltipElement.style.cssText = `
      position: absolute;
      left: ${rect.x}px;
      top: ${rect.y + rect.height + 4}px;
      background: #333;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 10;
      white-space: nowrap;
    `;

    if (typeof content === 'string') {
      this.tooltipElement.textContent = content;
    } else {
      this.tooltipElement.appendChild(content);
    }

    this.container.appendChild(this.tooltipElement);
  }

  private scheduleHideTooltip(): void {
    if (this.hideTooltipTimer !== null) {
      clearTimeout(this.hideTooltipTimer);
    }
    this.hideTooltipTimer = window.setTimeout(() => this.hideTooltip(), 100);
  }

  private hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
  }

  /** Cleanup. */
  destroy(): void {
    this.clear();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
