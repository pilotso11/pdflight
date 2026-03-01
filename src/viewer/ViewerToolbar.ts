// Copyright (c) 2026 Seth Osher. MIT License.

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

const TOOLBAR_STYLES = `
.pdflight-toolbar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 12px;
  min-height: 36px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.75);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 -1px 8px rgba(0, 0, 0, 0.08);
  font-size: 13px;
  color: #1a1a1a;
  user-select: none;
}
.pdflight-toolbar-top {
  position: sticky;
  top: 0;
  bottom: auto;
  border-top: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.08);
}
@supports not (backdrop-filter: blur(1px)) {
  .pdflight-toolbar {
    background: rgba(30, 30, 30, 0.9);
    color: #f0f0f0;
    border-color: rgba(255, 255, 255, 0.1);
  }
  .pdflight-toolbar-btn { color: #f0f0f0; }
  .pdflight-toolbar-select {
    background: rgba(255, 255, 255, 0.15);
    color: #f0f0f0;
    border-color: rgba(255, 255, 255, 0.2);
  }
}
.pdflight-toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}
.pdflight-toolbar-group:last-child { border-right: none; }
.pdflight-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.12s;
}
.pdflight-toolbar-btn:hover { background: rgba(0, 0, 0, 0.08); }
.pdflight-toolbar-btn:active { background: rgba(0, 0, 0, 0.15); }
.pdflight-toolbar-page-info,
.pdflight-toolbar-zoom-level {
  min-width: 80px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pdflight-toolbar-select {
  padding: 4px 8px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.5);
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = TOOLBAR_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
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
    injectStyles();
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
