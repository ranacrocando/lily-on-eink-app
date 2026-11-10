import { safeFileName } from '@lily-on-eink/core';
import { zipSync, type Zippable } from 'fflate';

export interface NamedFile {
  name: string;
  bytes: Uint8Array;
}

/** Makes names unique: a repeated `a.pdf` becomes `a (2).pdf`, then `a (3).pdf`. Comparison ignores case. */
export function dedupeNames(names: string[]): string[] {
  const taken = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${stem} (${String(n)})${extension}`;
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}

/** A ZIP without compression (PDFs are compressed already). Names must be unique. */
export function zipFiles(files: NamedFile[]): Uint8Array {
  const entries: Zippable = {};
  for (const { name, bytes } of files) entries[name] = [bytes, { level: 0 }];
  return zipSync(entries);
}

/** File name of the ZIP for a device, safe for FAT32 drives. */
export function zipFileName(deviceName: string): string {
  return `${safeFileName(`lily-on-eink – ${deviceName}`)}.zip`;
}

/** Saves bytes as a file through the browser's download. */
export function downloadBlob(name: string, bytes: Uint8Array, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
