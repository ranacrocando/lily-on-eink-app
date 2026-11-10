import { expect, test } from '@playwright/test';
import { analyzeProject, convert } from '@lily-on-eink/core';
import { createWasmEngine } from '@lily-on-eink/engine-wasm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';

interface Hook {
  convertPng: (files: { path: string; text: string }[], d: string, p: string) => Promise<string>;
}
const MAX_DIFF_FRACTION = 0.0001; // 0.01 %
const DEVICE = 'kobo-sage';
const PROFILE = 'generic';

test.setTimeout(180_000);

test('browser and Node produce the same first page PNG', async ({ page }) => {
  const path = 'bass-etude-e-minor.ly';
  const text = await readFile(join(import.meta.dirname, '..', 'fixtures', 'bass-etude-e-minor', path), 'utf8');

  await page.goto('./?test');
  await expect(page.locator('#engine-text')).toHaveText(/^Ready – LilyPond/, { timeout: 120_000 });
  await page.waitForFunction(() => '__lilyOnEink' in window);
  const base64 = await page.evaluate(
    ([t, p, d, pr]) => {
      const hook = (window as unknown as { __lilyOnEink: Hook }).__lilyOnEink;
      return hook.convertPng([{ path: p, text: t }], d, pr);
    },
    [text, path, DEVICE, PROFILE] as const,
  );
  const browserPng = PNG.sync.read(Buffer.from(base64, 'base64'));

  const engine = createWasmEngine();
  let nodePng: PNG;
  try {
    const result = await convert(
      [{ path, content: new TextEncoder().encode(text) }],
      {
        device: DEVICE,
        profile: PROFILE,
        mainFiles: analyzeProject({ [path]: text }).mainFiles,
        outputs: ['png'],
      },
      engine,
    );
    const bytes = result.outputs[0]?.pngPages?.[0];
    if (!bytes) throw new Error('Node conversion produced no PNG');
    nodePng = PNG.sync.read(Buffer.from(bytes));
  } finally {
    engine.dispose();
  }

  expect([browserPng.width, browserPng.height]).toEqual([nodePng.width, nodePng.height]);
  const total = browserPng.width * browserPng.height;
  let differing = 0;
  for (let i = 0; i < total * 4; i += 4) {
    if (
      browserPng.data[i] !== nodePng.data[i] ||
      browserPng.data[i + 1] !== nodePng.data[i + 1] ||
      browserPng.data[i + 2] !== nodePng.data[i + 2] ||
      browserPng.data[i + 3] !== nodePng.data[i + 3]
    )
      differing++;
  }
  console.log(`parity: ${String(differing)} of ${String(total)} pixels differ`);
  expect(differing / total).toBeLessThanOrEqual(MAX_DIFF_FRACTION);
});
