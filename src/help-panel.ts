import { byId } from './dom';
import { renderHelp } from './help';
import type { SettingsPanel } from './settings-panel';

export interface HelpPanel {
  /** Shows the steps for the currently chosen device. */
  update(): void;
}

/** Keeps the "How do I get the PDF onto my e-reader?" section in line with the chosen device. */
export function initHelpPanel(settings: SettingsPanel): HelpPanel {
  const body = byId('transfer-help-body', HTMLElement);
  function update(): void {
    renderHelp(body, settings.current()?.device.id ?? 'custom');
  }
  update();
  return { update };
}
