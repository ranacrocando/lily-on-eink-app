import type { ConvertResult, Diagnostic, Progress, ProjectFile } from '@lily-on-eink/core';
import { progressText, runConversion, type RunOutcome } from './convert-run';
import { byId } from './dom';
import { dedupeNames, downloadBlob, zipFiles, zipFileName, type NamedFile } from './download';
import type { EngineStatus } from './engine-status';
import { firstPagePng, initPreview } from './preview';
import type { ProjectPanel } from './project-panel';
import type { SettingsPanel } from './settings-panel';
import type { Resolved } from './settings';

interface Parts {
  engineStatus: EngineStatus;
  project: ProjectPanel;
  settings: SettingsPanel;
  /** True while the calibration page is being drawn: the engine is busy and Convert and Preview must wait. */
  calibrating?: () => boolean;
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

/** "Error: message (file:line)"; info diagnostics are shown as "Note: …". */
export function diagnosticText(d: Diagnostic): string {
  const where = d.file ? ` (${d.file}${d.line > 0 ? `:${String(d.line)}` : ''})` : '';
  const label = d.severity === 'error' ? 'Error' : d.severity === 'warning' ? 'Warning' : 'Note';
  return `${label}: ${d.message}${where}`;
}

/** Renders PDFs, messages and LilyPond logs of one conversion. */
export function renderResults(
  container: HTMLElement,
  result: ConvertResult,
  mainFiles: string[],
  zipName: string,
  onPreview?: (mainFile: string, bookIndex: number, button: HTMLButtonElement) => void,
): void {
  const parts: HTMLElement[] = [];
  const pdfs = result.outputs.flatMap((o) =>
    o.pdf ? [{ bytes: o.pdf, fileName: o.fileName, mainFile: o.mainFile, bookIndex: o.bookIndex }] : [],
  );
  const names = dedupeNames(pdfs.map((p) => p.fileName));
  const files = pdfs.map((p, i) => ({ ...p, name: names[i] ?? p.fileName }));
  const namedFiles: NamedFile[] = files.map((f) => ({ name: f.name, bytes: f.bytes }));

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
      if (onPreview) {
        const preview = downloadButton('Preview', `Preview the first page of ${file.name}`, () => {
          onPreview(file.mainFile, file.bookIndex, preview);
        });
        preview.classList.add('preview-button');
        li.append(preview);
      }
      ul.append(li);
    }
    parts.push(ul);
    if (files.length > 1) {
      parts.push(
        downloadButton('Download all (ZIP)', 'Download all PDFs as one ZIP file', () => {
          downloadBlob(zipName, zipFiles(namedFiles), 'application/zip');
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
export function initConvertPanel({ engineStatus, project, settings, calibrating }: Parts): ConvertPanel {
  const convertButton = byId('convert', HTMLButtonElement);
  const cancelButton = byId('cancel', HTMLButtonElement);
  const hint = byId('convert-hint', HTMLElement);
  const progress = byId('progress-text', HTMLElement);
  const results = byId('results', HTMLElement);
  const preview = initPreview();
  let controller: AbortController | undefined;

  function refresh(): void {
    const running = controller !== undefined;
    const drawing = calibrating?.() ?? false;
    let reason = '';
    if (drawing) reason = 'Drawing the calibration page…';
    else if (engineStatus.isFailed()) reason = 'The music engine could not be loaded. Please reload the page.';
    else if (!engineStatus.isReady()) reason = 'Waiting for the music engine…';
    else if (!project.project()?.files.length) reason = 'Add your LilyPond files first.';
    else if (project.selectedMainFiles().length === 0) reason = 'Choose at least one piece to convert.';
    else if (!settings.current()) reason = 'Check the screen size of your e-reader.';
    convertButton.disabled = running || reason !== '';
    cancelButton.hidden = !running;
    for (const button of results.querySelectorAll<HTMLButtonElement>('button.preview-button'))
      button.disabled = running || drawing || !engineStatus.isReady();
    hint.textContent = running ? '' : reason;
  }

  interface Job {
    files: ProjectFile[];
    settings: Resolved;
    mainFiles: string[];
    outputs: ('pdf' | 'png')[];
    startText: string;
    progressText: (p: Progress) => string;
  }

  /** Runs one conversion with the controls locked. Both Convert and Preview go through here. */
  async function execute(
    job: Job,
    onOutcome: (outcome: RunOutcome) => void | Promise<void>,
    focusAfter: () => HTMLElement,
  ): Promise<void> {
    if (controller !== undefined || calibrating?.()) return;
    controller = new AbortController();
    const { signal } = controller;
    preview.clear();
    progress.textContent = job.startText;
    project.setLocked(true);
    settings.setLocked(true);
    refresh();
    cancelButton.focus();
    let reload = false;
    try {
      const { getEngine } = await import('./engine');
      const outcome = await runConversion(
        {
          files: job.files,
          settings: job.settings,
          mainFiles: job.mainFiles,
          outputs: job.outputs,
          signal,
          onProgress: (p) => {
            if (p.phase === 'compiling') progress.textContent = job.progressText(p);
          },
        },
        getEngine(),
      );
      reload = outcome.engineReset;
      await onOutcome(outcome);
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
      if (document.activeElement === progress && !convertButton.disabled) focusAfter().focus();
    } else {
      focusAfter().focus();
    }
  }

  async function start(): Promise<void> {
    const loaded = project.project();
    const chosen = settings.current();
    const mainFiles = project.selectedMainFiles();
    if (!loaded || !chosen || mainFiles.length === 0) return;
    results.replaceChildren();
    const { files } = loaded;
    await execute(
      { files, settings: chosen, mainFiles, outputs: ['pdf'], startText: 'Starting…', progressText },
      (outcome) => {
        const count = outcome.result.outputs.filter((o) => o.pdf).length;
        if (outcome.cancelled) progress.textContent = 'Cancelled.';
        else if (count > 0)
          progress.textContent = `Done. ${String(count)} ${count === 1 ? 'PDF is' : 'PDFs are'} ready.`;
        else progress.textContent = 'Nothing could be converted. See the messages below.';
        // The preview converts again with the same files and settings as this run.
        renderResults(results, outcome.result, mainFiles, zipFileName(chosen.device.name), (main, book, button) => {
          void showPreview(files, chosen, main, book, button);
        });
      },
      () => convertButton,
    );
  }

  async function showPreview(
    files: ProjectFile[],
    chosen: Resolved,
    mainFile: string,
    bookIndex: number,
    button: HTMLButtonElement,
  ): Promise<void> {
    await execute(
      {
        files,
        settings: chosen,
        mainFiles: [mainFile],
        outputs: ['png'],
        startText: `Preparing the preview of ${mainFile}…`,
        progressText: () => `Preparing the preview of ${mainFile}…`,
      },
      async (outcome) => {
        if (outcome.cancelled) {
          progress.textContent = 'Cancelled.';
          return;
        }
        const png = firstPagePng(outcome.result, mainFile, bookIndex);
        if (!png) {
          const errors = outcome.result.diagnostics.filter((d) => d.severity === 'error').map(diagnosticText);
          progress.textContent = ['The preview could not be created.', ...errors].join(' ');
          return;
        }
        try {
          await preview.show(png, chosen.device, button);
          progress.textContent = 'The preview is ready.';
        } catch (error) {
          console.error(error);
          progress.textContent = 'The preview could not be created.';
        }
      },
      () => (preview.isOpen() ? preview.closeButton : button),
    );
  }

  function inputsChanged(): void {
    if (controller === undefined) {
      results.replaceChildren();
      preview.clear();
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
