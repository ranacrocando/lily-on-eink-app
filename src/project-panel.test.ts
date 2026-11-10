// @vitest-environment happy-dom
import { analyzeProject, type Engine } from '@lily-on-eink/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { LoadedProject } from './files';
import { runConversion } from './convert-run';
import { placeProject } from './files';
import { DEFAULT_SETTINGS, resolve } from './settings';
import { PLACEMENT_GAVE_UP, initProjectPanel, missingIncludeMessage, renderProject } from './project-panel';

function projectOf(texts: Record<string, string>): LoadedProject {
  return {
    files: Object.keys(texts).map((path) => ({ path, content: texts[path] ?? '' })),
    texts,
    skipped: [],
    notUtf8: [],
  };
}

describe('renderProject', () => {
  it('lists main files as checked boxes and explains missing includes', () => {
    const texts = { 'a.ly': String.raw`\version "2.24.0"` + '\n' + String.raw`\include "lib.ily"` + '\n\\score { c }' };
    const container = document.createElement('div');
    const onSelect = vi.fn();
    renderProject(container, projectOf(texts), analyzeProject(texts), onSelect);
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(1);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
    expect(container.textContent).toContain(missingIncludeMessage('a.ly', 'lib.ily'));
    boxes[0]?.dispatchEvent(new Event('change'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('shows version warnings and an empty-state message', () => {
    const texts = { 'old.ly': String.raw`\version "2.18.2"` + '\n' + String.raw`\score { c }` };
    const container = document.createElement('div');
    renderProject(container, projectOf(texts), analyzeProject(texts), vi.fn());
    expect(container.querySelector('.warnings')?.textContent).toContain('2.18.2');
    renderProject(container, projectOf({}), analyzeProject({}), vi.fn());
    expect(container.textContent).toContain('No LilyPond files');
  });
});

describe('renderProject warnings', () => {
  it('lists files that are not saved as UTF-8', () => {
    const texts = { 'a.ly': String.raw`\score { c }` };
    const container = document.createElement('div');
    renderProject(container, { ...projectOf(texts), notUtf8: ['a.ly'] }, analyzeProject(texts), vi.fn());
    expect(container.querySelector('.warnings')?.textContent).toContain(
      'Not saved as UTF-8, special characters may look wrong: a.ly',
    );
  });
});

describe('flat upload placement', () => {
  const main = [
    String.raw`\version "2.24.0"`,
    String.raw`\include "parts/voice.ily"`,
    String.raw`\score { \voice }`,
  ].join('\n');
  const voice = [String.raw`\version "2.24.0"`, 'voice = { c }'].join('\n');

  it('places the include before analysing: one note, no missing include, only main.ly to convert', () => {
    const placed = placeProject(projectOf({ 'main.ly': main, 'voice.ily': voice }));
    expect(placed.project.files.map((f) => f.path).sort()).toEqual(['main.ly', 'parts/voice.ily']);
    expect(Object.keys(placed.project.texts).sort()).toEqual(['main.ly', 'parts/voice.ily']);
    const container = document.createElement('div');
    renderProject(container, placed.project, analyzeProject(placed.project.texts), vi.fn(), placed);
    expect(container.textContent).not.toContain('was not uploaded');
    const notes = container.querySelectorAll('.notes li');
    expect(notes).toHaveLength(1);
    expect(notes[0]?.textContent).toBe('voice.ily was placed in parts/ because main.ly includes it from there.');
    const boxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'), (b) => b.value);
    expect(boxes).toEqual(['main.ly']);
  });

  it('leaves a project with folders alone', () => {
    const project = projectOf({ 'main.ly': main, 'parts/voice.ily': voice });
    const placed = placeProject(project);
    expect(placed.project).toBe(project);
    expect(placed.notes).toEqual([]);
  });

  it('shows the warning when the structure cannot be sorted out', () => {
    const container = document.createElement('div');
    const texts = { 'main.ly': main };
    renderProject(container, projectOf(texts), analyzeProject(texts), vi.fn(), { notes: [], gaveUp: true });
    expect(container.querySelector('.warnings')?.textContent).toContain(PLACEMENT_GAVE_UP);
  });

  const engine: Engine = {
    lilypondVersion: () => Promise.resolve('2.24.4'),
    compile: () => Promise.resolve({ ok: true, exitCode: 0, files: { 'score.pdf': new Uint8Array([1]) }, log: '' }),
    dispose: () => undefined,
  };
  const coreDiagnostics = async (texts: Record<string, string>, mainFiles: string[]) => {
    const settings = resolve(DEFAULT_SETTINGS);
    if (!settings) throw new Error('settings do not resolve');
    const files = Object.entries(texts).map(([path, text]) => ({ path, content: text }));
    const outcome = await runConversion({ files, settings, mainFiles, signal: new AbortController().signal }, engine);
    return outcome.result.diagnostics;
  };

  it('uses the same wording as core', async () => {
    const texts = { 'main.ly': main, 'voice.ily': voice };
    const infos = (await coreDiagnostics(texts, ['main.ly'])).filter((d) => d.severity === 'info');
    expect(infos.map((d) => d.message)).toEqual(placeProject(projectOf(texts)).notes);
    const two = { 'a.ly': String.raw`\include "x/v.ily"`, 'b.ly': String.raw`\include "y/v.ily"`, 'v.ily': voice };
    const twoInfos = (await coreDiagnostics(two, ['a.ly'])).filter((d) => d.severity === 'info');
    expect(twoInfos.map((d) => d.message)).toEqual(placeProject(projectOf(two)).notes);
  });

  it('uses the same gave-up warning as core', async () => {
    const cycle = { 'a.ly': String.raw`\include "x/b.ily"`, 'b.ily': String.raw`\include "x/b.ily"` };
    const warnings = (await coreDiagnostics(cycle, ['a.ly'])).filter((d) => d.severity === 'warning');
    expect(warnings.map((d) => d.message)).toContain(PLACEMENT_GAVE_UP);
  });

  it('lists a moved non-UTF-8 file under its placed path, once even if copied to several folders', () => {
    const texts = { 'a.ly': String.raw`\include "x/v.ily"`, 'b.ly': String.raw`\include "y/v.ily"`, 'v.ily': voice };
    const placed = placeProject({ ...projectOf(texts), notUtf8: ['v.ily'] });
    expect(placed.notes).toEqual(['v.ily was placed in x/ and y/ because a.ly and b.ly include it from there.']);
    expect(placed.project.notUtf8).toEqual(['x/v.ily']);
    const one = placeProject({ ...projectOf({ 'main.ly': main, 'voice.ily': voice }), notUtf8: ['voice.ily'] });
    expect(one.project.notUtf8).toEqual(['parts/voice.ily']);
  });

  it('keeps a file at the top when an include also finds it there', () => {
    const texts = { 'a.ly': String.raw`\include "v.ily"`, 'b.ly': String.raw`\include "x/v.ily"`, 'v.ily': voice };
    const placed = placeProject(projectOf(texts));
    expect(placed.project.files.map((f) => f.path).sort()).toEqual(['a.ly', 'b.ly', 'v.ily', 'x/v.ily']);
  });

  it('does not place an include that was skipped as too large', () => {
    const placed = placeProject({ ...projectOf({ 'main.ly': main }), skipped: ['voice.ily'] });
    expect(placed.notes).toEqual([]);
    expect(placed.project.skipped).toEqual(['voice.ily']);
  });

  it('labels the notes list', () => {
    const placed = placeProject(projectOf({ 'main.ly': main, 'voice.ily': voice }));
    const container = document.createElement('div');
    renderProject(container, placed.project, analyzeProject(placed.project.texts), vi.fn(), placed);
    expect(container.querySelector('ul.notes')?.getAttribute('aria-label')).toBe('Notes');
  });

  it('gives up on a growing include cycle', () => {
    const a = String.raw`\include "x/b.ily"`;
    const b = String.raw`\include "x/b.ily"`;
    expect(placeProject(projectOf({ 'a.ly': a, 'b.ily': b })).gaveUp).toBe(true);
  });
});

function fileDrag(files: File[], types = ['Files']): Event {
  const event = new Event('drop', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'dataTransfer', { value: { types, items: [], files } });
  return event;
}

describe('initProjectPanel drops', () => {
  const busy = vi.fn();
  let panel: ReturnType<typeof initProjectPanel>;

  beforeAll(() => {
    document.body.innerHTML = `<div id="drop-zone"></div><div id="project-summary"></div>
      <button id="choose-files"></button><button id="choose-folder"></button>
      <input id="file-input" type="file" /><input id="folder-input" type="file" />`;
    panel = initProjectPanel(() => undefined, busy);
  });

  it('ignores dragged text', () => {
    const event = fileDrag([], ['text/plain']);
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(panel.project()).toBeUndefined();
  });

  it('takes dropped files and keeps the browser from opening them', async () => {
    const event = fileDrag([new File(['x'], 'a.ly')]);
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => {
      expect(panel.project()?.files.map((f) => f.path)).toEqual(['a.ly']);
    });
  });

  it('ignores a load that finishes during a conversion', async () => {
    let finish!: () => void;
    const slow = new File(['x'], 'slow.ly');
    slow.arrayBuffer = () =>
      new Promise((resolve) => {
        finish = () => {
          resolve(new ArrayBuffer(1));
        };
      });
    window.dispatchEvent(fileDrag([slow]));
    await vi.waitFor(() => {
      expect(finish).toBeTypeOf('function');
    });
    panel.setLocked(true);
    finish();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(panel.project()?.files.map((f) => f.path)).toEqual(['a.ly']);
    expect(document.querySelectorAll('#project-summary input:not(:disabled)')).toHaveLength(0);
  });

  it('asks the user to wait when files are dropped during a conversion', () => {
    window.dispatchEvent(fileDrag([new File(['x'], 'b.ly')]));
    expect(busy).toHaveBeenCalledWith('Please wait until the conversion is done.');
    expect(panel.project()?.files.map((f) => f.path)).toEqual(['a.ly']);
  });
});
