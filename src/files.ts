import type { ProjectFile } from '@lily-on-eink/core';

/** Files above this size are skipped (a LilyPond source is never this large). */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** The sources found in a drop or a file picker. */
export interface LoadedProject {
  /** Bytes for `convert()`. */
  files: ProjectFile[];
  /** The same sources decoded as UTF-8, for `analyzeProject()`. */
  texts: Record<string, string>;
  /** Paths of LilyPond files that were left out because they are too large. */
  skipped: string[];
}

interface Candidate {
  path: string;
  file: File;
}

/** POSIX path without leading slashes and `./` parts. */
export function normalizePath(path: string): string {
  return path
    .replaceAll('\\', '/')
    .split('/')
    .filter((part) => part !== '' && part !== '.')
    .join('/');
}

const isSource = (path: string) => /\.(ly|ily)$/i.test(path);
const isHidden = (path: string) => path.split('/').some((part) => part.startsWith('.'));

/**
 * Keeps `.ly` and `.ily` files outside hidden folders, drops files over 2 MB (and reports them), and reads the rest.
 * Paths keep their top-level folder: includes are relative, so nothing has to be stripped.
 */
async function load(candidates: Candidate[]): Promise<LoadedProject> {
  const result: LoadedProject = { files: [], texts: {}, skipped: [] };
  const seen = new Set<string>();
  for (const { path: raw, file } of candidates) {
    const path = normalizePath(raw);
    if (!path || !isSource(path) || isHidden(path) || seen.has(path)) continue;
    seen.add(path);
    if (file.size > MAX_FILE_BYTES) {
      result.skipped.push(path);
      continue;
    }
    const content = new Uint8Array(await file.arrayBuffer());
    result.files.push({ path, content });
    result.texts[path] = new TextDecoder().decode(content);
  }
  return result;
}

/** Files from `<input type="file">`; a folder pick provides `webkitRelativePath`. */
export function fromFileList(files: FileList | File[]): Promise<LoadedProject> {
  return load(Array.from(files, (file) => ({ path: file.webkitRelativePath || file.name, file })));
}

const readFile = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
const readBatch = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });

/** `readEntries` returns at most one batch (about 100 entries) per call; call it until it returns nothing. */
async function walk(entry: FileSystemEntry, out: Candidate[]): Promise<void> {
  if (entry.name.startsWith('.')) return;
  if (entry.isFile) {
    out.push({ path: entry.fullPath, file: await readFile(entry as FileSystemFileEntry) });
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (let batch = await readBatch(reader); batch.length > 0; batch = await readBatch(reader)) {
      for (const child of batch) await walk(child, out);
    }
  }
}

/** Files and folders from a drop. Folders are walked recursively. */
export async function fromDataTransfer(dt: DataTransfer): Promise<LoadedProject> {
  // The entries must be taken synchronously: the items are cleared once the event handler returns.
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry();
    if (entry) entries.push(entry);
  }
  if (entries.length === 0) return fromFileList(dt.files);
  const candidates: Candidate[] = [];
  for (const entry of entries) await walk(entry, candidates);
  return load(candidates);
}
