// @vitest-environment happy-dom
import type { ConvertResult } from '@lily-on-eink/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cropSize, firstPagePng, initPreview, quantize16 } from './preview';
import { DEFAULT_SETTINGS, resolve } from './settings';

describe('quantize16', () => {
  it('maps black, white and mid grey to grey levels and keeps alpha', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 128, 128, 128, 128, 77]);
    quantize16(data);
    expect(Array.from(data)).toEqual([0, 0, 0, 255, 255, 255, 255, 128, 136, 136, 136, 77]);
  });

  it('only produces multiples of 17', () => {
    const data = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) data.set([i, (i * 7) % 256, (i * 13) % 256, 255], i * 4);
    quantize16(data);
    for (let i = 0; i < 256; i++) {
      const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
      expect(r).toBe(g);
      expect(g).toBe(b);
      expect((r ?? 1) % 17).toBe(0);
      expect(a).toBe(255);
    }
  });

  it('weights green higher than blue', () => {
    const green = new Uint8ClampedArray([0, 255, 0, 255]);
    const blue = new Uint8ClampedArray([0, 0, 255, 255]);
    expect(quantize16(green)[0]).toBeGreaterThan(quantize16(blue)[0] ?? 0);
  });
});

describe('cropSize', () => {
  const device = { widthPx: 1264, heightPx: 1680 };
  it('cuts off padding of one or two pixels', () => {
    expect(cropSize({ width: 1265, height: 1682 }, device)).toEqual({ width: 1264, height: 1680 });
  });
  it('keeps an exact or smaller image as it is', () => {
    expect(cropSize({ width: 1264, height: 1680 }, device)).toEqual({ width: 1264, height: 1680 });
    expect(cropSize({ width: 1000, height: 1680 }, device)).toEqual({ width: 1000, height: 1680 });
  });
});

describe('firstPagePng', () => {
  const a = new Uint8Array([1]);
  const b = new Uint8Array([2]);
  const result: ConvertResult = {
    outputs: [
      { mainFile: 'x.ly', bookIndex: 0, fileName: 'x.pdf', pngPages: [a] },
      { mainFile: 'x.ly', bookIndex: 1, fileName: 'x (2).pdf', pngPages: [b, a] },
      { mainFile: 'y.ly', bookIndex: 0, fileName: 'y.pdf' },
    ],
    diagnostics: [],
    logs: {},
  };
  it('picks the right book', () => {
    expect(firstPagePng(result, 'x.ly', 0)).toBe(a);
    expect(firstPagePng(result, 'x.ly', 1)).toBe(b);
  });
  it('is undefined without PNG', () => {
    expect(firstPagePng(result, 'y.ly', 0)).toBeUndefined();
    expect(firstPagePng(result, 'z.ly', 0)).toBeUndefined();
  });
});

describe('preview view', () => {
  const device = resolve(DEFAULT_SETTINGS)?.device;
  if (!device) throw new Error('no device');
  const close = vi.fn();
  let pixels: Uint8ClampedArray;
  const drawImage = vi.fn();

  beforeEach(() => {
    drawImage.mockReset();
    document.body.innerHTML = `<figure id="preview" hidden><div id="preview-frame"><canvas id="preview-canvas"></canvas></div>
      <button id="preview-close"></button></figure><button id="opener"></button>`;
    pixels = new Uint8ClampedArray([200, 200, 200, 255]);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: device.widthPx + 2, height: device.heightPx + 1, close })),
    );
    const context = {
      fillRect: vi.fn(),
      drawImage,
      getImageData: vi.fn(() => ({ data: pixels })),
      putImageData: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the cropped, quantized image and clears it again', async () => {
    const view = initPreview();
    const opener = document.getElementById('opener') as HTMLButtonElement;
    await view.show(new Uint8Array([1]), device, opener);
    const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
    expect(view.isOpen()).toBe(true);
    expect([canvas.width, canvas.height]).toEqual([device.widthPx, device.heightPx]);
    expect(Array.from(pixels)).toEqual([204, 204, 204, 255]);
    expect(canvas.getAttribute('aria-label')).toContain(device.name);
    expect(close).toHaveBeenCalled();
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      device.widthPx,
      device.heightPx,
      0,
      0,
      device.widthPx,
      device.heightPx,
    );
    expect(document.getElementById('preview-frame')?.style.getPropertyValue('--preview-ratio')).toBe(
      `${String(device.widthPx)} / ${String(device.heightPx)}`,
    );
    view.clear();
    expect(view.isOpen()).toBe(false);
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it('resets the canvas and stays closed when drawing fails', async () => {
    drawImage.mockImplementation(() => {
      throw new Error('boom');
    });
    const view = initPreview();
    const opener = document.getElementById('opener') as HTMLButtonElement;
    await expect(view.show(new Uint8Array([1]), device, opener)).rejects.toThrow('boom');
    const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
    expect(view.isOpen()).toBe(false);
  });

  it('ignores Escape when it was handled elsewhere', async () => {
    const view = initPreview();
    await view.show(new Uint8Array([1]), device, document.getElementById('opener') as HTMLButtonElement);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(view.isOpen()).toBe(false);
    await view.show(new Uint8Array([1]), device, document.getElementById('opener') as HTMLButtonElement);
    const handled = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    handled.preventDefault();
    document.dispatchEvent(handled);
    expect(view.isOpen()).toBe(true);
  });

  it('closes with Escape or the button and returns the focus to the opener', async () => {
    const view = initPreview();
    const opener = document.getElementById('opener') as HTMLButtonElement;
    await view.show(new Uint8Array([1]), device, opener);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(view.isOpen()).toBe(false);
    expect(document.activeElement).toBe(opener);

    await view.show(new Uint8Array([1]), device, opener);
    opener.blur();
    view.closeButton.click();
    expect(view.isOpen()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});
