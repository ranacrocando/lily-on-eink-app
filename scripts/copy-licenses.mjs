// Copies the licence texts of the bundled software into public/licenses/ and writes an index for the about page.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ENGINE_PACKAGE = '@sightread/lilypond-wasm';
/** The LilyPond release inside the engine package (the package version is not the LilyPond version). */
const LILYPOND_VERSION = '2.26';
const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING', 'COPYING.md', 'COPYING.txt'];

/**
 * The licence file in a package folder, or undefined.
 * @param {string[]} fileNames
 */
export function pickLicenseFile(fileNames) {
  for (const wanted of LICENSE_NAMES) {
    const found = fileNames.find((f) => f.toLowerCase() === wanted.toLowerCase());
    if (found) return found;
  }
  return undefined;
}

/**
 * "@scope/name" + "LICENSE.md" becomes "scope-name-LICENSE.md".
 * @param {string} packageName
 * @param {string} file
 */
export function outputName(packageName, file) {
  return `${packageName.replace(/^@/, '').replaceAll('/', '-')}-${file}`;
}

/**
 * The packages whose licence files are shipped: every runtime dependency plus the engine package, without duplicates.
 * @param {Record<string, string> | undefined} dependencies
 */
export function packagesToCopy(dependencies) {
  return [...new Set([...Object.keys(dependencies ?? {}), ENGINE_PACKAGE])];
}

/**
 * @param {{ file: string, package: string, license: string }[]} files
 * @param {string} engineVersion
 */
export function buildIndex(files, engineVersion) {
  return {
    engine: { package: ENGINE_PACKAGE, version: engineVersion, lilypond: LILYPOND_VERSION },
    files: [...files].sort((a, b) => a.package.localeCompare(b.package) || a.file.localeCompare(b.file)),
  };
}

/**
 * The licence of a package.json object as text; fails if there is none.
 * @param {string} name
 * @param {{ license?: unknown }} pkg
 */
export function licenseOf(name, pkg) {
  const license = pkg.license;
  if (typeof license !== 'string' || license.trim() === '') throw new Error(`${name} declares no license`);
  return license;
}

/** @param {string} root project folder */
export function copyLicenses(root) {
  const modules = join(root, 'node_modules');
  const out = join(root, 'public', 'licenses');
  const own = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const files = [];
  let engineVersion = '';

  for (const name of packagesToCopy(own.dependencies)) {
    const dir = join(modules, ...name.split('/'));
    if (!existsSync(join(dir, 'package.json'))) throw new Error(`${name} is not installed in node_modules`);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const license = licenseOf(name, pkg);
    if (name === ENGINE_PACKAGE) engineVersion = String(pkg.version);
    const licenseFile = pickLicenseFile(readdirSync(dir));
    if (!licenseFile) throw new Error(`${name} has no LICENSE, LICENSE.md or COPYING file`);
    const target = outputName(name, licenseFile);
    copyFileSync(join(dir, licenseFile), join(out, target));
    files.push({ file: target, package: name, license });

    if (name === ENGINE_PACKAGE) {
      const extra = join(dir, 'licenses');
      if (!existsSync(extra)) throw new Error(`${name} has no licenses folder`);
      for (const f of readdirSync(extra)) {
        copyFileSync(join(extra, f), join(out, f));
        files.push({ file: f, package: name, license });
      }
    }
  }
  writeFileSync(join(out, 'index.json'), `${JSON.stringify(buildIndex(files, engineVersion), null, 2)}\n`);
  return files.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(`copy-licenses: ${String(copyLicenses(process.cwd()))} files in public/licenses`);
  } catch (error) {
    console.error(`copy-licenses: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
