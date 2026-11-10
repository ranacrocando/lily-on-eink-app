import './styles.css';
import { byId } from './dom';
import { engineText, parseIndex, renderLicenseList } from './licenses';

const base = 'licenses/';

async function init(): Promise<void> {
  const list = byId('licence-list', HTMLElement);
  const info = byId('engine-info', HTMLElement);
  const error = byId('licence-error', HTMLElement);
  try {
    const response = await fetch(`${base}index.json`);
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
    const index = parseIndex(await response.json());
    info.textContent = engineText(index);
    renderLicenseList(list, index, base);
  } catch (e) {
    console.error(e);
    info.textContent = '';
    error.textContent = 'The list of licences could not be loaded. Please reload the page.';
  }
}

void init();
