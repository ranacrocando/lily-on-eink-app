import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Engine } from '@lily-on-eink/core';

const fake = vi.hoisted(() => ({ engine: undefined as unknown as Engine, created: 0 }));
vi.mock('@lily-on-eink/engine-wasm', () => ({
  createWasmEngine: () => {
    fake.created++;
    return fake.engine;
  },
}));

function makeEngine(preload?: Engine['preload']): Engine {
  return {
    ...(preload ? { preload } : {}),
    lilypondVersion: () => Promise.resolve('2.26.0'),
    compile: () => Promise.reject(new Error('unused')),
    dispose: () => undefined,
  };
}

describe('engine', () => {
  beforeEach(() => {
    vi.resetModules();
    fake.created = 0;
  });

  it('creates one engine only', async () => {
    fake.engine = makeEngine();
    const { getEngine } = await import('./engine');
    expect(getEngine()).toBe(getEngine());
    expect(fake.created).toBe(1);
  });

  it('preloads with progress, then reports preparing and the version', async () => {
    const calls: string[] = [];
    fake.engine = makeEngine((options) => {
      options?.onProgress?.({ loadedBytes: 1, totalBytes: 2 });
      calls.push('preload');
      return Promise.resolve();
    });
    const { loadEngine } = await import('./engine');
    const version = await loadEngine(
      (p) => calls.push(`progress ${String(p.loadedBytes)}/${String(p.totalBytes)}`),
      () => calls.push('preparing'),
    );
    expect(version).toBe('2.26.0');
    expect(calls).toEqual(['progress 1/2', 'preload', 'preparing']);
  });

  it('falls back to the version check when the engine has no preload', async () => {
    fake.engine = makeEngine();
    const { loadEngine } = await import('./engine');
    const onPreparing = vi.fn();
    expect(await loadEngine(undefined, onPreparing)).toBe('2.26.0');
    expect(onPreparing).not.toHaveBeenCalled();
  });

  it('rejects when preload fails and does not report preparing', async () => {
    fake.engine = makeEngine(() => Promise.reject(new Error('download failed')));
    const { loadEngine } = await import('./engine');
    const onPreparing = vi.fn();
    await expect(loadEngine(undefined, onPreparing)).rejects.toThrow('download failed');
    expect(onPreparing).not.toHaveBeenCalled();
  });
});
