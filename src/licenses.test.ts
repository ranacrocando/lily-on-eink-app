// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { engineText, parseIndex, renderLicenseList } from './licenses';

const index = {
  engine: { package: '@sightread/lilypond-wasm', version: '0.2.0', lilypond: '2.26' },
  files: [{ file: 'fflate-LICENSE', package: 'fflate', license: 'MIT' }],
};

describe('licenses', () => {
  it('parses a valid index and rejects others', () => {
    expect(parseIndex(index)).toEqual(index);
    expect(() => parseIndex(null)).toThrow();
    expect(() => parseIndex({ engine: index.engine, files: [{ file: 1 }] })).toThrow();
    expect(() => parseIndex({ files: [] })).toThrow();
  });
  it('names the engine', () => {
    expect(engineText(index)).toBe('LilyPond 2.26 via @sightread/lilypond-wasm 0.2.0');
  });
  it('renders one entry per package with a link per file', () => {
    const ul = document.createElement('ul');
    renderLicenseList(ul, index, 'licenses/');
    expect(ul.querySelector('a')?.getAttribute('href')).toBe('licenses/fflate-LICENSE');
    expect(ul.textContent).toBe('fflate (MIT)fflate-LICENSE');
  });
});
