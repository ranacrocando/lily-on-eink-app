// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byId } from './dom';
import { DEFAULT_SETTINGS, resolve } from './settings';

const runConversion = vi.hoisted(() => vi.fn());
vi.mock('./convert-run', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./convert-run')>()),
  runConversion,
}));
vi.mock('./engine', () => ({ getEngine: () => ({}) }));

import { initConvertPanel } from './convert-panel';

const resolved = resolve(DEFAULT_SETTINGS);
if (!resolved) throw new Error('no settings');
const png = new Uint8Array([1]);
const pdf = new Uint8Array([2]);

function outcome(withPng: boolean) {
  return {
    result: {
      outputs: [{ mainFile: 'a.ly', bookIndex: 0, fileName: 'a.pdf', ...(withPng ? { pngPages: [png] } : { pdf }) }],
      diagnostics: [],
      logs: {},
    },
    engineReset: false,
    cancelled: false,
  };
}

function setup(calibrating?: () => boolean) {
  document.body.innerHTML = `<button id="convert"></button><button id="cancel" hidden></button>
    <p id="convert-hint"></p><p id="progress-text" tabindex="-1"></p><div id="results"></div>
    <figure id="preview" hidden><div id="preview-frame"><canvas id="preview-canvas"></canvas></div>
    <button id="preview-close"></button></figure>`;
  return initConvertPanel({
    engineStatus: { isReady: () => true, isFailed: () => false, load: () => Promise.resolve() },
    project: {
      project: () => ({ files: [{ path: 'a.ly', content: 'x' }], texts: {}, skipped: [], notUtf8: [] }),
      selectedMainFiles: () => ['a.ly'],
      setLocked: vi.fn(),
    },
    settings: { current: () => resolved, setLocked: vi.fn() },
    ...(calibrating ? { calibrating } : {}),
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));
function byText(text: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text);
  if (!found) throw new Error(`No button ${text}`);
  return found;
}

describe('convert panel preview', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() =>
        Promise.resolve({ width: resolved.device.widthPx, height: resolved.device.heightPx, close: vi.fn() }),
      ),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
    } as never);
    runConversion.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function convertAndPreview() {
    const panel = setup();
    runConversion.mockResolvedValueOnce(outcome(false));
    byId('convert', HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(byText('Preview')).toBeDefined();
    });
    return panel;
  }

  it('runs one conversion for a double click, disables Preview meanwhile, then focuses Close', async () => {
    await convertAndPreview();
    let finish: (v: unknown) => void = () => undefined;
    runConversion.mockReturnValueOnce(new Promise((r) => (finish = r)));
    const preview = byText('Preview');
    preview.click();
    preview.click();
    await flush();
    expect(runConversion).toHaveBeenCalledTimes(2); // one Convert, one Preview
    expect(runConversion.mock.calls[1]?.[0]).toMatchObject({ outputs: ['png'], mainFiles: ['a.ly'] });
    expect(preview.disabled).toBe(true);
    finish(outcome(true));
    await vi.waitFor(() => {
      expect(document.getElementById('preview')?.hidden).toBe(false);
    });
    expect(preview.disabled).toBe(false);
    expect(document.activeElement?.id).toBe('preview-close');
  });

  it('clears results and preview when the inputs change', async () => {
    const panel = await convertAndPreview();
    runConversion.mockResolvedValueOnce(outcome(true));
    byText('Preview').click();
    await vi.waitFor(() => {
      expect(document.getElementById('preview')?.hidden).toBe(false);
    });
    panel.inputsChanged();
    expect(document.getElementById('preview')?.hidden).toBe(true);
    expect(document.getElementById('results')?.children).toHaveLength(0);
  });

  it('shows the errors when no image comes back', async () => {
    await convertAndPreview();
    const failed = outcome(false);
    failed.result.outputs = [];
    (failed.result.diagnostics as unknown[]).push({ file: '', line: 0, column: 0, severity: 'error', message: 'boom' });
    runConversion.mockResolvedValueOnce(failed);
    byText('Preview').click();
    await vi.waitFor(() => {
      expect(document.getElementById('progress-text')?.textContent).toContain('Error: boom');
    });
    expect(document.getElementById('preview')?.hidden).toBe(true);
  });

  it('keeps Convert and Preview disabled while the calibration page is drawn', async () => {
    let drawing = false;
    const panel = setup(() => drawing);
    const convert = byId('convert', HTMLButtonElement);
    expect(convert.disabled).toBe(false);
    runConversion.mockResolvedValueOnce(outcome(false));
    convert.click();
    await vi.waitFor(() => {
      expect(byText('Preview')).toBeDefined();
    });
    drawing = true;
    panel.refresh();
    expect(convert.disabled).toBe(true);
    expect(byText('Preview').disabled).toBe(true);
    expect(document.getElementById('convert-hint')?.textContent).toBe('Drawing the calibration page…');
    convert.click();
    byText('Preview').click();
    await flush();
    expect(runConversion).toHaveBeenCalledTimes(1);
    drawing = false;
    panel.refresh();
    expect(convert.disabled).toBe(false);
    expect(byText('Preview').disabled).toBe(false);
  });
});
