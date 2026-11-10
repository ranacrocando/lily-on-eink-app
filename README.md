# lily-on-eink-app

Converts LilyPond files to PDFs that fit the screen of your e-reader.

## Use it

Open https://ranacrocando.github.io/lily-on-eink-app/. Everything runs in your browser; your files never leave your computer.

The conversion logic (LilyPond overlay, device presets, genre profiles, Node API) lives in the core library: https://github.com/ranacrocando/lily-on-eink

Minimum browsers: Chrome or Edge 116, Firefox 124, Safari 17.4. Older browsers show an "update your browser" notice.

## Development

The app needs the core repository `lily-on-eink` in a sibling folder:

```sh
git clone <lily-on-eink> ../lily-on-eink
(cd ../lily-on-eink && npm ci && npm run build)
npm install      # copies the two core packages (.npmrc: install-links=true)
npm run dev
```

After a change in core, rebuild it, delete `node_modules/@lily-on-eink` and run `npm install` again. `core-ref.txt` pins the core commit that CI builds against (secret `CORE_REPO_TOKEN`).

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Browser tests: run `npx playwright install chromium` once, then `npx playwright test`. The parity test uses a hook that exists only when the page is opened with `?test`.

## License

GPL-3.0-or-later, see [LICENSE](LICENSE). Bundled third-party licenses are listed on the app's About page.
