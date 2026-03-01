import { defineConfig } from 'vite';
import { resolve } from 'path';
import { inlineWorkerPlugin } from './build/vite-plugin-inline-worker';

export default defineConfig({
  plugins: [inlineWorkerPlugin()],
  build: {
    outDir: 'dist-cdn',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'pdflight',
      fileName: 'pdflight',
      formats: ['es', 'iife'],
    },
    minify: true,
    rollupOptions: {
      output: {
        // CDN builds must be self-contained single files
        inlineDynamicImports: true,
      },
    },
  },
});
