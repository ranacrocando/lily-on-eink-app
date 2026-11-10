// Copies the licence texts of the bundled software into public/licenses/ and writes an index for the about page.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ENGINE_PACKAGE = '@sightread/lilypond-wasm';
/**
 * The LilyPond release inside the engine package. The package version is not the LilyPond version, so this
 * constant must be updated together with every bump of @sightread/lilypond-wasm.
 */
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
 * The packages whose licence files are shipped: every runtime dependency, their runtime dependencies (recursively)
 * and the engine package, without duplicates. `readDependencies` returns the `dependencies` of an installed package.
 * @param {Record<string, string> | undefined} dependencies
 * @param {(name: string) => Record<string, string> | undefined} [readDependencies]
 */
export function packagesToCopy(dependencies, readDependencies = () => undefined) {
  /** @type {Set<string>} */
  const seen = new Set();
  const queue = [...Object.keys(dependencies ?? {}), ENGINE_PACKAGE];
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    if (seen.has(name)) continue;
    seen.add(name);
    queue.push(...Object.keys(readDependencies(name) ?? {}));
  }
  return [...seen];
}

/**
 * @param {{ file: string, package: string, license: string }[]} files
 * @param {string} engineVersion
 * @param {string} appLicense file name of the app's own licence
 */
export function buildIndex(files, engineVersion, appLicense) {
  return {
    appLicense,
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

  /** @param {string} name */
  const readPackage = (name) => {
    const file = join(modules, ...name.split('/'), 'package.json');
    if (!existsSync(file)) throw new Error(`${name} is not installed in node_modules`);
    return JSON.parse(readFileSync(file, 'utf8'));
  };
  const taken = new Set();
  /** @param {string} target */
  const claim = (target) => {
    if (taken.has(target.toLowerCase())) throw new Error(`two licence files would be copied to ${target}`);
    taken.add(target.toLowerCase());
  };

  const ownLicense = pickLicenseFile(readdirSync(root));
  if (!ownLicense) throw new Error('the app has no LICENSE file');
  const appFile = outputName(String(own.name), ownLicense);
  claim(appFile);
  copyFileSync(join(root, ownLicense), join(out, appFile));

  for (const name of packagesToCopy(own.dependencies, (n) => readPackage(n).dependencies)) {
    const dir = join(modules, ...name.split('/'));
    const pkg = readPackage(name);
    const license = licenseOf(name, pkg);
    if (name === ENGINE_PACKAGE) engineVersion = String(pkg.version);
    const licenseFile = pickLicenseFile(readdirSync(dir));
    if (!licenseFile) throw new Error(`${name} has no LICENSE, LICENSE.md or COPYING file`);
    const target = outputName(name, licenseFile);
    claim(target);
    copyFileSync(join(dir, licenseFile), join(out, target));
    files.push({ file: target, package: name, license });

    if (name === ENGINE_PACKAGE) {
      const extra = join(dir, 'licenses');
      if (!existsSync(extra)) throw new Error(`${name} has no licenses folder`);
      for (const f of readdirSync(extra)) {
        claim(f);
        copyFileSync(join(extra, f), join(out, f));
        files.push({ file: f, package: name, license });
      }
    }
  }
  writeFileSync(join(out, 'index.json'), `${JSON.stringify(buildIndex(files, engineVersion, appFile), null, 2)}\n`);
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
