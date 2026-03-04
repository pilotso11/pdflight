import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewerToolbar, resolveToolbarConfig } from '../../../src/viewer/ViewerToolbar';
import type { ToolbarCallbacks, ToolbarConfig } from '../../../src/viewer/ViewerToolbar';

function makeCallbacks(): ToolbarCallbacks {
  return {
    onPrevPage: vi.fn(),
    onNextPage: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFitModeChange: vi.fn(),
    onRotateCW: vi.fn(),
    onRotateCCW: vi.fn(),
    onPrevMatch: vi.fn(),
    onNextMatch: vi.fn(),
  };
}

describe('resolveToolbarConfig', () => {
  it('returns null for false', () => {
    expect(resolveToolbarConfig(false)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(resolveToolbarConfig(undefined)).toBeNull();
  });

  it('returns full config for true', () => {
    const config = resolveToolbarConfig(true);
    expect(config).toEqual({
      stepper: true,
      zoom: true,
      rotate: true,
      fit: true,
      searchNav: false,
      position: 'bottom',
    });
  });

  it('fills defaults for partial config', () => {
    const config = resolveToolbarConfig({ stepper: false });
    expect(config).toEqual({
      stepper: false,
      zoom: true,
      rotate: true,
      fit: true,
      searchNav: false,
      position: 'bottom',
    });
  });

  it('preserves explicit values', () => {
    const config = resolveToolbarConfig({
      stepper: false,
      zoom: false,
      rotate: false,
      fit: false,
      searchNav: true,
      position: 'top',
    });
    expect(config).toEqual({
      stepper: false,
      zoom: false,
      rotate: false,
      fit: false,
      searchNav: true,
      position: 'top',
    });
  });
});

describe('ViewerToolbar', () => {
  let container: HTMLElement;
  let callbacks: ToolbarCallbacks;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    callbacks = makeCallbacks();
  });

  it('renders toolbar element into container', () => {
    const config: ToolbarConfig = { stepper: true, zoom: true, rotate: true, fit: true, searchNav: false, position: 'bottom' };
    new ViewerToolbar(container, config, callbacks);
    const toolbar = container.querySelector('.pdflight-toolbar');
    expect(toolbar).not.toBeNull();
  });

  it('adds top class when position is top', () => {
    const config: ToolbarConfig = { stepper: false, zoom: false, rotate: false, fit: false, searchNav: false, position: 'top' };
    new ViewerToolbar(container, config, callbacks);
    const toolbar = container.querySelector('.pdflight-toolbar');
    expect(toolbar?.classList.contains('pdflight-toolbar-top')).toBe(true);
  });

  it('prepends toolbar when position is top', () => {
    const existing = document.createElement('div');
    existing.className = 'existing';
    container.appendChild(existing);

    const config: ToolbarConfig = { position: 'top' };
    new ViewerToolbar(container, config, callbacks);
    expect(container.firstElementChild?.classList.contains('pdflight-toolbar')).toBe(true);
  });

  it('appends toolbar when position is bottom', () => {
    const existing = document.createElement('div');
    existing.className = 'existing';
    container.appendChild(existing);

    const config: ToolbarConfig = { position: 'bottom' };
    new ViewerToolbar(container, config, callbacks);
    expect(container.lastElementChild?.classList.contains('pdflight-toolbar')).toBe(true);
  });

  it('renders all section groups when all features enabled', () => {
    const config: ToolbarConfig = { stepper: true, zoom: true, rotate: true, fit: true, searchNav: true, position: 'bottom' };
    new ViewerToolbar(container, config, callbacks);
    const groups = container.querySelectorAll('.pdflight-toolbar-group');
    // 5 groups: stepper, rotate, zoom, fit, searchNav
    expect(groups.length).toBe(5);
  });

  it('renders no groups when all features disabled', () => {
    const config: ToolbarConfig = { stepper: false, zoom: false, rotate: false, fit: false, searchNav: false, position: 'bottom' };
    new ViewerToolbar(container, config, callbacks);
    const groups = container.querySelectorAll('.pdflight-toolbar-group');
    expect(groups.length).toBe(0);
  });

  it('updatePageInfo sets text content', () => {
    const config: ToolbarConfig = { stepper: true, position: 'bottom' };
    const toolbar = new ViewerToolbar(container, config, callbacks);
    toolbar.updatePageInfo(3, 10);
    const pageInfo = container.querySelector('.pdflight-toolbar-page-info');
    expect(pageInfo?.textContent).toBe('Page 3 of 10');
  });

  it('updateZoomLevel displays percentage', () => {
    const config: ToolbarConfig = { zoom: true, position: 'bottom' };
    const toolbar = new ViewerToolbar(container, config, callbacks);
    toolbar.updateZoomLevel(1.54);
    const zoomLevel = container.querySelector('.pdflight-toolbar-zoom-level');
    expect(zoomLevel?.textContent).toBe('154%');
  });

  it('updateMatchInfo sets text and enables/disables buttons', () => {
    const config: ToolbarConfig = { searchNav: true, position: 'bottom' };
    const toolbar = new ViewerToolbar(container, config, callbacks);

    toolbar.updateMatchInfo(0, 0);
    const matchInfo = container.querySelector('.pdflight-toolbar-match-info');
    expect(matchInfo?.textContent).toBe('Match 0/0');

    const prevBtn = container.querySelector('[data-testid="prev-match-btn"]') as HTMLButtonElement;
    const nextBtn = container.querySelector('[data-testid="next-match-btn"]') as HTMLButtonElement;
    expect(prevBtn?.disabled).toBe(true);
    expect(nextBtn?.disabled).toBe(true);

    toolbar.updateMatchInfo(2, 5);
    expect(matchInfo?.textContent).toBe('Match 2/5');
    expect(prevBtn?.disabled).toBe(false);
    expect(nextBtn?.disabled).toBe(false);
  });

  it('updateFitMode sets select value', () => {
    const config: ToolbarConfig = { fit: true, position: 'bottom' };
    const toolbar = new ViewerToolbar(container, config, callbacks);
    toolbar.updateFitMode('width');
    const select = container.querySelector('.pdflight-toolbar-select') as HTMLSelectElement;
    expect(select?.value).toBe('width');
  });

  it('destroy removes toolbar from DOM', () => {
    const config: ToolbarConfig = { stepper: true, position: 'bottom' };
    const toolbar = new ViewerToolbar(container, config, callbacks);
    expect(container.querySelector('.pdflight-toolbar')).not.toBeNull();
    toolbar.destroy();
    expect(container.querySelector('.pdflight-toolbar')).toBeNull();
  });

  it('button clicks invoke callbacks', () => {
    const config: ToolbarConfig = { stepper: true, zoom: true, rotate: true, searchNav: true, position: 'bottom' };
    new ViewerToolbar(container, config, callbacks);

    // Click prev page
    const buttons = container.querySelectorAll('.pdflight-toolbar-btn');
    // stepper: prev, next; rotate: ccw, cw; zoom: out, in; searchNav: prev, next
    // Order: stepper group (prev, next), rotate group (ccw, cw), zoom group (out, in), searchNav group (prev, next)
    buttons[0].dispatchEvent(new Event('click'));
    expect(callbacks.onPrevPage).toHaveBeenCalled();

    buttons[1].dispatchEvent(new Event('click'));
    expect(callbacks.onNextPage).toHaveBeenCalled();
  });

  it('toolbar CSS includes flex-wrap for mobile responsiveness', () => {
    const config: ToolbarConfig = { stepper: true, zoom: true, rotate: true, fit: true, searchNav: true, position: 'bottom' };
    new ViewerToolbar(container, config, callbacks);
    const toolbar = container.querySelector('.pdflight-toolbar') as HTMLElement;

    // Full toolbar produces 5 groups
    const groups = toolbar.querySelectorAll('.pdflight-toolbar-group');
    const buttons = toolbar.querySelectorAll('.pdflight-toolbar-btn');
    expect(groups.length).toBe(5);
    expect(buttons.length).toBe(9); // stepper(2) + rotate(2) + zoom(2) + fit-cycle(1) + searchNav(2)

    // Verify the injected styles include flex-wrap so the toolbar
    // wraps to two lines on narrow (mobile) viewports
    const styleEl = document.querySelector('style');
    const styles = styleEl?.textContent ?? '';
    expect(styles).toContain('flex-wrap');
  });
});
