import './styles.css';
import { initConvertPanel, type ConvertPanel } from './convert-panel';
import { byId } from './dom';
import { initEngineStatus } from './engine-status';
import { initProjectPanel } from './project-panel';
import { initSettingsPanel } from './settings-panel';
import { isSupported, MINIMUM_BROWSERS } from './support';

const app = byId('app', HTMLElement);

if (isSupported()) {
  const engineStatus = initEngineStatus(() => {
    convertPanel.refresh();
  });
  const project = initProjectPanel(() => {
    convertPanel.inputsChanged();
  });
  const settings = initSettingsPanel(() => {
    convertPanel.inputsChanged();
  });
  const convertPanel: ConvertPanel = initConvertPanel({ engineStatus, project, settings });
  void engineStatus.load();
} else {
  const p = document.createElement('p');
  p.textContent = `Please update your browser. This app needs ${MINIMUM_BROWSERS} or newer.`;
  app.replaceChildren(p);
}
