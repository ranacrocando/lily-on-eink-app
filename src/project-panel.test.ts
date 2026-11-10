// @vitest-environment happy-dom
import { analyzeProject } from '@lily-on-eink/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { LoadedProject } from './files';
import { initProjectPanel, missingIncludeMessage, renderProject } from './project-panel';

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
