import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
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
