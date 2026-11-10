# lily-on-eink-app

Converts LilyPond files to PDFs that fit the screen of your e-reader.

## Use it

Open [ranacrocando.github.io/lily-on-eink-app](https://ranacrocando.github.io/lily-on-eink-app/). Everything runs in your browser; your files never leave your computer.

The conversion logic (LilyPond overlay, device presets, genre profiles, Node API) lives in the core library [lily-on-eink](https://github.com/ranacrocando/lily-on-eink).

Minimum browsers: Chrome or Edge 116, Firefox 124, Safari 17.4. Older browsers show an "update your browser" notice.

## Development

```sh
npm ci
npm run dev
```

Developing against a local core: temporarily set the two dependencies to `file:../lily-on-eink/packages/core` and `file:../lily-on-eink/packages/engine-wasm`, run `npm install` and do not commit it.

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Browser tests: run `npx playwright install chromium` once, then `npx playwright test`. The parity test uses a hook that exists only when the page is opened with `?test`.

## Releases

Publishing a release with tag `vX.Y.Z` (the `package.json` version) attaches the corresponding source of the bundled LilyPond engine (`lily-on-eink-engine-source-<engine version>.tar`) and then deploys the app to GitHub Pages; the About page links that asset. GPLv3 §6(d) requires this source to stay available: **never delete a release whose build was deployed, nor its source asset.**

## Branch ruleset

The rules for `main` (pull requests only, squash merge, required checks `check` and `title`, no force push, no deletion, linear history) are in `.github/rulesets/main.json`. Rulesets only take effect on public repos (free plan).

```sh
# create (once; repeating it makes duplicates)
gh api -X POST repos/ranacrocando/lily-on-eink-app/rulesets --input .github/rulesets/main.json
# find the id
gh api repos/ranacrocando/lily-on-eink-app/rulesets
# update later
gh api -X PUT repos/ranacrocando/lily-on-eink-app/rulesets/<id> --input .github/rulesets/main.json
```

## License

GPL-3.0-or-later, see [LICENSE](LICENSE). Bundled third-party licenses are listed on the app's About page.
