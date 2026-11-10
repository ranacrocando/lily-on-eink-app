import './styles.css';
import { initConvertPanel } from './convert-panel';
import { byId } from './dom';
import { initEngineStatus } from './engine-status';
import { initProjectPanel } from './project-panel';
import { initSettingsPanel } from './settings-panel';
import { isSupported, MINIMUM_BROWSERS } from './support';

const app = byId('app', HTMLElement);

if (isSupported()) {
  let refresh: () => void = () => undefined;
  const engineStatus = initEngineStatus(() => {
    refresh();
  });
  const project = initProjectPanel(() => {
    refresh();
  });
  const settings = initSettingsPanel(() => {
    refresh();
  });
  refresh = initConvertPanel({ engineStatus, project, settings });
  void engineStatus.load();
} else {
  const p = document.createElement('p');
  p.textContent = `Please update your browser. This app needs ${MINIMUM_BROWSERS} or newer.`;
  app.replaceChildren(p);
}
