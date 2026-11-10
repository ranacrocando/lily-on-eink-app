import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { dedupeNames, zipFileName, zipFiles } from './download';

describe('dedupeNames', () => {
  it('keeps unique names', () => {
    expect(dedupeNames(['a.pdf', 'b.pdf'])).toEqual(['a.pdf', 'b.pdf']);
  });

  it('numbers repeated names', () => {
    expect(dedupeNames(['a.pdf', 'a.pdf', 'a.pdf'])).toEqual(['a.pdf', 'a (2).pdf', 'a (3).pdf']);
  });

  it('does not collide with a name that already has a number', () => {
    expect(dedupeNames(['a.pdf', 'a (2).pdf', 'a.pdf'])).toEqual(['a.pdf', 'a (2).pdf', 'a (3).pdf']);
  });

  it('ignores case, as FAT32 does', () => {
    expect(dedupeNames(['A.pdf', 'a.pdf'])).toEqual(['A.pdf', 'a (2).pdf']);
  });
});

describe('zipFiles', () => {
  it('contains the files under their names, uncompressed', () => {
    const one = new Uint8Array([1, 2, 3]);
    const two = new Uint8Array([4, 5]);
    const zip = zipFiles([
      { name: 'Étude – Kobo.pdf', bytes: one },
      { name: 'b.pdf', bytes: two },
    ]);
    const unpacked = unzipSync(zip);
    expect(Object.keys(unpacked)).toEqual(['Étude – Kobo.pdf', 'b.pdf']);
    expect(unpacked['b.pdf']).toEqual(two);
    expect(zip.length).toBeGreaterThan(one.length + two.length);
  });
});

describe('zipFileName', () => {
  it('names the ZIP after the device and keeps it FAT32-safe', () => {
    expect(zipFileName('Kobo Sage (2021)')).toBe('lily-on-eink – Kobo Sage (2021).zip');
    expect(zipFileName('a:b?c')).not.toMatch(/[:?]/);
  });
});
