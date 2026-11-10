import type { Engine } from '@lily-on-eink/core';
import { CalibrationCancelled, makeCalibration } from './calibration';
import { byId } from './dom';
import { downloadBlob } from './download';
import type { EngineStatus } from './engine-status';
import type { ProjectPanel } from './project-panel';
import type { SettingsPanel } from './settings-panel';

export interface CalibrationPanel {
  /** Enables or disables the button after the engine status or the settings changed. */
  refresh(): void;
  /** Disables the button while a conversion or preview is running. */
  setLocked(locked: boolean): void;
  /** True while the calibration page is being drawn. */
  isRunning(): boolean;
  /** Call when the settings changed: the message about the last download no longer applies. */
  settingsChanged(): void;
}

interface Parts {
  engineStatus: EngineStatus;
  settings: SettingsPanel;
  project: ProjectPanel;
  /** The engine to compile with; loaded on demand. */
  getEngine: () => Promise<Engine>;
  /** Runs when the calibration starts or ends, so that Convert and Preview can follow. */
  onBusyChange: () => void;
}

/** Wires the "Download calibration page" button. */
export function initCalibrationPanel({
  engineStatus,
  settings,
  project,
  getEngine,
  onBusyChange,
}: Parts): CalibrationPanel {
  const button = byId('calibrate', HTMLButtonElement);
  const status = byId('calibrate-status', HTMLElement);
  let locked = false;
  let running = false;

  function refresh(): void {
    button.disabled = locked || running || !engineStatus.isReady() || !settings.current();
  }

  function setBusy(busy: boolean): void {
    running = busy;
    project.setLocked(busy);
    settings.setLocked(busy);
    refresh();
    onBusyChange();
  }

  async function start(): Promise<void> {
    const chosen = settings.current();
    if (!chosen || button.disabled) return;
    const controller = new AbortController();
    status.textContent = 'Drawing the calibration page…';
    setBusy(true);
    // A disabled button loses the focus; the status text takes it meanwhile.
    status.focus();
    try {
      const file = await makeCalibration(await getEngine(), chosen.device, controller.signal);
      downloadBlob(file.name, file.bytes, 'application/pdf');
      status.textContent = `Saved ${file.name}.`;
    } catch (error) {
      if (error instanceof CalibrationCancelled) {
        status.textContent = 'The calibration page was stopped. Please try again.';
      } else {
        console.error(error);
        status.textContent = 'Sorry, the calibration page could not be made. Please try again.';
      }
    }
    const hadFocus = status.matches(':focus');
    setBusy(false);
    if (hadFocus) button.focus();
  }

  button.addEventListener('click', () => {
    void start();
  });
  refresh();
  return {
    refresh,
    isRunning: () => running,
    setLocked: (value) => {
      locked = value;
      refresh();
    },
    settingsChanged: () => {
      if (!running) status.textContent = '';
    },
  };
}
