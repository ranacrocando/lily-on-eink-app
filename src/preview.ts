import type { ConvertResult, DeviceSpec } from '@lily-on-eink/core';
import { byId } from './dom';

/** Caption under the preview. */
export const PREVIEW_CAPTION = 'Approximate e-ink look of page 1 (16 grey levels)';

/** Maps every pixel to one of 16 grey levels (0, 17, …, 255) by its luminance. Alpha is kept. Works in place. */
export function quantize16(data: Uint8ClampedArray): Uint8ClampedArray {
  for (let i = 0; i + 3 < data.length; i += 4) {
    const luminance = 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
    const grey = Math.round((luminance / 255) * 15) * 17;
    data[i] = grey;
    data[i + 1] = grey;
    data[i + 2] = grey;
  }
  return data;
}

/**
 * The part of the engine's image to show. The engine's PNG can be a pixel or two larger than the screen (white
 * padding right and bottom): that is cut off, never scaled. A smaller image is kept as it is.
 */
export function cropSize(
  image: { width: number; height: number },
  device: { widthPx: number; heightPx: number },
): { width: number; height: number } {
  return { width: Math.min(image.width, device.widthPx), height: Math.min(image.height, device.heightPx) };
}

/** The PNG of the first page of one book of one main file, if the conversion produced it. */
export function firstPagePng(result: ConvertResult, mainFile: string, bookIndex: number): Uint8Array | undefined {
  return result.outputs.find((o) => o.mainFile === mainFile && o.bookIndex === bookIndex)?.pngPages?.[0];
}

export interface PreviewView {
  /** Shows page 1 in e-ink greys. `opener` gets the focus again when the preview is closed. */
  show(png: Uint8Array, device: DeviceSpec, opener: HTMLElement): Promise<void>;
  /** Hides the preview without moving the focus. */
  clear(): void;
  isOpen(): boolean;
  closeButton: HTMLButtonElement;
}

/** Wires the preview frame. */
export function initPreview(): PreviewView {
  const figure = byId('preview', HTMLElement);
  const frame = byId('preview-frame', HTMLElement);
  const canvas = byId('preview-canvas', HTMLCanvasElement);
  const closeButton = byId('preview-close', HTMLButtonElement);
  let opener: HTMLElement | undefined;

  function clear(): void {
    figure.hidden = true;
    canvas.width = 0;
    canvas.height = 0;
    opener = undefined;
  }

  function close(): void {
    const back = opener;
    clear();
    back?.focus();
  }

  async function show(png: Uint8Array, device: DeviceSpec, from: HTMLElement): Promise<void> {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(png)], { type: 'image/png' }));
    try {
      const { width, height } = cropSize(bitmap, device);
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('No canvas support');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height, 0, 0, width, height);
      const image = context.getImageData(0, 0, width, height);
      quantize16(image.data);
      context.putImageData(image, 0, 0);
    } catch (error) {
      canvas.width = 0;
      canvas.height = 0;
      throw error;
    } finally {
      bitmap.close();
    }
    frame.style.setProperty('--preview-ratio', `${String(device.widthPx)} / ${String(device.heightPx)}`);
    canvas.setAttribute('aria-label', `Preview of page 1 for ${device.name} in 16 grey levels`);
    opener = from;
    figure.hidden = false;
  }

  closeButton.addEventListener('click', close);
  // A global listener is a conscious choice: the app has exactly one preview, and it only acts while that is open.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented && !figure.hidden) close();
  });
  clear();
  return { show, clear, isOpen: () => !figure.hidden, closeButton };
}
