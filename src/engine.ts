import { createWasmEngine } from '@lily-on-eink/engine-wasm';
import type { Engine } from '@lily-on-eink/core';

export interface EngineProgress {
  loadedBytes: number;
  totalBytes: number;
}

interface PreloadOptions {
  signal?: AbortSignal;
  onProgress?: (p: EngineProgress) => void;
}

/** `preload` is optional on the core `Engine` (added in a later core version); it is detected at runtime. */
type PreloadableEngine = Engine & { preload?: (options?: PreloadOptions) => Promise<void> };

let engine: Engine | undefined;

/** The app-wide engine; created on first use. */
export function getEngine(): Engine {
  engine ??= createWasmEngine();
  return engine;
}

/**
 * Loads the engine and resolves with the LilyPond version.
 * `onProgress` receives download progress when the engine supports `preload`; `onPreparing` is called once
 * the download is done and the version check (a full LilyPond run) starts. Without `preload` there is no
 * progress at all, so the caller shows an indeterminate bar.
 */
export async function loadEngine(
  onProgress?: (p: EngineProgress) => void,
  onPreparing?: () => void,
): Promise<string> {
  const e = getEngine() as PreloadableEngine;
  if (typeof e.preload === 'function') {
    await e.preload({ onProgress });
    onPreparing?.();
  }
  return e.lilypondVersion();
}
