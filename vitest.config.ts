import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: {
    __PDFLIGHT_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/utils/**/*.ts',
        'src/search/**/*.ts',
        'src/highlight/HighlightEngine.ts',
        'src/highlight/types.ts',
        'src/types.ts',
      ],
      exclude: [
        'src/index.ts',
        'src/viewer/**/*.ts',
        'src/highlight/HighlightLayer.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
