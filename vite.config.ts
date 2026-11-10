import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: process.env.APP_BASE ?? '/lily-on-eink-app/',
  // Pre-bundling would break the `new URL(..., import.meta.url)` asset and worker patterns of the engine.
  optimizeDeps: { exclude: ['@sightread/lilypond-wasm', '@lily-on-eink/engine-wasm'] },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        about: resolve(import.meta.dirname, 'about.html'),
      },
    },
  },
});
