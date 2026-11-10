# lily-on-eink-app

Convert LilyPond files to PDFs that fit the size and aspect ratio of your e-reader, online.
Everything runs in your browser: your files never leave your computer.

## Browser support

Chrome or Edge 116, Firefox 124, Safari 17.4 or newer. Older browsers show an "update your browser" notice.

## Local development

The app uses the core library from the sibling repository `lily-on-eink`; both folders must sit next to each other:

```sh
git clone <lily-on-eink> ../lily-on-eink
(cd ../lily-on-eink && npm ci && npm run build)
npm install      # installs the two core packages as copies (.npmrc: install-links=true)
npm run dev
```

After a change in core: rebuild core, delete `node_modules/@lily-on-eink` and run `npm install` again in this folder (npm does not re-copy an unchanged `file:` dependency).
`core-ref.txt` holds the core commit the app is built against; CI checks out core at that commit
and needs the secret `CORE_REPO_TOKEN` (read access to the core repository), stored both as an Actions secret and as a Dependabot secret (Dependabot PRs do not get Actions secrets).

Useful scripts: `npm run lint`, `npm run format`, `npm run typecheck`, `npm test`, `npm run build`
(then `node scripts/check-build.mjs`), `npm run preview`.

## License

GPL-3.0-or-later, see [LICENSE](LICENSE). The LilyPond engine is bundled under its own licenses.
