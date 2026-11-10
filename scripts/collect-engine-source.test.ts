import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXTRA_ARCHIVES,
  lockedIntegrity,
  readProducers,
  readmeSource,
  sha256,
  toolchainText,
  verifyIntegrity,
  verifySha256,
  writePortableTar,
} from './collect-engine-source.mjs';

const enc = new TextEncoder();
const bytes = enc.encode('hello');
const helloSha256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

describe('hash checks', () => {
  it('accepts the right SHA-256 and rejects a wrong one', () => {
    expect(sha256(bytes)).toBe(helloSha256);
    expect(() => {
      verifySha256('a.tar.gz', bytes, helloSha256.toUpperCase());
    }).not.toThrow();
    expect(() => {
      verifySha256('a.tar.gz', bytes, '0'.repeat(64));
    }).toThrow(/SHA-256 mismatch for a\.tar\.gz/);
  });
  it('checks npm integrity strings', () => {
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    expect(() => {
      verifyIntegrity('p.tgz', bytes, integrity);
    }).not.toThrow();
    expect(() => {
      verifyIntegrity('p.tgz', enc.encode('hellO'), integrity);
    }).toThrow(/integrity mismatch/);
    expect(() => {
      verifyIntegrity('p.tgz', bytes, 'nonsense');
    }).toThrow(/unsupported integrity/);
  });
  it('finds the locked integrity of the engine version', () => {
    const lock = {
      packages: {
        '': {},
        'node_modules/@sightread/lilypond-wasm': { version: '0.2.0', integrity: 'sha512-x' },
      },
    };
    expect(lockedIntegrity(lock, '@sightread/lilypond-wasm', '0.2.0')).toBe('sha512-x');
    expect(() => lockedIntegrity(lock, '@sightread/lilypond-wasm', '0.3.0')).toThrow(/no integrity/);
  });
  it('pins every extra archive with a SHA-256', () => {
    for (const extra of EXTRA_ARCHIVES) expect(extra.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

const str = (s: string) => [enc.encode(s).length, ...enc.encode(s)];

/** A WebAssembly module with an empty type section and the given custom sections. */
function wasm(custom: Record<string, number[]>): Uint8Array {
  const out = [0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 1, 1, 0];
  for (const [name, body] of Object.entries(custom)) {
    const content = [...str(name), ...body];
    out.push(0, content.length, ...content);
  }
  return new Uint8Array(out);
}

describe('readProducers', () => {
  it('reads the producers section', () => {
    const body = [1, ...str('processed-by'), 1, ...str('clang'), ...str('21.0.0')];
    const producers = readProducers(wasm({ name: [0], producers: body }));
    expect(producers).toEqual({ 'processed-by': [['clang', '21.0.0']] });
    expect(toolchainText(producers)).toBe('clang 21.0.0');
  });
  it('returns nothing for a module without it', () => {
    expect(readProducers(wasm({ name: [0] }))).toEqual({});
    expect(toolchainText({})).toMatch(/no producers section/);
  });
  it('rejects other files', () => {
    expect(() => readProducers(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/not a WebAssembly module/);
  });
});

describe('writePortableTar', () => {
  it('writes no local owner, ids or times, in the given order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'engine-source-'));
    mkdirSync(join(dir, 'top', 'upstream'), { recursive: true });
    writeFileSync(join(dir, 'top', 'README-SOURCE.txt'), 'read me\n');
    writeFileSync(join(dir, 'top', 'upstream', 'a.tar.gz'), 'archive');
    const files = ['top/upstream/a.tar.gz', 'top/README-SOURCE.txt'];
    const out = join(dir, 'out.tar');
    writePortableTar(dir, files, out);

    const tar = readFileSync(out);
    const text = (offset: number, length: number) =>
      tar
        .subarray(offset, offset + length)
        .toString('latin1')
        .replace(/\0.*$/s, '');
    const octal = (offset: number, length: number) => parseInt(text(offset, length).trim() || '0', 8);
    const names: string[] = [];
    for (let pos = 0; pos + 512 <= tar.length && tar[pos] !== 0;) {
      names.push(text(pos, 100));
      expect(octal(pos + 108, 8)).toBe(0); // uid
      expect(octal(pos + 116, 8)).toBe(0); // gid
      expect(octal(pos + 136, 12)).toBe(0); // mtime
      expect(text(pos + 156, 1)).toBe('0'); // a regular file, no extended header (atime, ctime)
      expect(text(pos + 265, 32)).toBe(''); // uname
      expect(text(pos + 297, 32)).toBe(''); // gname
      pos += 512 + Math.ceil(octal(pos + 124, 12) / 512) * 512;
    }
    expect(names).toEqual(files);
    expect(tar.length % 512).toBe(0);
  });
});

describe('readmeSource', () => {
  it('names the archives, the toolchain and the exact source trees', () => {
    const text = readmeSource({
      engineVersion: '0.2.0',
      packFile: 'sightread-lilypond-wasm-0.2.0.tgz',
      integrity: 'sha512-x',
      appVersion: '0.1.0',
      coreVersion: '0.1.0',
      toolchain: 'clang 21.0.0',
      archives: [{ path: 'upstream/a.tar.gz', url: 'https://example.org/a.tar.gz', sha256: helloSha256 }],
    });
    expect(text).toContain(`upstream/a.tar.gz\n    https://example.org/a.tar.gz\n    SHA-256 ${helloSha256}`);
    expect(text).toContain('clang 21.0.0');
    expect(text).toContain('https://github.com/ranacrocando/lily-on-eink-app/tree/v0.1.0');
    expect(text).toContain('https://github.com/ranacrocando/lily-on-eink/tree/v0.1.0');
  });
});
