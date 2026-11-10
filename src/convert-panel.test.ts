// @vitest-environment happy-dom
import type { ConvertResult } from '@lily-on-eink/core';
import { describe, expect, it } from 'vitest';
import { diagnosticText, renderResults } from './convert-panel';

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function render(result: ConvertResult, mainFiles: string[]): HTMLElement {
  const container = document.createElement('div');
  renderResults(container, result, mainFiles, 'all.zip');
  return container;
}

const output = (mainFile: string, fileName: string) => ({ mainFile, bookIndex: 0, pdf, fileName });

describe('diagnosticText', () => {
  it('shows severity, message and position', () => {
    expect(diagnosticText({ file: 'a.ly', line: 3, column: 1, severity: 'error', message: 'boom' })).toBe(
      'Error: boom (a.ly:3)',
    );
    expect(diagnosticText({ file: 'a.ly', line: 0, column: 0, severity: 'warning', message: 'hm' })).toBe(
      'Warning: hm (a.ly)',
    );
    expect(diagnosticText({ file: '', line: 0, column: 0, severity: 'error', message: 'x' })).toBe('Error: x');
  });
});

describe('renderResults', () => {
  it('lists a row per PDF with a download button, and a ZIP button for several', () => {
    const c = render({ outputs: [output('a.ly', 'Song.pdf'), output('b.ly', 'Song.pdf')], diagnostics: [], logs: {} }, [
      'a.ly',
      'b.ly',
    ]);
    expect(Array.from(c.querySelectorAll('.file-name'), (n) => n.textContent)).toEqual(['Song.pdf', 'Song (2).pdf']);
    expect(Array.from(c.querySelectorAll('button'), (b) => b.textContent)).toEqual([
      'Download',
      'Download',
      'Download all (ZIP)',
    ]);
  });

  it('has no ZIP button for one PDF', () => {
    const c = render({ outputs: [output('a.ly', 'Song.pdf')], diagnostics: [], logs: {} }, ['a.ly']);
    expect(c.textContent).not.toContain('ZIP');
  });

  it('shows the log of a failed file but not an empty one', () => {
    const diagnostics = [{ file: 'a.ly', line: 2, column: 1, severity: 'error' as const, message: 'bad' }];
    const c = render({ outputs: [], diagnostics, logs: { 'a.ly': 'a.ly:2:1: error: bad', 'b.ly': '  \n' } }, [
      'a.ly',
      'b.ly',
    ]);
    const summaries = Array.from(c.querySelectorAll('summary'), (s) => s.textContent);
    expect(summaries).toEqual(['Show LilyPond log for a.ly']);
    expect(c.querySelector('.diagnostics')?.textContent).toContain('Error: bad (a.ly:2)');
  });

  it('shows no log for a file without a log (cancelled or timed out)', () => {
    const c = render({ outputs: [], diagnostics: [], logs: {} }, ['a.ly']);
    expect(c.querySelector('details')).toBeNull();
  });
});
