import './styles.css';
import { initCalibrationPanel } from './calibration-panel';
import { initConvertPanel, type ConvertPanel } from './convert-panel';
import { byId } from './dom';
import { initEngineStatus } from './engine-status';
import { initHelpPanel } from './help-panel';
import { initProjectPanel } from './project-panel';
import { initSettingsPanel } from './settings-panel';
import { isSupported, MINIMUM_BROWSERS } from './support';

const app = byId('app', HTMLElement);

if (isSupported()) {
  const engineStatus = initEngineStatus(() => {
    convertPanel.refresh();
    calibration.refresh();
  });
  const project = initProjectPanel(
    () => {
      convertPanel.inputsChanged();
    },
    (message) => {
      convertPanel.notify(message);
    },
  );
  const settings = initSettingsPanel(() => {
    convertPanel.inputsChanged();
    calibration.refresh();
    calibration.settingsChanged();
    help.update();
  });
  const calibration = initCalibrationPanel({
    engineStatus,
    settings,
    project,
    onBusyChange: () => {
      convertPanel.refresh();
    },
    getEngine: async () => (await import('./engine')).getEngine(),
  });
  const help = initHelpPanel(settings);
  // The conversion locks the settings; the calibration button follows, so that the engine is not used twice.
  const lockingSettings = {
    ...settings,
    setLocked: (locked: boolean) => {
      settings.setLocked(locked);
      calibration.setLocked(locked);
    },
  };
  const convertPanel: ConvertPanel = initConvertPanel({
    engineStatus,
    project,
    settings: lockingSettings,
    calibrating: () => calibration.isRunning(),
  });
  void engineStatus.load();
  if (new URLSearchParams(location.search).has('test')) {
    void import('./test-hook').then((m) => {
      m.installTestHook();
    });
  }
} else {
  const p = document.createElement('p');
  p.textContent = `Please update your browser. This app needs ${MINIMUM_BROWSERS} or newer.`;
  app.replaceChildren(p);
}
