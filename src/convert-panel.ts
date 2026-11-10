import type { ConvertResult, Diagnostic } from '@lily-on-eink/core';
import { progressText, runConversion } from './convert-run';
import { byId } from './dom';
import { dedupeNames, downloadBlob, zipFiles, zipFileName, type NamedFile } from './download';
import type { EngineStatus } from './engine-status';
import type { ProjectPanel } from './project-panel';
import type { SettingsPanel } from './settings-panel';

interface Parts {
  engineStatus: EngineStatus;
  project: ProjectPanel;
  settings: SettingsPanel;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}

function downloadButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const button = element('button', label);
  button.type = 'button';
  button.setAttribute('aria-label', ariaLabel);
  button.addEventListener('click', onClick);
  return button;
}

/** "error: message (file:line)" */
export function diagnosticText(d: Diagnostic): string {
  const where = d.file ? ` (${d.file}${d.line > 0 ? `:${String(d.line)}` : ''})` : '';
  return `${d.severity === 'error' ? 'Error' : 'Warning'}: ${d.message}${where}`;
}

/** Renders PDFs, messages and LilyPond logs of one conversion. */
export function renderResults(
  container: HTMLElement,
  result: ConvertResult,
  mainFiles: string[],
  zipName: string,
): void {
  const parts: HTMLElement[] = [];
  const pdfs = result.outputs.flatMap((o) => (o.pdf ? [{ bytes: o.pdf, fileName: o.fileName }] : []));
  const names = dedupeNames(pdfs.map((p) => p.fileName));
  const files: NamedFile[] = pdfs.map((p, i) => ({ name: names[i] ?? p.fileName, bytes: p.bytes }));

  if (files.length > 0) {
    parts.push(element('h3', files.length === 1 ? 'Your PDF' : 'Your PDFs'));
    const ul = element('ul', undefined, 'results');
    for (const file of files) {
      const li = element('li');
      li.append(
        element('span', file.name, 'file-name'),
        downloadButton('Download', `Download ${file.name}`, () => {
          downloadBlob(file.name, file.bytes, 'application/pdf');
        }),
      );
      ul.append(li);
    }
    parts.push(ul);
    if (files.length > 1) {
      parts.push(
        downloadButton('Download all (ZIP)', 'Download all PDFs as one ZIP file', () => {
          downloadBlob(zipName, zipFiles(files), 'application/zip');
        }),
      );
    }
  }

  if (result.diagnostics.length > 0) {
    parts.push(element('h3', 'Messages'));
    const ul = element('ul', undefined, 'diagnostics');
    for (const d of result.diagnostics) ul.append(element('li', diagnosticText(d), d.severity));
    parts.push(ul);
  }

  const failed = mainFiles.filter(
    (m) => !result.outputs.some((o) => o.mainFile === m) && (result.logs[m] ?? '').trim() !== '',
  );
  for (const main of failed) {
    const details = element('details');
    details.append(element('summary', `Show LilyPond log for ${main}`), element('pre', result.logs[main]));
    parts.push(details);
  }
  container.replaceChildren(...parts);
}

export interface ConvertPanel {
  /** Updates the Convert button after the engine status changed. */
  refresh(): void;
  /** Call when files, selection or settings changed: removes results that belong to the old input. */
  inputsChanged(): void;
  /** Shows a message in the status area. */
  notify(message: string): void;
}

/** Wires the Convert and Cancel buttons. */
export function initConvertPanel({ engineStatus, project, settings }: Parts): ConvertPanel {
  const convertButton = byId('convert', HTMLButtonElement);
  const cancelButton = byId('cancel', HTMLButtonElement);
  const hint = byId('convert-hint', HTMLElement);
  const progress = byId('progress-text', HTMLElement);
  const results = byId('results', HTMLElement);
  let controller: AbortController | undefined;

  function refresh(): void {
    const running = controller !== undefined;
    let reason = '';
    if (engineStatus.isFailed()) reason = 'The music engine could not be loaded. Please reload the page.';
    else if (!engineStatus.isReady()) reason = 'Waiting for the music engine…';
    else if (!project.project()?.files.length) reason = 'Add your LilyPond files first.';
    else if (project.selectedMainFiles().length === 0) reason = 'Choose at least one piece to convert.';
    else if (!settings.current()) reason = 'Check the screen size of your e-reader.';
    convertButton.disabled = running || reason !== '';
    cancelButton.hidden = !running;
    hint.textContent = running ? '' : reason;
  }

  async function start(): Promise<void> {
    const loaded = project.project();
    const chosen = settings.current();
    const mainFiles = project.selectedMainFiles();
    if (!loaded || !chosen || mainFiles.length === 0) return;

    controller = new AbortController();
    const { signal } = controller;
    results.replaceChildren();
    progress.textContent = 'Starting…';
    project.setLocked(true);
    settings.setLocked(true);
    refresh();
    cancelButton.focus();
    let reload = false;
    try {
      const { getEngine } = await import('./engine');
      const outcome = await runConversion(
        {
          files: loaded.files,
          settings: chosen,
          mainFiles,
          signal,
          onProgress: (p) => {
            if (p.phase === 'compiling') progress.textContent = progressText(p);
          },
        },
        getEngine(),
      );
      reload = outcome.engineReset;
      const count = outcome.result.outputs.filter((o) => o.pdf).length;
      if (outcome.cancelled) progress.textContent = 'Cancelled.';
      else if (count > 0) progress.textContent = `Done. ${String(count)} ${count === 1 ? 'PDF is' : 'PDFs are'} ready.`;
      else progress.textContent = 'Nothing could be converted. See the messages below.';
      renderResults(results, outcome.result, mainFiles, zipFileName(chosen.device.name));
    } catch (error) {
      console.error(error);
      progress.textContent = 'Sorry, something went wrong. Please try again.';
    }
    controller = undefined;
    project.setLocked(false);
    settings.setLocked(false);
    refresh();
    // A cancel or timeout stops the engine's worker; load it again now instead of during the next conversion.
    if (reload) {
      // Convert is disabled until the engine is back, so the status text gets the focus meanwhile.
      progress.focus();
      await engineStatus.load();
      if (document.activeElement === progress && !convertButton.disabled) convertButton.focus();
    } else {
      convertButton.focus();
    }
  }

  function inputsChanged(): void {
    if (controller === undefined) {
      results.replaceChildren();
      progress.textContent = '';
    }
    refresh();
  }

  convertButton.addEventListener('click', () => {
    void start();
  });
  cancelButton.addEventListener('click', () => {
    progress.textContent = 'Cancelling…';
    controller?.abort();
  });
  refresh();
  return {
    refresh,
    inputsChanged,
    notify: (message) => {
      progress.textContent = message;
    },
  };
}
