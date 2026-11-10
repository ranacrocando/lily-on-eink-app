import { analyzeProject, versionWarnings, type ProjectAnalysis } from '@lily-on-eink/core';
import { byId } from './dom';
import { fromDataTransfer, fromFileList, type LoadedProject } from './files';
import { createLatest } from './latest';

export interface ProjectPanel {
  /** While locked, the pickers and checkboxes are disabled and drops are ignored (a conversion is running). */
  setLocked(locked: boolean): void;
  project(): LoadedProject | undefined;
  /** Main files whose checkbox is ticked. */
  selectedMainFiles(): string[];
}

function item(text: string): HTMLLIElement {
  const li = document.createElement('li');
  li.textContent = text;
  return li;
}

function list(className: string, items: string[]): HTMLUListElement {
  const ul = document.createElement('ul');
  ul.className = className;
  ul.append(...items.map(item));
  return ul;
}

/** The message for an include that points at a file that was not uploaded. */
export function missingIncludeMessage(from: string, target: string): string {
  return `${from} includes ${target}, which was not uploaded. Add the file or the whole folder.`;
}

/** Renders what was found in the project; `onSelect` is called when a checkbox changes. */
export function renderProject(
  container: HTMLElement,
  project: LoadedProject,
  analysis: ProjectAnalysis,
  onSelect: () => void,
): void {
  const parts: HTMLElement[] = [];
  const count = project.files.length;
  const p = document.createElement('p');
  p.textContent =
    count === 0
      ? 'No LilyPond files (.ly or .ily) found. Please add your files or the whole folder.'
      : `${String(count)} LilyPond ${count === 1 ? 'file' : 'files'} added.`;
  parts.push(p);

  if (project.skipped.length > 0) {
    const skipped = document.createElement('p');
    skipped.className = 'warning';
    skipped.textContent = `Skipped because they are larger than 2 MB: ${project.skipped.join(', ')}`;
    parts.push(skipped);
  }

  if (analysis.mainFiles.length > 0) {
    const set = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Pieces to convert';
    set.append(legend);
    for (const main of analysis.mainFiles) {
      const label = document.createElement('label');
      label.className = 'check';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = true;
      box.value = main;
      box.addEventListener('change', onSelect);
      label.append(box, ' ', main);
      set.append(label);
    }
    parts.push(set);
  } else if (count > 0) {
    const none = document.createElement('p');
    none.className = 'warning';
    none.textContent = 'None of these files looks like a complete score.';
    parts.push(none);
  }

  if (analysis.missingIncludes.length > 0) {
    parts.push(
      list(
        'problems',
        analysis.missingIncludes.map((m) => missingIncludeMessage(m.from, m.target)),
      ),
    );
  }
  const warnings = versionWarnings(analysis.versions);
  if (warnings.length > 0)
    parts.push(
      list(
        'warnings',
        warnings.map((w) => w.message),
      ),
    );

  container.replaceChildren(...parts);
}

/** Wires the drop zone and the two file pickers. `onChange` runs after the project or the selection changed. */
export function initProjectPanel(onChange: () => void): ProjectPanel {
  const zone = byId('drop-zone', HTMLElement);
  const summary = byId('project-summary', HTMLElement);
  const fileInput = byId('file-input', HTMLInputElement);
  const folderInput = byId('folder-input', HTMLInputElement);
  const buttons = [byId('choose-files', HTMLButtonElement), byId('choose-folder', HTMLButtonElement)];
  let current: LoadedProject | undefined;
  let locked = false;

  const selectedMainFiles = () =>
    Array.from(summary.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'), (box) => box.value);

  const setProject = createLatest<LoadedProject>(
    (project) => {
      current = project;
      renderProject(summary, project, analyzeProject(project.texts), onChange);
      onChange();
    },
    (error) => {
      console.error(error);
      current = undefined;
      summary.textContent = 'Sorry, these files could not be read. Please try again.';
      onChange();
    },
  );

  buttons[0]?.addEventListener('click', () => {
    fileInput.click();
  });
  buttons[1]?.addEventListener('click', () => {
    folderInput.click();
  });
  for (const input of [fileInput, folderInput]) {
    input.addEventListener('change', () => {
      if (input.files?.length && !locked) void setProject(fromFileList(input.files));
      input.value = '';
    });
  }
  // A file dropped next to the zone would make the browser open it, so a drop anywhere counts as a drop on the zone.
  window.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (!locked) zone.classList.add('active');
  });
  window.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) zone.classList.remove('active');
  });
  window.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('active');
    if (event.dataTransfer && !locked) void setProject(fromDataTransfer(event.dataTransfer));
  });

  return {
    project: () => current,
    selectedMainFiles,
    setLocked: (value) => {
      locked = value;
      for (const control of [...buttons, ...summary.querySelectorAll<HTMLInputElement>('input')]) {
        control.disabled = value;
      }
    },
  };
}
