# lily-on-eink-app

Converts LilyPond files to PDFs that fit the screen of your e-reader.

## Use it

Open [ranacrocando.github.io/lily-on-eink-app](https://ranacrocando.github.io/lily-on-eink-app/). Everything runs in your browser; your files never leave your computer.

The conversion logic (LilyPond overlay, device presets, genre profiles, Node API) lives in the core library [lily-on-eink](https://github.com/ranacrocando/lily-on-eink).

Minimum browsers: Chrome or Edge 116, Firefox 124, Safari 17.4. Older browsers show an "update your browser" notice.

## Development

The app needs the core repository [lily-on-eink](https://github.com/ranacrocando/lily-on-eink) in a sibling folder:

```sh
git clone https://github.com/ranacrocando/lily-on-eink.git ../lily-on-eink
(cd ../lily-on-eink && npm ci && npm run build)
npm install      # copies the two core packages (.npmrc: install-links=true)
npm run dev
```

After a change in core, rebuild it, delete `node_modules/@lily-on-eink` and run `npm install` again. `core-ref.txt` pins the core commit that CI builds against (secret `CORE_REPO_TOKEN`).

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Browser tests: run `npx playwright install chromium` once, then `npx playwright test`. The parity test uses a hook that exists only when the page is opened with `?test`.

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
