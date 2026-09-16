import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/admin/',
  build: {
    outDir: 'dist/admin',
    emptyOutDir: true,
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/entries/admin.ts'),
      },
    },
  },
});