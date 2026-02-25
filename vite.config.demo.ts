import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  resolve: {
    alias: {
      '../src': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
