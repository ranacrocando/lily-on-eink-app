import { createWasmEngine } from '@lily-on-eink/engine-wasm';
import type { Engine, EngineLoadProgress } from '@lily-on-eink/core';

let engine: Engine | undefined;

/** The app-wide engine; created on first use. */
export function getEngine(): Engine {
  engine ??= createWasmEngine();
  return engine;
}

/**
 * Loads the engine and resolves with the LilyPond version.
 * `onProgress` receives download progress when the engine supports `preload`; `onPreparing` is called once
 * the download is done and the version check (a full LilyPond run) starts. An engine without `preload`
 * reports no progress, so the caller shows an indeterminate bar.
 */
export async function loadEngine(
  onProgress?: (p: EngineLoadProgress) => void,
  onPreparing?: () => void,
): Promise<string> {
  const e = getEngine();
  if (e.preload) {
    await e.preload({ onProgress });
    onPreparing?.();
  }
  return e.lilypondVersion();
}
