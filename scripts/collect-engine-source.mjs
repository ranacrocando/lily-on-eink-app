// Builds lily-on-eink-engine-source-<engine version>.tar: the corresponding source (GPLv3 section 6(d)) of the
// LilyPond WebAssembly engine the app bundles. Runs in the release workflow, which uploads the tar to the app release.
//
//   node scripts/collect-engine-source.mjs <output folder>
//
// Downloads about 140 MB of public source archives and verifies every one of them against a pinned hash.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { create } from 'tar';

const ENGINE_PACKAGE = '@sightread/lilypond-wasm';
const APP_REPO = 'https://github.com/ranacrocando/lily-on-eink-app';
const CORE_REPO = 'https://github.com/ranacrocando/lily-on-eink';

/**
 * Archives that are linked into or packaged with the engine but are not listed in its build/sources.json.
 * `requires` names the sources.json entry they belong to: if the engine moves to another GLib or LilyPond, the
 * script stops so these pins are updated by hand.
 */
export const EXTRA_ARCHIVES = [
  {
    // From glib-2.82.5/subprojects/pcre2.wrap (source_url, source_hash). GLib's Meson build links it into the engine.
    folder: 'upstream',
    name: 'pcre2-10.42.tar.bz2',
    url: 'https://github.com/PhilipHazel/pcre2/releases/download/pcre2-10.42/pcre2-10.42.tar.bz2',
    sha256: '8d36cd8cb6ea2a4c2bb358ff6411b0c788633a2a45dabbf1aeb4b701d1b5e840',
    requires: 'glib-2.82.5.tar.xz',
  },
  {
    // From the same wrap file (patch_url, patch_hash): the Meson build files Meson lays over the PCRE2 sources.
    folder: 'upstream',
    name: 'pcre2_10.42-2_patch.zip',
    url: 'https://wrapdb.mesonbuild.com/v2/pcre2_10.42-2/get_patch',
    sha256: '350dc342b81a1611af43e5cc23f1b10453c7df51d5bb60ab9ee247daf03802bc',
    requires: 'glib-2.82.5.tar.xz',
  },
  {
    // The URW release LilyPond 2.26.0's binaries ship (lilypond-2.26.0/release/binaries/lib/fonts.py). This is a
    // tag archive GitHub generates: a hash mismatch most likely means GitHub regenerated it. Then check that its
    // fonts are still those of the tag and pin the new hash.
    folder: 'fonts',
    name: 'urw-base35-fonts-20200910.zip',
    url: 'https://github.com/ArtifexSoftware/urw-base35-fonts/archive/refs/tags/20200910.zip',
    sha256: '66eed7ca2dfbf44665aa34cb80559f4a90807d46858ccf76c34f9ac1701cfa27',
    requires: 'lilypond-2.26.0.tar.gz',
  },
  {
    // The TeX Gyre release LilyPond 2.26.0's binaries ship (same file).
    folder: 'fonts',
    name: 'tg2_501otf.zip',
    url: 'https://www.gust.org.pl/projects/e-foundry/tex-gyre/whole/tg2_501otf.zip',
    sha256: 'd7f8be5317bec4e644cf16c5abf876abeeb83c43dbec0ccb4eee4516b73b1bbe',
    requires: 'lilypond-2.26.0.tar.gz',
  },
];

/** Options for a tar that carries no local user names, ids or times. */
export const TAR_OPTIONS = { portable: true, mtime: new Date(0), noDirRecurse: true };

/** @param {Uint8Array} bytes */
export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Throws unless `bytes` has the SHA-256 `expected` (hex).
 * @param {string} name @param {Uint8Array} bytes @param {string} expected
 */
export function verifySha256(name, bytes, expected) {
  const actual = sha256(bytes);
  if (actual !== expected.toLowerCase())
    throw new Error(`SHA-256 mismatch for ${name}: expected ${expected}, got ${actual}`);
}

/**
 * Throws unless `bytes` matches the npm `integrity` (Subresource Integrity, e.g. "sha512-…").
 * @param {string} name @param {Uint8Array} bytes @param {string} integrity
 */
export function verifyIntegrity(name, bytes, integrity) {
  const match = /^(sha\d+)-(.+)$/.exec(integrity.trim());
  if (!match?.[1] || !match[2]) throw new Error(`unsupported integrity for ${name}: ${integrity}`);
  const actual = createHash(match[1]).update(bytes).digest('base64');
  if (actual !== match[2]) throw new Error(`integrity mismatch for ${name}: expected ${integrity}, got ${actual}`);
}

/**
 * The `integrity` of the engine package version in package-lock.json.
 * @param {{ packages?: Record<string, { version?: string, integrity?: string }> }} lock
 * @param {string} name @param {string} version
 */
export function lockedIntegrity(lock, name, version) {
  for (const [path, entry] of Object.entries(lock.packages ?? {}))
    if (path.endsWith(`node_modules/${name}`) && entry.version === version && entry.integrity) return entry.integrity;
  throw new Error(`package-lock.json has no integrity for ${name}@${version}`);
}

/**
 * Writes an uncompressed, portable tar of `files` (relative to `cwd`, in the given order) to `out`.
 * @param {string} cwd @param {string[]} files @param {string} out
 */
export function writePortableTar(cwd, files, out) {
  create({ ...TAR_OPTIONS, cwd, file: out, sync: true }, files);
}

/**
 * The README-SOURCE.txt of the bundle.
 * @param {{ engineVersion: string, packFile: string, integrity: string, appVersion: string, coreVersion: string,
 *   archives: { path: string, url: string, sha256: string }[] }} info
 */
export function readmeSource(info) {
  const list = info.archives.map((a) => `  ${a.path}\n    ${a.url}\n    SHA-256 ${a.sha256}`).join('\n');
  const title = `Corresponding source of the LilyPond engine in lily-on-eink ${info.appVersion}`;
  return `${title}
${'='.repeat(title.length)}

The lily-on-eink web app (${APP_REPO}) runs LilyPond in the
browser through the WebAssembly build ${ENGINE_PACKAGE} ${info.engineVersion}: LilyPond 2.26.0,
Guile and the libraries they link, compiled with Emscripten. That build is GPL-licensed object
code. This archive is its corresponding source under section 6(d) of the GNU General Public
License, version 3.

Contents

  ${info.packFile}
    The engine package exactly as published on npm (integrity ${info.integrity}).
    Next to the compiled engine (dist/) it holds the build: build/ (build.sh and its helper
    scripts, patches/, stubs/, sources.json, fetch-sources.mjs), DEVELOPMENT.md, and the
    licence texts and third-party notices in licenses/.

${list}

  upstream/ holds every archive listed in build/sources.json, plus PCRE2 and its Meson wrap
  patch, which GLib's Meson subproject downloads during the build
  (glib-2.82.5/subprojects/pcre2.wrap). fonts/ holds the upstream releases of the URW Base35
  and TeX Gyre fonts that LilyPond 2.26.0 ships; Emmentaler is built from the LilyPond archive.
  GLib's other fallback wrap, proxy-libintl, is not used: Emscripten's libc provides gettext
  (lilypond.wasm calls libc's dcngettext and contains none of proxy-libintl's g_libintl_*
  functions).

How to rebuild

  1. Unpack ${info.packFile} and follow package/DEVELOPMENT.md. Host tools:
     Emscripten, meson, ninja, cmake, autoconf, pkg-config, python3, bison, flex, bun,
     guile 3.0.11 and a native LilyPond 2.26.0 install.
  2. Copy the files of upstream/ into package/work/src/ and run build/fetch-sources.mjs; it
     verifies and unpacks files that are already there instead of downloading them. For an
     offline GLib build, then copy the two PCRE2 files into
     work/src/glib-2.82.5/subprojects/packagecache/.
  3. ./build/build.sh builds every step and writes dist/. Its "data" step copies LilyPond's data
     directory (Scheme, .ly files, PostScript and fonts) from the native LilyPond 2.26.0 install;
     the native install is built from the same lilypond-2.26.0 archive and the font releases in
     fonts/.

The Emscripten version is not recorded in the build; DEVELOPMENT.md installs Emscripten with
Homebrew. The toolchain is a general-purpose tool and not part of the corresponding source.

The source of the app itself, and of the core library with the engine adapter
(@lily-on-eink/engine-wasm) the app bundles:
  ${APP_REPO}/tree/v${info.appVersion}
  ${CORE_REPO}/tree/v${info.coreVersion}
`;
}

/** @param {string} url */
async function download(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= 3)
        throw new Error(`${url}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      console.log(`retrying ${url}`);
    }
  }
}

/** @param {string} path */
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/**
 * @param {string} root the app folder (with node_modules and package-lock.json)
 * @param {string} outDir
 * @returns {Promise<string>} the path of the tar
 */
export async function collectEngineSource(root, outDir) {
  const engineDir = join(root, 'node_modules', ...ENGINE_PACKAGE.split('/'));
  const engineVersion = String(readJson(join(engineDir, 'package.json')).version);
  const appVersion = String(readJson(join(root, 'package.json')).version);
  const coreVersion = String(readJson(join(root, 'node_modules', '@lily-on-eink', 'core', 'package.json')).version);
  /** @type {[string, string, string][]} */
  const sources = readJson(join(engineDir, 'build', 'sources.json'));
  const integrity = lockedIntegrity(readJson(join(root, 'package-lock.json')), ENGINE_PACKAGE, engineVersion);

  const top = `lily-on-eink-engine-source-${engineVersion}`;
  const stage = join(outDir, top);
  const tarPath = join(outDir, `${top}.tar`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(engineVersion)) throw new Error(`unexpected engine version ${engineVersion}`);
  const command = `npm pack ${ENGINE_PACKAGE}@${engineVersion} --json --ignore-scripts --pack-destination .`;
  console.log(command);
  // A shell command (checked version, fixed text), so that npm also starts on Windows for a local test run.
  const packed = JSON.parse(execSync(command, { cwd: stage, encoding: 'utf8' }));
  const packFile = String(packed[0].filename);
  verifyIntegrity(packFile, readFileSync(join(stage, packFile)), integrity);

  const names = new Set(sources.map(([name]) => name));
  const archives = [
    ...sources.map(([name, url, hash]) => ({ folder: 'upstream', name, url, sha256: hash })),
    ...EXTRA_ARCHIVES.map((extra) => {
      if (!names.has(extra.requires))
        throw new Error(`${extra.name} belongs to ${extra.requires}, which the engine no longer builds; update it`);
      return extra;
    }),
  ];
  for (const archive of archives) {
    console.log(`downloading ${archive.url}`);
    const bytes = await download(archive.url);
    verifySha256(archive.name, bytes, archive.sha256);
    mkdirSync(join(stage, archive.folder), { recursive: true });
    writeFileSync(join(stage, archive.folder, archive.name), bytes);
  }

  writeFileSync(
    join(stage, 'README-SOURCE.txt'),
    readmeSource({
      engineVersion,
      packFile,
      integrity,
      appVersion,
      coreVersion,
      archives: archives.map((a) => ({ path: `${a.folder}/${a.name}`, url: a.url, sha256: a.sha256 })),
    }),
  );

  const files = walk(stage)
    .map((f) => relative(outDir, f).replaceAll('\\', '/'))
    .sort();
  writePortableTar(outDir, files, tarPath);
  rmSync(stage, { recursive: true, force: true });
  return tarPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('usage: node scripts/collect-engine-source.mjs <output folder>');
    process.exit(2);
  }
  try {
    const tar = await collectEngineSource(process.cwd(), resolve(outDir));
    console.log(`collect-engine-source: ${tar} (${(statSync(tar).size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (error) {
    console.error(`collect-engine-source: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
