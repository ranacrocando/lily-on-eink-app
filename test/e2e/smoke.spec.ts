import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const fixtures = join(import.meta.dirname, '..', 'fixtures');
const LONG = { timeout: 120_000 };

test.setTimeout(180_000);

async function openReady(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('#engine-text')).toHaveText(/^Ready – LilyPond/, LONG);
}

test('converts, downloads and previews a single file', async ({ page }) => {
  await openReady(page);
  await page.locator('#file-input').setInputFiles(join(fixtures, 'bass-etude-e-minor', 'bass-etude-e-minor.ly'));
  await expect(page.locator('#project-summary')).toContainText('1 LilyPond file added.');
  await page.locator('#device').selectOption('kobo-sage');
  await page.locator('#convert').click();

  const rows = page.locator('#results ul.results li');
  await expect(rows).toHaveCount(1, LONG);
  await expect(rows.locator('.file-name')).toHaveText(/^Etüde in E-Moll – .*\.pdf$/, LONG);
  const name = (await rows.locator('.file-name').textContent()) ?? '';

  const downloadPromise = page.waitForEvent('download');
  await rows.getByRole('button', { name: /^Download / }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(name);
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');

  await rows.getByRole('button', { name: /^Preview / }).click();
  const canvas = page.locator('#preview-canvas');
  await expect(canvas).toBeVisible(LONG);
  // Kobo Sage: 1440 × 1920 px (packages/core presets).
  await expect(canvas).toHaveJSProperty('width', 1440, LONG);
  await expect(canvas).toHaveJSProperty('height', 1920);
});

test('the about page links to licence files that exist', async ({ page, request }) => {
  await page.goto('about.html');
  const links = page.locator('#licence-list a');
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs.length).toBeGreaterThan(0);
  const appLicense = await page.locator('#app-license').evaluate((a) => (a as HTMLAnchorElement).href);
  for (const href of [appLicense, ...hrefs]) {
    if (!href.startsWith('http://localhost')) continue;
    expect((await request.get(href)).status(), href).toBe(200);
  }
});

test('converts a folder with an include', async ({ page }) => {
  await openReady(page);
  await page.locator('#folder-input').setInputFiles(join(fixtures, 'folder-project'));
  await expect(page.locator('#project-summary')).toContainText('2 LilyPond files added.');
  await expect(page.locator('#project-summary')).not.toContainText('was not uploaded');
  await page.locator('#convert').click();
  await expect(page.locator('#results ul.results li')).toHaveCount(1, LONG);
  await expect(page.locator('#results')).not.toContainText('not found');
});

test('places flat-uploaded files where they are included from', async ({ page }) => {
  await openReady(page);
  const project = join(fixtures, 'folder-project');
  await page.locator('#file-input').setInputFiles([join(project, 'main.ly'), join(project, 'parts', 'voice.ily')]);
  const summary = page.locator('#project-summary');
  await expect(summary).toContainText('voice.ily was placed in parts/ because main.ly includes it from there.');
  await expect(summary).not.toContainText('was not uploaded');
  await page.locator('#convert').click();
  await expect(page.locator('#results ul.results li')).toHaveCount(1, LONG);
  await expect(page.locator('#results')).not.toContainText('not found');
  // The panel already placed the files, so the conversion has nothing left to report.
  await expect(page.locator('#results')).not.toContainText('was placed');
});
