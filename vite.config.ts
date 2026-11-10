import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Version of an installed package, for the corresponding-source links of the about page. */
function installedVersion(name: string): string {
  const path = resolve(import.meta.dirname, 'node_modules', name, 'package.json');
  return String((JSON.parse(readFileSync(path, 'utf8')) as { version: unknown }).version);
}

export default defineConfig({
  base: process.env.APP_BASE ?? '/lily-on-eink-app/',
  define: {
    'import.meta.env.VITE_CORE_VERSION': JSON.stringify(installedVersion('@lily-on-eink/core')),
    'import.meta.env.VITE_ENGINE_VERSION': JSON.stringify(installedVersion('@sightread/lilypond-wasm')),
  },
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
