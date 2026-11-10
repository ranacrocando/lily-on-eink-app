export interface LicenseEntry {
  file: string;
  package: string;
  license: string;
}

export interface LicenseIndex {
  engine: { package: string; version: string; lilypond: string };
  files: LicenseEntry[];
}

/** Checks the shape of the downloaded `licenses/index.json`; throws if it is not what the build writes. */
export function parseIndex(data: unknown): LicenseIndex {
  const bad = () => new Error('The licence list has an unexpected format.');
  if (typeof data !== 'object' || data === null) throw bad();
  const { engine, files } = data as { engine?: Record<string, unknown>; files?: unknown };
  if (!engine || typeof engine.package !== 'string' || typeof engine.version !== 'string') throw bad();
  if (typeof engine.lilypond !== 'string' || !Array.isArray(files)) throw bad();
  const entries = (files as unknown[]).map((f) => {
    const e = f as Partial<LicenseEntry> | null;
    if (typeof e?.file !== 'string' || typeof e.package !== 'string' || typeof e.license !== 'string') throw bad();
    return { file: e.file, package: e.package, license: e.license };
  });
  return { engine: { package: engine.package, version: engine.version, lilypond: engine.lilypond }, files: entries };
}

/** "LilyPond 2.26 via @sightread/lilypond-wasm 0.2.0" */
export function engineText(index: LicenseIndex): string {
  const { lilypond, package: name, version } = index.engine;
  return `LilyPond ${lilypond} via ${name} ${version}`;
}

/** Fills the list with one link per licence file; `base` is the folder that holds the files. */
export function renderLicenseList(list: HTMLElement, index: LicenseIndex, base: string): void {
  list.replaceChildren(
    ...index.files.map((entry) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `${base}${encodeURIComponent(entry.file)}`;
      a.textContent = entry.file;
      li.append(a, ` – ${entry.package} (${entry.license})`);
      return li;
    }),
  );
}
