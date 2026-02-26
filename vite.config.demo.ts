import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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
