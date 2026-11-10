import type { Engine } from '@lily-on-eink/core';
import { makeCalibration } from './calibration';
import { byId } from './dom';
import { downloadBlob } from './download';
import type { EngineStatus } from './engine-status';
import type { SettingsPanel } from './settings-panel';

export interface CalibrationPanel {
  /** Enables or disables the button after the engine status or the settings changed. */
  refresh(): void;
  /** Disables the button while a conversion is running. */
  setLocked(locked: boolean): void;
}

interface Parts {
  engineStatus: EngineStatus;
  settings: SettingsPanel;
  /** The engine to compile with; loaded on demand. */
  getEngine: () => Promise<Engine>;
}

/** Wires the "Download calibration page" button. */
export function initCalibrationPanel({ engineStatus, settings, getEngine }: Parts): CalibrationPanel {
  const button = byId('calibrate', HTMLButtonElement);
  const status = byId('calibrate-status', HTMLElement);
  let locked = false;
  let running = false;

  function refresh(): void {
    button.disabled = locked || running || !engineStatus.isReady() || !settings.current();
  }

  async function start(): Promise<void> {
    const chosen = settings.current();
    if (!chosen || button.disabled) return;
    running = true;
    refresh();
    status.textContent = 'Drawing the calibration page…';
    try {
      const file = await makeCalibration(await getEngine(), chosen.device);
      downloadBlob(file.name, file.bytes, 'application/pdf');
      status.textContent = `Saved ${file.name}.`;
    } catch (error) {
      console.error(error);
      status.textContent = 'Sorry, the calibration page could not be made. Please try again.';
    }
    running = false;
    refresh();
  }

  button.addEventListener('click', () => {
    void start();
  });
  refresh();
  return {
    refresh,
    setLocked: (value) => {
      locked = value;
      refresh();
    },
  };
}
