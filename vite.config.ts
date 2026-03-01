import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: {
    __PDFLIGHT_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'pdflight',
      fileName: 'pdflight',
      formats: ['es'],
    },
    rollupOptions: {
      // pdfjs-dist is bundled (not externalized) per design decision
    },
  },
});
