import { defineConfig } from 'vite';
import { resolve } from 'path';
import { inlineWorkerPlugin } from './build/vite-plugin-inline-worker';
import pkg from './package.json' with { type: 'json' };

const version = process.env.CDN_VERSION ?? pkg.version;

export default defineConfig({
  define: {
    __PDFLIGHT_VERSION__: JSON.stringify(version),
  },
  plugins: [inlineWorkerPlugin()],
  build: {
    outDir: 'dist-cdn',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'pdflight',
      fileName: `pdflight-${version}`,
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
