import { describe, it, expect } from 'vitest';
import { computeMobileDefaults } from '../../../src/viewer/mobileDefaults';

describe('computeMobileDefaults', () => {
  it('returns width fitMode for narrow container with no explicit fitMode', () => {
    const overrides = computeMobileDefaults(375, {});
    expect(overrides.fitMode).toBe('width');
  });

  it('returns sidebar false for narrow container with no explicit sidebar', () => {
    const overrides = computeMobileDefaults(375, {});
    expect(overrides.sidebar).toBe(false);
  });

  it('does not override fitMode when consumer explicitly sets it', () => {
    const overrides = computeMobileDefaults(375, { fitMode: 'page' });
    expect(overrides.fitMode).toBeUndefined();
  });

  it('does not override sidebar when consumer explicitly sets it', () => {
    const overrides = computeMobileDefaults(375, { sidebar: true });
    expect(overrides.sidebar).toBeUndefined();
  });

  it('returns no overrides for wide container', () => {
    const overrides = computeMobileDefaults(1024, {});
    expect(overrides).toEqual({});
  });

  it('returns no overrides at exactly 501px', () => {
    const overrides = computeMobileDefaults(501, {});
    expect(overrides).toEqual({});
  });

  it('returns overrides at exactly 500px', () => {
    const overrides = computeMobileDefaults(500, {});
    expect(overrides.fitMode).toBe('width');
    expect(overrides.sidebar).toBe(false);
  });
});
