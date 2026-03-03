// Copyright (c) 2026 Seth Osher. MIT License.

/**
 * Compute mobile-friendly default overrides for narrow containers.
 * Returns only the fields that should be overridden (consumer-unset on narrow screens).
 */
export function computeMobileDefaults(
  containerWidth: number,
  options: { fitMode?: string; sidebar?: unknown },
): { fitMode?: 'width'; sidebar?: false } {
  if (containerWidth > 500) return {};
  const overrides: { fitMode?: 'width'; sidebar?: false } = {};
  if (options.fitMode === undefined) overrides.fitMode = 'width';
  if (options.sidebar === undefined) overrides.sidebar = false;
  return overrides;
}
