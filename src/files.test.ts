// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { fromDataTransfer, fromFileList, MAX_FILE_BYTES, normalizePath } from './files';

function file(name: string, text = 'x', relativePath = ''): File {
  const f = new File([text], name);
  if (relativePath) Object.defineProperty(f, 'webkitRelativePath', { value: relativePath });
  return f;
}

describe('normalizePath', () => {
  it('uses POSIX separators and drops leading slashes and dots', () => {
    expect(normalizePath('/songs\\a.ly')).toBe('songs/a.ly');
    expect(normalizePath('./a//b.ly')).toBe('a/b.ly');
  });
});

describe('fromFileList', () => {
  it('prefers the relative path and keeps the top-level folder', async () => {
    const p = await fromFileList([file('a.ly', 'one', 'book/a.ly'), file('b.ily', 'two', 'book/lib/b.ily')]);
    expect(p.files.map((f) => f.path)).toEqual(['book/a.ly', 'book/lib/b.ily']);
    expect(p.texts).toEqual({ 'book/a.ly': 'one', 'book/lib/b.ily': 'two' });
  });

  it('falls back to the file name', async () => {
    const p = await fromFileList([file('song.LY')]);
    expect(p.files.map((f) => f.path)).toEqual(['song.LY']);
  });

  it('keeps only LilyPond files and skips hidden ones', async () => {
    const p = await fromFileList([
      file('a.ly'),
      file('notes.txt'),
      file('.hidden.ly'),
      file('c.ly', 'x', 'proj/.git/c.ly'),
      file('score.pdf'),
    ]);
    expect(Object.keys(p.texts)).toEqual(['a.ly']);
    expect(p.skipped).toEqual([]);
  });

  it('reports files over 2 MB', async () => {
    const big = file('big.ly', 'x'.repeat(MAX_FILE_BYTES + 1));
    const p = await fromFileList([big, file('ok.ly')]);
    expect(p.skipped).toEqual(['big.ly']);
    expect(Object.keys(p.texts)).toEqual(['ok.ly']);
  });

  it('lists files that are not valid UTF-8 and still decodes them', async () => {
    const latin1 = new File([new Uint8Array([0x63, 0xfc, 0x72])], 'old.ly');
    const p = await fromFileList([latin1, file('ok.ly', 'Für')]);
    expect(p.notUtf8).toEqual(['old.ly']);
    expect(p.texts['old.ly']).toBe('c�r');
    expect(p.texts['ok.ly']).toBe('Für');
  });

  it('decodes UTF-8', async () => {
    const p = await fromFileList([file('a.ly', 'Für Elise')]);
    expect(p.texts['a.ly']).toBe('Für Elise');
  });
});

type Entry = FileSystemEntry;
function fileEntry(name: string, path: string, text = 'x'): Entry {
  return {
    isFile: true,
    isDirectory: false,
    name,
    fullPath: path,
    file: (ok: (f: File) => void) => {
      ok(file(name, text));
    },
  } as unknown as Entry;
}
function dirEntry(name: string, path: string, batches: Entry[][]): Entry {
  return {
    isFile: false,
    isDirectory: true,
    name,
    fullPath: path,
    createReader: () => {
      const queue = [...batches];
      return {
        readEntries: (ok: (e: Entry[]) => void) => {
          ok(queue.shift() ?? []);
        },
      };
    },
  } as unknown as Entry;
}
function transfer(entries: Entry[]): DataTransfer {
  return {
    items: entries.map((e) => ({ kind: 'file', webkitGetAsEntry: () => e })),
    files: [],
  } as unknown as DataTransfer;
}

describe('fromDataTransfer', () => {
  it('walks folders and reads every batch', async () => {
    const tree = dirEntry('book', '/book', [
      [fileEntry('a.ly', '/book/a.ly', 'A'), dirEntry('lib', '/book/lib', [[fileEntry('b.ily', '/book/lib/b.ily')]])],
      [fileEntry('c.ly', '/book/c.ly'), fileEntry('readme.md', '/book/readme.md'), fileEntry('.x.ly', '/book/.x.ly')],
    ]);
    const p = await fromDataTransfer(transfer([tree]));
    expect(p.files.map((f) => f.path).sort()).toEqual(['book/a.ly', 'book/c.ly', 'book/lib/b.ily']);
    expect(p.texts['book/a.ly']).toBe('A');
  });

  it('handles files and a folder dropped together and does not read other files', async () => {
    let readOther = false;
    const other = fileEntry('photo.jpg', '/photo.jpg');
    (other as unknown as { file: () => void }).file = () => {
      readOther = true;
    };
    const dir = dirEntry('p', '/p', [[fileEntry('a.ly', '/p/a.ly'), other]]);
    const p = await fromDataTransfer(transfer([fileEntry('single.ly', '/single.ly'), dir, other]));
    expect(p.files.map((f) => f.path).sort()).toEqual(['p/a.ly', 'single.ly']);
    expect(readOther).toBe(false);
  });

  it('handles a single dropped file', async () => {
    const p = await fromDataTransfer(transfer([fileEntry('a.ly', '/a.ly')]));
    expect(Object.keys(p.texts)).toEqual(['a.ly']);
  });

  it('skips hidden folders', async () => {
    const tree = dirEntry('p', '/p', [[dirEntry('.git', '/p/.git', [[fileEntry('x.ly', '/p/.git/x.ly')]])]]);
    const p = await fromDataTransfer(transfer([tree]));
    expect(p.files).toEqual([]);
  });
});
