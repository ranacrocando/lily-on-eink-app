// @vitest-environment happy-dom
import type { Engine, EngineResult } from '@lily-on-eink/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initCalibrationPanel } from './calibration-panel';
import { downloadBlob } from './download';
import type { EngineStatus } from './engine-status';
import type { ProjectPanel } from './project-panel';
import { byId } from './dom';
import { DEFAULT_SETTINGS, resolve } from './settings';
import type { SettingsPanel } from './settings-panel';

vi.mock('./download', () => ({ downloadBlob: vi.fn() }));

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const good: EngineResult = { ok: true, exitCode: 0, files: { 'calibration.pdf': pdf }, log: '' };

function setup(options: { ready?: boolean; hasSettings?: boolean; result?: Promise<EngineResult> } = {}) {
  const { ready = true, hasSettings = true, result = Promise.resolve(good) } = options;
  document.body.innerHTML = '<button id="calibrate"></button><p id="calibrate-status" tabindex="-1"></p>';
  const engine: Engine = {
    lilypondVersion: () => Promise.resolve('2.26.0'),
    compile: () => result,
    dispose: () => undefined,
  };
  const engineStatus: EngineStatus = { isReady: () => ready, isFailed: () => false, load: () => Promise.resolve() };
  const lockSettings = vi.fn();
  const lockProject = vi.fn();
  const settings: SettingsPanel = {
    setLocked: lockSettings,
    current: () => (hasSettings ? resolve({ ...DEFAULT_SETTINGS, deviceId: 'kobo-sage' }) : undefined),
  };
  const project = { setLocked: lockProject } as unknown as ProjectPanel;
  const onBusyChange = vi.fn();
  const panel = initCalibrationPanel({
    engineStatus,
    settings,
    project,
    getEngine: () => Promise.resolve(engine),
    onBusyChange,
  });
  return {
    panel,
    lockSettings,
    lockProject,
    onBusyChange,
    button: byId('calibrate', HTMLButtonElement),
    status: byId('calibrate-status', HTMLElement),
  };
}

describe('initCalibrationPanel', () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockClear();
  });

  it('is disabled until the engine is ready, while locked and without valid settings', () => {
    expect(setup({ ready: false }).button.disabled).toBe(true);
    expect(setup({ hasSettings: false }).button.disabled).toBe(true);
    const { panel, button } = setup();
    expect(button.disabled).toBe(false);
    panel.setLocked(true);
    expect(button.disabled).toBe(true);
    panel.setLocked(false);
    expect(button.disabled).toBe(false);
  });

  it('downloads the page, locks the other panels meanwhile and moves the focus to the status', async () => {
    let finish: (r: EngineResult) => void = () => undefined;
    const { button, status, panel, lockProject, lockSettings, onBusyChange } = setup({
      result: new Promise((r) => (finish = r)),
    });
    button.focus();
    button.click();
    await vi.waitFor(() => {
      expect(panel.isRunning()).toBe(true);
    });
    expect(button.disabled).toBe(true);
    expect(lockProject).toHaveBeenLastCalledWith(true);
    expect(lockSettings).toHaveBeenLastCalledWith(true);
    expect(onBusyChange).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(status);
    finish(good);
    await vi.waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith('Calibration – Kobo Sage (2021).pdf', pdf, 'application/pdf');
    });
    await vi.waitFor(() => {
      expect(panel.isRunning()).toBe(false);
    });
    expect(button.disabled).toBe(false);
    expect(lockProject).toHaveBeenLastCalledWith(false);
    expect(onBusyChange).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(button);
    expect(status.textContent).toContain('Saved');
  });

  it('shows a friendly message when LilyPond fails, and clears it when the settings change', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { button, status, panel } = setup({
      result: Promise.resolve({ ok: false, exitCode: 1, files: {}, log: 'boom' }),
    });
    button.click();
    await vi.waitFor(() => {
      expect(status.textContent).toContain('could not be made');
    });
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    panel.settingsChanged();
    expect(status.textContent).toBe('');
  });

  it('reports an engine reload as stopped, not as an error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { button, status } = setup({
      result: Promise.resolve({ ok: false, exitCode: 1, files: {}, log: '', aborted: true }),
    });
    button.click();
    await vi.waitFor(() => {
      expect(status.textContent).toContain('was stopped');
    });
    expect(error).not.toHaveBeenCalled();
  });
});
