// @vitest-environment happy-dom
import { analyzeProject } from '@lily-on-eink/core';
import { describe, expect, it, vi } from 'vitest';
import type { LoadedProject } from './files';
import { missingIncludeMessage, renderProject } from './project-panel';

function projectOf(texts: Record<string, string>): LoadedProject {
  return { files: Object.keys(texts).map((path) => ({ path, content: texts[path] ?? '' })), texts, skipped: [] };
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
