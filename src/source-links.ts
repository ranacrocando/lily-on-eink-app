const APP_REPO = 'https://github.com/ranacrocando/lily-on-eink-app';
const CORE_REPO = 'https://github.com/ranacrocando/lily-on-eink';

export interface BuildVersions {
  /** The release tag the build came from (`VITE_APP_VERSION`, e.g. "v0.1.0"); empty in development builds. */
  appTag: string | undefined;
  /** Version of the installed @lily-on-eink/core package. */
  coreVersion: string;
  /** Version of the installed @sightread/lilypond-wasm package. */
  engineVersion: string;
}

export interface SourceLink {
  text: string;
  href: string;
}

/** Where the corresponding source of this build is: the release asset of the engine source and the exact trees. */
export function sourceLinks(v: BuildVersions): { intro: string; links: SourceLink[] } {
  if (!v.appTag)
    return {
      intro:
        'This is a development build, not a release. Every release lists its complete corresponding source here; ' +
        'all releases and their source archives are on the releases page.',
      links: [{ text: 'Releases of this app', href: `${APP_REPO}/releases` }],
    };
  const tag = encodeURIComponent(v.appTag);
  const archive = `lily-on-eink-engine-source-${v.engineVersion}.tar`;
  return {
    intro:
      `This build is release ${v.appTag}. It contains GPL-licensed software, among it LilyPond compiled to ` +
      'WebAssembly. Its complete corresponding source:',
    links: [
      {
        text: `Source of the music engine and its libraries (${archive})`,
        href: `${APP_REPO}/releases/download/${tag}/${archive}`,
      },
      { text: `Source code of this app at ${v.appTag}`, href: `${APP_REPO}/tree/${tag}` },
      {
        text: `Source code of the conversion library at v${v.coreVersion}`,
        href: `${CORE_REPO}/tree/v${encodeURIComponent(v.coreVersion)}`,
      },
    ],
  };
}

/** Fills the corresponding-source section of the about page. */
export function renderSourceLinks(intro: HTMLElement, list: HTMLElement, v: BuildVersions): void {
  const { intro: text, links } = sourceLinks(v);
  intro.textContent = text;
  list.replaceChildren(
    ...links.map((link) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.text;
      li.append(a);
      return li;
    }),
  );
}
