import * as pdfjs from 'pdfjs-dist';

const THUMBNAIL_WIDTH = 150;
const MATCH_COUNT_BADGE_COLOR = '#6b7280'; // neutral gray

export interface SidebarOptions {
  onPageClick?: (page: number) => void;
}

export interface PageHighlightInfo {
  colors: string[];
  count: number;
}

/** Strip alpha channel from hex color for full-opacity display at small sizes. */
function stripAlpha(color: string): string {
  if (color.startsWith('#') && color.length === 9) return color.slice(0, 7);
  if (color.startsWith('#') && color.length === 5) return color.slice(0, 4);
  return color;
}

/**
 * Sidebar with lazy-loaded page thumbnails.
 * Uses IntersectionObserver to render thumbnails only when scrolled into view.
 */
export class Sidebar {
  private container: HTMLElement;
  private onPageClick: ((page: number) => void) | null;
  private observer: IntersectionObserver | null = null;
  private wrappers: HTMLElement[] = [];
  private rendered = new Set<number>();
  private activePage = 1;
  private pdfDocument: pdfjs.PDFDocumentProxy | null = null;
  private matchCounts = new Map<number, number>();
  private highlightInfo = new Map<number, PageHighlightInfo>();
  private pageRotations = new Map<number, number>();

  constructor(container: HTMLElement, options: SidebarOptions = {}) {
    this.container = container;
    this.onPageClick = options.onPageClick ?? null;
  }

  /** Create placeholders for all pages and start observing for lazy rendering. */
  async render(pdfDocument: pdfjs.PDFDocumentProxy): Promise<void> {
    this.pdfDocument = pdfDocument;
    this.container.textContent = '';
    this.wrappers = [];
    this.rendered.clear();

    const numPages = pdfDocument.numPages;

    // Get first page viewport to compute aspect ratio (most pages share the same ratio)
    const firstPage = await pdfDocument.getPage(1);
    const defaultViewport = firstPage.getViewport({ scale: 1, rotation: this.pageRotations.get(1) ?? 0 });
    const defaultAspect = defaultViewport.height / defaultViewport.width;

    for (let i = 1; i <= numPages; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdflight-thumbnail';
      if (i === this.activePage) wrapper.classList.add('pdflight-thumbnail-active');
      wrapper.dataset.page = String(i);
      wrapper.style.width = `${THUMBNAIL_WIDTH}px`;
      wrapper.style.height = `${Math.round(THUMBNAIL_WIDTH * defaultAspect)}px`;
      wrapper.style.cursor = 'pointer';

      // Page number label
      const label = document.createElement('div');
      label.className = 'pdflight-thumbnail-label';
      label.textContent = String(i);
      wrapper.appendChild(label);

      wrapper.addEventListener('click', () => this.onPageClick?.(i));

      this.container.appendChild(wrapper);
      this.wrappers.push(wrapper);
    }

    // Set up IntersectionObserver with rootMargin to buffer 2 thumbnail heights
    const bufferPx = Math.round(THUMBNAIL_WIDTH * defaultAspect) * 2;
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = Number((entry.target as HTMLElement).dataset.page);
            if (!this.rendered.has(pageNum)) {
              this.renderThumbnail(pageNum);
            }
          }
        }
      },
      {
        root: this.container,
        rootMargin: `${bufferPx}px 0px`,
      },
    );

    for (const wrapper of this.wrappers) {
      this.observer.observe(wrapper);
    }
  }

  /** Update the active page highlight. */
  setActivePage(page: number): void {
    this.activePage = page;
    for (const wrapper of this.wrappers) {
      const p = Number(wrapper.dataset.page);
      wrapper.classList.toggle('pdflight-thumbnail-active', p === page);
    }
  }

  /** Scroll the active thumbnail into view. */
  scrollToActive(): void {
    const wrapper = this.wrappers[this.activePage - 1];
    if (wrapper) {
      wrapper.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /** Update match count badges (gray, search-driven or manual). */
  updateMatchCounts(counts: Map<number, number>): void {
    this.matchCounts = new Map(counts);
    this.renderIndicators();
  }

  /** Clear match count badges. */
  clearMatchCounts(): void {
    this.matchCounts.clear();
    this.renderIndicators();
  }

  /** Update highlight indicators (edge bars and colored badges). */
  updateHighlightIndicators(pageInfo: Map<number, PageHighlightInfo>): void {
    this.highlightInfo = new Map(pageInfo);
    this.renderIndicators();
  }

  /** Update rotation for a specific page and re-render its thumbnail. */
  setPageRotation(page: number, rotation: number): void {
    if ((this.pageRotations.get(page) ?? 0) === rotation) return;
    this.pageRotations.set(page, rotation);

    const wrapper = this.wrappers[page - 1];
    if (!wrapper) return;

    // Invalidate and remove the existing canvas for this page
    this.rendered.delete(page);
    wrapper.querySelector('canvas')?.remove();

    // Update wrapper dimensions for new rotation
    this.updateSingleWrapperDimension(page, wrapper);

    // Re-observe to trigger lazy rendering
    if (this.observer) {
      this.observer.unobserve(wrapper);
      this.observer.observe(wrapper);
    }
  }

  /** Cleanup resources. */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.container.textContent = '';
    this.wrappers = [];
    this.rendered.clear();
    this.matchCounts.clear();
    this.highlightInfo.clear();
    this.pdfDocument = null;
  }

  /**
   * Render indicators by composing match counts and highlight info.
   * Highlights take visual priority for color; match counts provide gray fallback.
   */
  private renderIndicators(): void {
    for (const wrapper of this.wrappers) {
      const pageNum = Number(wrapper.dataset.page);
      const hlInfo = this.highlightInfo.get(pageNum);
      const matchCount = this.matchCounts.get(pageNum);

      // Remove existing indicators
      wrapper.querySelector('.pdflight-thumbnail-edge-bar')?.remove();
      wrapper.querySelector('.pdflight-thumbnail-badge')?.remove();

      const hasHighlights = hlInfo && hlInfo.count > 0;
      const hasMatchCount = matchCount !== undefined && matchCount > 0;

      if (!hasHighlights && !hasMatchCount) continue;

      // Edge bar (only when highlights exist)
      if (hasHighlights) {
        const colors = hlInfo.colors.map(stripAlpha);
        const bar = document.createElement('div');
        bar.className = 'pdflight-thumbnail-edge-bar';
        if (colors.length === 1) {
          bar.style.background = colors[0];
        } else {
          const stops = colors.map((c, i) => {
            const start = (i / colors.length) * 100;
            const end = ((i + 1) / colors.length) * 100;
            return `${c} ${start}%, ${c} ${end}%`;
          }).join(', ');
          bar.style.background = `linear-gradient(to bottom, ${stops})`;
        }
        wrapper.appendChild(bar);
      }

      // Count badge (always gray) — show match count if available, else highlight count
      const badgeCount = hasMatchCount ? matchCount : hlInfo!.count;
      const badge = document.createElement('div');
      badge.className = 'pdflight-thumbnail-badge';
      badge.textContent = String(badgeCount);
      badge.style.backgroundColor = MATCH_COUNT_BADGE_COLOR;
      wrapper.appendChild(badge);
    }
  }

  private async updateSingleWrapperDimension(pageNum: number, wrapper: HTMLElement): Promise<void> {
    if (!this.pdfDocument) return;
    const page = await this.pdfDocument.getPage(pageNum);
    const rotation = this.pageRotations.get(pageNum) ?? 0;
    const vp = page.getViewport({ scale: 1, rotation });
    const aspect = vp.height / vp.width;
    wrapper.style.height = `${Math.round(THUMBNAIL_WIDTH * aspect)}px`;
  }

  private async renderThumbnail(pageNum: number): Promise<void> {
    if (!this.pdfDocument || this.rendered.has(pageNum)) return;
    this.rendered.add(pageNum);

    const page = await this.pdfDocument.getPage(pageNum);
    const rotation = this.pageRotations.get(pageNum) ?? 0;
    const unscaledViewport = page.getViewport({ scale: 1, rotation });
    const scale = THUMBNAIL_WIDTH / unscaledViewport.width;
    const viewport = page.getViewport({ scale, rotation });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.style.display = 'block';

    const context = canvas.getContext('2d');
    if (!context) return;

    await page.render({
      canvasContext: context,
      viewport,
    } as any).promise;

    const wrapper = this.wrappers[pageNum - 1];
    if (!wrapper) return;

    // Update wrapper height to match actual rendered aspect ratio
    wrapper.style.height = `${viewport.height}px`;

    // Insert canvas before the label
    const label = wrapper.querySelector('.pdflight-thumbnail-label');
    if (label) {
      wrapper.insertBefore(canvas, label);
    } else {
      wrapper.appendChild(canvas);
    }
  }
}
