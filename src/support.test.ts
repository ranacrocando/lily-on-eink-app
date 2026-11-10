import { describe, expect, it, vi } from 'vitest';
import { isSupported, missingFeatures } from './support';

/** Reads the `type` option like a browser that knows module workers; `terminate` is recorded. */
class ModuleWorker {
  static terminated = 0;
  constructor(_url: string, options?: { type?: string }) {
    expect(options?.type).toBe('module');
  }
  terminate() {
    ModuleWorker.terminated++;
  }
}
/** Ignores the options, like a browser without module workers. */
class ClassicWorker {
  terminate() {
    return undefined;
  }
}

const full = (): Record<string, unknown> => ({
  AbortSignal: { any: () => undefined },
  DecompressionStream: function DecompressionStream() {
    return undefined;
  },
  WebAssembly: {},
  Worker: ModuleWorker,
});

describe('missingFeatures', () => {
  it('reports nothing for a capable browser', () => {
    expect(missingFeatures(full())).toEqual([]);
    expect(isSupported(full())).toBe(true);
    expect(ModuleWorker.terminated).toBeGreaterThan(0);
  });

  it('reports every missing feature', () => {
    expect(missingFeatures({})).toEqual(['AbortSignal.any', 'DecompressionStream', 'WebAssembly', 'Worker']);
    expect(isSupported({})).toBe(false);
  });

  it('reports a missing AbortSignal.any', () => {
    expect(missingFeatures({ ...full(), AbortSignal: {} })).toEqual(['AbortSignal.any']);
  });

  it('reports a missing DecompressionStream', () => {
    const g = full();
    delete g.DecompressionStream;
    expect(missingFeatures(g)).toEqual(['DecompressionStream']);
  });

  it('reports workers without module support', () => {
    expect(missingFeatures({ ...full(), Worker: ClassicWorker })).toEqual(['module Worker']);
  });

  it('treats a throwing Worker constructor as unsupported', () => {
    const Throwing = function () {
      throw new Error('nope');
    };
    expect(missingFeatures({ ...full(), Worker: Throwing })).toEqual(['module Worker']);
  });

  it('cleans up the temporary worker URL', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    missingFeatures(full());
    expect(revoke).toHaveBeenCalled();
    revoke.mockRestore();
  });

  it('uses the real globals by default', () => {
    expect(Array.isArray(missingFeatures())).toBe(true);
  });
});
