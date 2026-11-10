import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildIndex, copyLicenses, licenseOf, outputName, packagesToCopy, pickLicenseFile } from './copy-licenses.mjs';

describe('pickLicenseFile', () => {
  it('finds the usual names, case-insensitively, preferring LICENSE', () => {
    expect(pickLicenseFile(['README.md', 'COPYING', 'LICENSE'])).toBe('LICENSE');
    expect(pickLicenseFile(['license.md'])).toBe('license.md');
    expect(pickLicenseFile(['COPYING'])).toBe('COPYING');
  });
  it('returns undefined without a licence file', () => {
    expect(pickLicenseFile(['README.md', 'package.json'])).toBeUndefined();
  });
});

describe('names and lists', () => {
  it('makes flat output names', () => {
    expect(outputName('@lily-on-eink/core', 'LICENSE')).toBe('lily-on-eink-core-LICENSE');
    expect(outputName('fflate', 'LICENSE')).toBe('fflate-LICENSE');
  });
  it('walks runtime dependencies recursively', () => {
    const deps: Record<string, Record<string, string>> = { a: { b: '1' }, b: { a: '1', c: '1' }, c: {} };
    expect(packagesToCopy({ a: '1' }, (n) => deps[n]).sort()).toEqual(['@sightread/lilypond-wasm', 'a', 'b', 'c']);
  });
  it('adds the engine package once', () => {
    expect(packagesToCopy({ fflate: '1' })).toEqual(['fflate', '@sightread/lilypond-wasm']);
    expect(packagesToCopy({ '@sightread/lilypond-wasm': '1' })).toEqual(['@sightread/lilypond-wasm']);
    expect(packagesToCopy(undefined)).toEqual(['@sightread/lilypond-wasm']);
  });
  it('sorts the index and records the engine version', () => {
    const index = buildIndex(
      [
        { file: 'b', package: 'b', license: 'MIT' },
        { file: 'a', package: 'a', license: 'MIT' },
      ],
      '0.2.0',
      'app-LICENSE',
    );
    expect(index.files.map((f) => f.file)).toEqual(['a', 'b']);
    expect(index.appLicense).toBe('app-LICENSE');
    expect(index.engine).toMatchObject({ version: '0.2.0', lilypond: '2.26' });
  });
  it('requires a declared licence', () => {
    expect(licenseOf('x', { license: 'MIT' })).toBe('MIT');
    expect(() => licenseOf('x', {})).toThrow('x declares no license');
  });
});

describe('copyLicenses', () => {
  function project(withLicense: boolean, withEngineLicenses = true): string {
    const root = mkdtempSync(join(tmpdir(), 'licenses-'));
    const pkg = (dir: string, json: object, files: Record<string, string>) => {
      mkdirSync(join(root, 'node_modules', dir), { recursive: true });
      writeFileSync(join(root, 'node_modules', dir, 'package.json'), JSON.stringify(json));
      for (const [name, text] of Object.entries(files)) writeFileSync(join(root, 'node_modules', dir, name), text);
    };
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'app', dependencies: { dep: '1' } }));
    writeFileSync(join(root, 'LICENSE'), 'app licence');
    pkg('dep', { license: 'MIT', dependencies: { sub: '1' } }, withLicense ? { LICENSE: 'dep licence' } : {});
    pkg('sub', { license: 'ISC' }, { 'LICENSE.md': 'sub licence' });
    pkg('@sightread/lilypond-wasm', { license: 'GPL', version: '9.9.9' }, { LICENSE: 'engine' });
    if (withEngineLicenses) {
      const extra = join(root, 'node_modules/@sightread/lilypond-wasm/licenses');
      mkdirSync(extra);
      writeFileSync(join(extra, 'NOTICES.txt'), 'notices');
    }
    return root;
  }
  it('copies licences and writes the index', () => {
    const root = project(true);
    expect(copyLicenses(root)).toBe(4);
    const index = JSON.parse(readFileSync(join(root, 'public/licenses/index.json'), 'utf8')) as {
      files: unknown[];
      appLicense: string;
    };
    expect(index.files).toHaveLength(4);
    expect(readFileSync(join(root, 'public/licenses/dep-LICENSE'), 'utf8')).toBe('dep licence');
    expect(readFileSync(join(root, 'public/licenses/sub-LICENSE.md'), 'utf8')).toBe('sub licence');
    expect(index.appLicense).toBe('app-LICENSE');
    expect(readFileSync(join(root, 'public/licenses/app-LICENSE'), 'utf8')).toBe('app licence');
  });
  it('fails loudly when a dependency has no licence file', () => {
    expect(() => copyLicenses(project(false))).toThrow('dep has no LICENSE');
  });
  it('fails when the engine package has no licenses folder', () => {
    expect(() => copyLicenses(project(true, false))).toThrow('no licenses folder');
  });
  it('fails when two files would get the same name', () => {
    const root = project(true);
    writeFileSync(join(root, 'node_modules/@sightread/lilypond-wasm/licenses/dep-LICENSE'), 'clash');
    expect(() => copyLicenses(root)).toThrow('same name'.replace('same name', 'would be copied to dep-LICENSE'));
  });
});
