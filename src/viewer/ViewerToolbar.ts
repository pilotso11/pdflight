// Copyright (c) 2026 Seth Osher. MIT License.

export interface ToolbarConfig {
  stepper?: boolean;
  zoom?: boolean;
  rotate?: boolean;
  fit?: boolean;
  searchNav?: boolean;
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
  onPrevMatch?: () => void;
  onNextMatch?: () => void;
}

/** Resolve shorthand (boolean) to full config object. */
export function resolveToolbarConfig(
  input: ToolbarConfig | boolean | undefined,
): ToolbarConfig | null {
  if (input === false || input === undefined) return null;
  if (input === true)
    return { stepper: true, zoom: true, rotate: true, fit: true, searchNav: false, position: 'bottom' };
  return {
    stepper: input.stepper ?? true,
    zoom: input.zoom ?? true,
    rotate: input.rotate ?? true,
    fit: input.fit ?? true,
    searchNav: input.searchNav ?? false,
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px 2px;
  padding: 6px 12px;
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
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}
@media (max-width: 500px) {
  .pdflight-toolbar { justify-content: center; gap: 4px; }
  .pdflight-toolbar-group { flex-shrink: 1; padding: 0 4px; }
  .pdflight-toolbar-page-info,
  .pdflight-toolbar-zoom-level,
  .pdflight-toolbar-match-info { min-width: 0; }
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
.pdflight-toolbar-zoom-level,
.pdflight-toolbar-match-info {
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pdflight-toolbar-page-info { min-width: 80px; }
.pdflight-toolbar-zoom-level { min-width: 44px; }
.pdflight-toolbar-match-info { min-width: 72px; }
.pdflight-toolbar-select {
  padding: 4px 8px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.5);
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
.pdflight-toolbar-fit-btn {
  display: none;
  width: auto;
  padding: 4px 8px;
  font-size: 12px;
}
@media (max-width: 500px) {
  .pdflight-toolbar-fit-select { display: none; }
  .pdflight-toolbar-fit-btn { display: inline-flex; }
}
`;

const FIT_MODES = ['width', 'page', 'none'] as const;
const FIT_MODE_LABELS: Record<string, string> = { width: 'Fit W', page: 'Fit P', none: 'None' };

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
  private fitBtnEl: HTMLButtonElement | null = null;
  private matchInfoEl: HTMLElement | null = null;
  private prevMatchBtn: HTMLButtonElement | null = null;
  private nextMatchBtn: HTMLButtonElement | null = null;

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

  /** Update the match info display. */
  updateMatchInfo(current: number, total: number): void {
    if (this.matchInfoEl) {
      this.matchInfoEl.textContent = `Match ${current}/${total}`;
    }
    if (this.prevMatchBtn) this.prevMatchBtn.disabled = total === 0 || !this.callbacks.onPrevMatch;
    if (this.nextMatchBtn) this.nextMatchBtn.disabled = total === 0 || !this.callbacks.onNextMatch;
  }

  /** Update the fit mode selector. */
  updateFitMode(mode: 'width' | 'page' | 'none'): void {
    if (this.fitSelectEl) {
      this.fitSelectEl.value = mode;
    }
    if (this.fitBtnEl) {
      this.fitBtnEl.textContent = FIT_MODE_LABELS[mode];
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
    if (this.config.searchNav) this.addSearchNav();
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

  private addSearchNav(): void {
    const group = this.createGroup();

    this.prevMatchBtn = document.createElement('button');
    this.prevMatchBtn.className = 'pdflight-toolbar-btn';
    this.prevMatchBtn.textContent = '\u25B2';
    this.prevMatchBtn.title = 'Previous match';
    this.prevMatchBtn.disabled = true;
    this.prevMatchBtn.dataset.testid = 'prev-match-btn';
    if (this.callbacks.onPrevMatch) {
      this.prevMatchBtn.addEventListener('click', this.callbacks.onPrevMatch);
    }

    this.matchInfoEl = document.createElement('span');
    this.matchInfoEl.className = 'pdflight-toolbar-match-info';
    this.matchInfoEl.textContent = 'Match 0/0';
    this.matchInfoEl.dataset.testid = 'match-info';

    this.nextMatchBtn = document.createElement('button');
    this.nextMatchBtn.className = 'pdflight-toolbar-btn';
    this.nextMatchBtn.textContent = '\u25BC';
    this.nextMatchBtn.title = 'Next match';
    this.nextMatchBtn.disabled = true;
    this.nextMatchBtn.dataset.testid = 'next-match-btn';
    if (this.callbacks.onNextMatch) {
      this.nextMatchBtn.addEventListener('click', this.callbacks.onNextMatch);
    }

    group.append(this.prevMatchBtn, this.matchInfoEl, this.nextMatchBtn);
    this.el.appendChild(group);
  }

  private addRotate(): void {
    const group = this.createGroup();

    const ccw = document.createElement('button');
    ccw.className = 'pdflight-toolbar-btn';
    ccw.textContent = '\u21BA';
    ccw.style.fontSize = '20px';
    ccw.title = 'Rotate counterclockwise';
    ccw.addEventListener('click', this.callbacks.onRotateCCW);

    const cw = document.createElement('button');
    cw.className = 'pdflight-toolbar-btn';
    cw.textContent = '\u21BB';
    cw.style.fontSize = '20px';
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

    // Desktop: <select> dropdown
    this.fitSelectEl = document.createElement('select');
    this.fitSelectEl.className = 'pdflight-toolbar-select pdflight-toolbar-fit-select';
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
      if (this.fitBtnEl) {
        this.fitBtnEl.textContent = FIT_MODE_LABELS[this.fitSelectEl!.value];
      }
    });

    // Mobile: cycle button (tap to cycle through modes)
    this.fitBtnEl = document.createElement('button');
    this.fitBtnEl.className = 'pdflight-toolbar-btn pdflight-toolbar-fit-btn';
    this.fitBtnEl.textContent = FIT_MODE_LABELS['page'];
    this.fitBtnEl.title = 'Cycle fit mode';
    this.fitBtnEl.addEventListener('click', () => {
      const current = this.fitSelectEl?.value ?? 'page';
      const idx = FIT_MODES.indexOf(current as typeof FIT_MODES[number]);
      const next = FIT_MODES[(idx + 1) % FIT_MODES.length];
      if (this.fitSelectEl) this.fitSelectEl.value = next;
      this.fitBtnEl!.textContent = FIT_MODE_LABELS[next];
      this.callbacks.onFitModeChange(next);
    });

    group.append(this.fitSelectEl, this.fitBtnEl);
    this.el.appendChild(group);
  }

  private createGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'pdflight-toolbar-group';
    return group;
  }
}
