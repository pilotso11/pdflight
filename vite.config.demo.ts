import { defineConfig } from 'vite';
import { resolve } from 'path';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: {
    __PDFLIGHT_VERSION__: JSON.stringify(pkg.version),
  },
  root: 'demo',
  resolve: {
    alias: {
      '../src': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Allow serving test fixtures from outside the root
    fs: {
      strict: false,
      allow: ['..'],
    },
  },
});
