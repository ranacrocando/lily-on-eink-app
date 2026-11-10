// @vitest-environment happy-dom
import type { Engine } from '@lily-on-eink/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initCalibrationPanel } from './calibration-panel';
import { downloadBlob } from './download';
import type { EngineStatus } from './engine-status';
import type { SettingsPanel } from './settings-panel';
import { DEFAULT_SETTINGS, resolve } from './settings';

vi.mock('./download', () => ({ downloadBlob: vi.fn() }));

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const engine: Engine = {
  lilypondVersion: () => Promise.resolve('2.26.0'),
  compile: () => Promise.resolve({ ok: true, exitCode: 0, files: { 'calibration.pdf': pdf }, log: '' }),
  dispose: () => undefined,
};

function setup(ready: boolean, hasSettings = true) {
  document.body.innerHTML = '<button id="calibrate"></button><p id="calibrate-status"></p>';
  const engineStatus: EngineStatus = { isReady: () => ready, isFailed: () => false, load: () => Promise.resolve() };
  const settings: SettingsPanel = {
    setLocked: () => undefined,
    current: () => (hasSettings ? resolve({ ...DEFAULT_SETTINGS, deviceId: 'kobo-sage' }) : undefined),
  };
  const panel = initCalibrationPanel({ engineStatus, settings, getEngine: () => Promise.resolve(engine) });
  return { panel, button: document.getElementById('calibrate') as HTMLButtonElement };
}

describe('initCalibrationPanel', () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockClear();
  });

  it('is disabled until the engine is ready, while locked and without valid settings', () => {
    expect(setup(false).button.disabled).toBe(true);
    expect(setup(true, false).button.disabled).toBe(true);
    const { panel, button } = setup(true);
    expect(button.disabled).toBe(false);
    panel.setLocked(true);
    expect(button.disabled).toBe(true);
    panel.setLocked(false);
    expect(button.disabled).toBe(false);
  });

  it('downloads the calibration page of the chosen device', async () => {
    const { button } = setup(true);
    button.click();
    await vi.waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith('Calibration – Kobo Sage (2021).pdf', pdf, 'application/pdf');
    });
    await vi.waitFor(() => {
      expect(button.disabled).toBe(false);
    });
  });
});
