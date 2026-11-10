// Sanity check of the production build: the engine assets must be present exactly once.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MB = 1024 * 1024;

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/**
 * @param {{ name: string, size: number }[]} files files of dist/assets
 * @param {number} totalBytes size of all of dist
 * @returns {string[]} problems
 */
export function checkBuild(files, totalBytes) {
  const problems = [];
  const has = (/** @type {RegExp} */ re) => files.some((f) => re.test(f.name));
  if (!has(/^lilypond-.*\.wasm$/)) problems.push('missing lilypond-*.wasm');
  if (!has(/^runtime\.data-.*\.bin$/)) problems.push('missing runtime.data-*.bin');
  if (!has(/^lilypond-.*\.mjs$/)) problems.push('missing lilypond-*.mjs');
  if (!has(/worker.*\.m?js$/i)) problems.push('missing worker chunk');
  const bigWasm = files.filter((f) => f.name.endsWith('.wasm') && f.size > 10 * MB);
  if (bigWasm.length !== 1) problems.push(`expected exactly one .wasm above 10 MB, found ${bigWasm.length}`);
  if (totalBytes >= 40 * MB) problems.push(`dist is ${(totalBytes / MB).toFixed(1)} MB, the limit is 40 MB`);
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const all = walk('dist');
  const total = all.reduce((sum, f) => sum + statSync(f).size, 0);
  const assets = all
    .filter((f) => f.replaceAll('\\', '/').startsWith('dist/assets/'))
    .map((f) => ({ name: f.split(/[\\/]/).pop() ?? f, size: statSync(f).size }));
  const problems = checkBuild(assets, total);
  if (problems.length) {
    console.error(problems.map((p) => `check-build: ${p}`).join('\n'));
    console.error('dist/assets:', assets.map((a) => `${a.name} (${a.size})`).join(', '));
    process.exit(1);
  }
  console.log(`check-build: ok (${assets.length} assets, ${(total / MB).toFixed(1)} MB)`);
}
