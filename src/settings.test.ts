import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  customDevice,
  loadSettings,
  resolve,
  saveSettings,
  validateCustom,
  type Settings,
} from './settings';

function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SETTINGS_KEY, initial);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: (): void => {
    throw new Error('blocked');
  },
};

describe('settings storage', () => {
  it('round-trips', () => {
    const s: Settings = {
      deviceId: 'custom',
      custom: { widthPx: 1000, heightPx: 1500, ppi: 250 },
      profileId: 'piano',
      noteSizeDelta: -2,
    };
    const storage = memory();
    saveSettings(s, storage);
    expect(loadSettings(storage)).toEqual(s);
  });

  it('uses the defaults when nothing is stored', () => {
    expect(loadSettings(memory())).toEqual(DEFAULT_SETTINGS);
  });

  it('survives broken JSON', () => {
    expect(loadSettings(memory('{nope'))).toEqual(DEFAULT_SETTINGS);
  });

  it('survives storage that throws', () => {
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(() => {
      saveSettings(DEFAULT_SETTINGS, throwing);
    }).not.toThrow();
  });

  it('replaces unknown ids and out-of-range values', () => {
    const stored = JSON.stringify({
      deviceId: 'gone',
      profileId: 'gone',
      noteSizeDelta: 9,
      custom: { widthPx: 1, heightPx: 1, ppi: 1 },
    });
    expect(loadSettings(memory(stored))).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid parts when others are broken', () => {
    const s = loadSettings(memory(JSON.stringify({ deviceId: 'kindle-scribe', noteSizeDelta: 1.5 })));
    expect(s.deviceId).toBe('kindle-scribe');
    expect(s.noteSizeDelta).toBe(0);
  });

  it('survives a JSON value that is not an object', () => {
    expect(loadSettings(memory('42'))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memory('null'))).toEqual(DEFAULT_SETTINGS);
  });
});

describe('custom size', () => {
  it('accepts values within the limits', () => {
    expect(validateCustom({ widthPx: 300, heightPx: 4000, ppi: 600 })).toEqual({
      widthPx: 300,
      heightPx: 4000,
      ppi: 600,
    });
  });

  it.each([
    [{ widthPx: 299, heightPx: 1000, ppi: 300 }, 'Width'],
    [{ widthPx: 1000, heightPx: 4001, ppi: 300 }, 'Height'],
    [{ widthPx: 1000, heightPx: 1000, ppi: 99 }, 'Pixel density'],
    [{ widthPx: 1000.5, heightPx: 1000, ppi: 300 }, 'Width'],
    [{ widthPx: Number.NaN, heightPx: 1000, ppi: 300 }, 'Width'],
  ])('rejects %j', (value, start) => {
    expect(validateCustom(value)).toEqual(expect.stringContaining(start));
  });

  it('builds a device spec', () => {
    expect(customDevice({ widthPx: 1000, heightPx: 1500, ppi: 250 })).toEqual({
      id: 'custom',
      name: 'Custom 1000×1500',
      widthPx: 1000,
      heightPx: 1500,
      ppi: 250,
      safeAreaMm: { top: 0, right: 0, bottom: 0, left: 0 },
      staffSizeAdjust: 0,
      source: 'user',
    });
  });
});

describe('resolve', () => {
  it('does not override the staff size without a change', () => {
    const r = resolve(DEFAULT_SETTINGS);
    expect(r?.device.id).toBe('kobo-sage');
    expect(r?.staffSizeOverride).toBeUndefined();
    expect(r?.pageMm.width).toBeGreaterThan(0);
  });

  it('adds the change to the default staff size', () => {
    const base = resolve(DEFAULT_SETTINGS);
    const r = resolve({ ...DEFAULT_SETTINGS, noteSizeDelta: 2 });
    expect(r?.staffSize).toBe((base?.staffSize ?? 0) + 2);
    expect(r?.staffSizeOverride).toBe(r?.staffSize);
  });

  it('is undefined for an invalid custom size', () => {
    const bad = { widthPx: 5, heightPx: 5, ppi: 5 };
    expect(resolve({ ...DEFAULT_SETTINGS, deviceId: 'custom', custom: bad })).toBeUndefined();
  });
});
