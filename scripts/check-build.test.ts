import { describe, expect, it } from 'vitest';
import { checkBuild } from './check-build.mjs';

const MB = 1024 * 1024;
const good = [
  { name: 'lilypond-abc.wasm', size: 15 * MB },
  { name: 'runtime.data-abc.bin', size: 10 * MB },
  { name: 'lilypond-abc.mjs', size: 1000 },
  { name: 'worker-abc.js', size: 1000 },
];

describe('checkBuild', () => {
  it('accepts a good build', () => {
    expect(checkBuild(good, 30 * MB)).toEqual([]);
  });
  it('detects missing assets', () => {
    expect(checkBuild(good.slice(1), 30 * MB)).toContain('missing lilypond-*.wasm');
  });
  it('detects a duplicated wasm and an oversized dist', () => {
    const dup = [...good, { name: 'lilypond-def.wasm', size: 15 * MB }];
    expect(checkBuild(dup, 45 * MB)).toHaveLength(2);
  });
  it('checks the about page and licences when the file list is given', () => {
    const paths = ['about.html', 'licenses/index.json', 'licenses/THIRD-PARTY-NOTICES.txt'];
    expect(checkBuild(good, 30 * MB, paths)).toEqual([]);
    expect(checkBuild(good, 30 * MB, ['index.html'])).toHaveLength(3);
  });
});
