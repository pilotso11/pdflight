// src/viewer/ViewerToolbar.ts

export interface ToolbarConfig {
  stepper?: boolean;
  zoom?: boolean;
  rotate?: boolean;
  fit?: boolean;
  position?: 'top' | 'bottom';
}

export interface ToolbarCallbacks {
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitModeChange: (mode: 'width' | 'page' | 'none') => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
}

/** Resolve shorthand (boolean) to full config object. */
export function resolveToolbarConfig(
  input: ToolbarConfig | boolean | undefined,
): ToolbarConfig | null {
  if (input === false || input === undefined) return null;
  if (input === true)
    return { stepper: true, zoom: true, rotate: true, fit: true, position: 'bottom' };
  return {
    stepper: input.stepper ?? true,
    zoom: input.zoom ?? true,
    rotate: input.rotate ?? true,
    fit: input.fit ?? true,
    position: input.position ?? 'bottom',
  };
}

export class ViewerToolbar {
  private el: HTMLElement;
  private config: ToolbarConfig;
  private callbacks: ToolbarCallbacks;

  // Refs to dynamic elements
  private pageInfoEl: HTMLElement | null = null;
  private zoomLevelEl: HTMLElement | null = null;
  private fitSelectEl: HTMLSelectElement | null = null;

  constructor(container: HTMLElement, config: ToolbarConfig, callbacks: ToolbarCallbacks) {
    this.config = config;
    this.callbacks = callbacks;

    this.el = document.createElement('div');
    this.el.className = 'pdflight-toolbar';
    this.el.dataset.testid = 'pdflight-toolbar';
    if (config.position === 'top') {
      this.el.classList.add('pdflight-toolbar-top');
    }

    this.buildControls();

    if (config.position === 'top') {
      container.prepend(this.el);
    } else {
      container.appendChild(this.el);
    }
  }

  /** Update the page info display. */
  updatePageInfo(current: number, total: number): void {
    if (this.pageInfoEl) {
      this.pageInfoEl.textContent = `Page ${current} of ${total}`;
    }
  }

  /** Update the zoom level display. */
  updateZoomLevel(zoom: number): void {
    if (this.zoomLevelEl) {
      this.zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
    }
  }

  /** Update the fit mode selector. */
  updateFitMode(mode: 'width' | 'page' | 'none'): void {
    if (this.fitSelectEl) {
      this.fitSelectEl.value = mode;
    }
  }

  /** Cleanup. */
  destroy(): void {
    this.el.remove();
  }

  private buildControls(): void {
    if (this.config.stepper) this.addStepper();
    if (this.config.rotate) this.addRotate();
    if (this.config.zoom) this.addZoom();
    if (this.config.fit) this.addFitMode();
  }

  private addStepper(): void {
    const group = this.createGroup();

    const prev = document.createElement('button');
    prev.className = 'pdflight-toolbar-btn';
    prev.textContent = '\u25C0';
    prev.title = 'Previous page';
    prev.addEventListener('click', this.callbacks.onPrevPage);

    this.pageInfoEl = document.createElement('span');
    this.pageInfoEl.className = 'pdflight-toolbar-page-info';
    this.pageInfoEl.textContent = 'Page 1 of 1';

    const next = document.createElement('button');
    next.className = 'pdflight-toolbar-btn';
    next.textContent = '\u25B6';
    next.title = 'Next page';
    next.addEventListener('click', this.callbacks.onNextPage);

    group.append(prev, this.pageInfoEl, next);
    this.el.appendChild(group);
  }

  private addRotate(): void {
    const group = this.createGroup();

    const ccw = document.createElement('button');
    ccw.className = 'pdflight-toolbar-btn';
    ccw.textContent = '\u21BA';
    ccw.title = 'Rotate counterclockwise';
    ccw.addEventListener('click', this.callbacks.onRotateCCW);

    const cw = document.createElement('button');
    cw.className = 'pdflight-toolbar-btn';
    cw.textContent = '\u21BB';
    cw.title = 'Rotate clockwise';
    cw.addEventListener('click', this.callbacks.onRotateCW);

    group.append(ccw, cw);
    this.el.appendChild(group);
  }

  private addZoom(): void {
    const group = this.createGroup();

    const out = document.createElement('button');
    out.className = 'pdflight-toolbar-btn';
    out.textContent = '\u2212';
    out.title = 'Zoom out';
    out.addEventListener('click', this.callbacks.onZoomOut);

    this.zoomLevelEl = document.createElement('span');
    this.zoomLevelEl.className = 'pdflight-toolbar-zoom-level';
    this.zoomLevelEl.textContent = '100%';

    const zoomIn = document.createElement('button');
    zoomIn.className = 'pdflight-toolbar-btn';
    zoomIn.textContent = '+';
    zoomIn.title = 'Zoom in';
    zoomIn.addEventListener('click', this.callbacks.onZoomIn);

    group.append(out, this.zoomLevelEl, zoomIn);
    this.el.appendChild(group);
  }

  private addFitMode(): void {
    const group = this.createGroup();

    this.fitSelectEl = document.createElement('select');
    this.fitSelectEl.className = 'pdflight-toolbar-select';
    this.fitSelectEl.title = 'Fit mode';

    for (const [value, label] of [
      ['width', 'Fit Width'],
      ['page', 'Fit Page'],
      ['none', 'None'],
    ] as const) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      this.fitSelectEl.appendChild(opt);
    }

    this.fitSelectEl.addEventListener('change', () => {
      this.callbacks.onFitModeChange(this.fitSelectEl!.value as 'width' | 'page' | 'none');
    });

    group.appendChild(this.fitSelectEl);
    this.el.appendChild(group);
  }

  private createGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'pdflight-toolbar-group';
    return group;
  }
}
