export const MINIMUM_BROWSERS = 'Chrome or Edge 116, Firefox 124 or Safari 17.4';

type WorkerCtor = new (url: string, options?: WorkerOptions) => Worker;

/**
 * Module workers are detected by whether the constructor reads the `type` option. The probe starts a Worker from
 * a blob: URL, so a future Content-Security-Policy must allow `worker-src blob:`; otherwise the probe fails and
 * the app wrongly asks the user to update the browser.
 */
function supportsModuleWorkers(Ctor: WorkerCtor): boolean {
  let read = false;
  const options = {
    get type() {
      read = true;
      return 'module' as const;
    },
  };
  try {
    const url = URL.createObjectURL(new Blob([''], { type: 'text/javascript' }));
    try {
      new Ctor(url, options).terminate();
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return false;
  }
  return read;
}

/** Names of the browser features the app needs that are missing in `g` (default: the real globals). */
export function missingFeatures(g: Record<string, unknown> = globalThis): string[] {
  const missing: string[] = [];
  const abortSignal = g.AbortSignal as { any?: unknown } | undefined;
  if (typeof abortSignal?.any !== 'function') missing.push('AbortSignal.any');
  if (typeof g.DecompressionStream !== 'function') missing.push('DecompressionStream');
  if (typeof g.WebAssembly !== 'object' || g.WebAssembly === null) missing.push('WebAssembly');
  if (typeof g.Worker !== 'function') missing.push('Worker');
  else if (!supportsModuleWorkers(g.Worker as WorkerCtor)) missing.push('module Worker');
  return missing;
}

export function isSupported(g?: Record<string, unknown>): boolean {
  return missingFeatures(g).length === 0;
}
