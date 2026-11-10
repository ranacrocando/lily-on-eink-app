import { listDevices, listProfiles } from '@lily-on-eink/core';
import { byId } from './dom';
import {
  CUSTOM_ID,
  loadSettings,
  resolve,
  saveSettings,
  validateCustom,
  type CustomSize,
  type Resolved,
  type Settings,
} from './settings';

export interface SettingsPanel {
  /** The chosen settings, or undefined while the custom size is invalid. */
  current(): Resolved | undefined;
}

function option(value: string, text: string): HTMLOptionElement {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  return o;
}

const mm = (n: number) => n.toFixed(1);

/** Wires the e-reader settings; `onChange` runs after every change. */
export function initSettingsPanel(onChange: () => void): SettingsPanel {
  const device = byId('device', HTMLSelectElement);
  const profile = byId('profile', HTMLSelectElement);
  const noteSize = byId('note-size', HTMLInputElement);
  const noteSizeText = byId('note-size-text', HTMLElement);
  const customBox = byId('custom-size', HTMLElement);
  const customError = byId('custom-error', HTMLElement);
  const width = byId('custom-width', HTMLInputElement);
  const height = byId('custom-height', HTMLInputElement);
  const ppi = byId('custom-ppi', HTMLInputElement);
  const pageSize = byId('page-size', HTMLElement);

  device.replaceChildren(...listDevices().map((d) => option(d.id, d.name)), option(CUSTOM_ID, 'Custom size…'));
  profile.replaceChildren(...listProfiles().map((p) => option(p.id, p.name)));

  const initial = loadSettings();
  device.value = initial.deviceId;
  profile.value = initial.profileId;
  noteSize.value = String(initial.noteSizeDelta);
  width.value = String(initial.custom.widthPx);
  height.value = String(initial.custom.heightPx);
  ppi.value = String(initial.custom.ppi);

  const customValues = (): Partial<Record<keyof CustomSize, unknown>> => ({
    widthPx: width.valueAsNumber,
    heightPx: height.valueAsNumber,
    ppi: ppi.valueAsNumber,
  });

  const read = (): Settings => {
    const custom = validateCustom(customValues());
    return {
      deviceId: device.value,
      custom: typeof custom === 'string' ? initial.custom : custom,
      profileId: profile.value,
      noteSizeDelta: noteSize.valueAsNumber,
    };
  };

  /** Settings as the user sees them, including an invalid custom size (kept out of storage). */
  let resolved: Resolved | undefined;

  function update(): void {
    const isCustom = device.value === CUSTOM_ID;
    customBox.hidden = !isCustom;
    const problem = isCustom ? validateCustom(customValues()) : undefined;
    customError.textContent = typeof problem === 'string' ? problem : '';
    const settings = read();
    resolved = typeof problem === 'string' ? undefined : resolve(settings);
    if (resolved) {
      const delta = settings.noteSizeDelta;
      const change = delta === 0 ? 'standard' : `${delta > 0 ? '+' : ''}${String(delta)}`;
      noteSizeText.textContent = `Note size: ${String(resolved.staffSize)} (${change})`;
      pageSize.textContent = `Page size: ${mm(resolved.pageMm.width)} × ${mm(resolved.pageMm.height)} mm`;
    } else {
      noteSizeText.textContent = `Note size: ${String(settings.noteSizeDelta)}`;
      pageSize.textContent = 'Page size: enter a valid custom size.';
    }
    saveSettings(settings);
  }

  for (const input of [device, profile, noteSize, width, height, ppi]) {
    input.addEventListener('input', () => {
      update();
      onChange();
    });
  }
  update();

  return { current: () => resolved };
}
