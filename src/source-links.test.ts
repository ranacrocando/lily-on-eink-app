// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderSourceLinks, sourceLinks } from './source-links';

const versions = { appTag: 'v0.1.0', coreVersion: '0.1.0', engineVersion: '0.2.0' };

describe('sourceLinks', () => {
  it('links the source asset of the release and the exact trees', () => {
    expect(sourceLinks(versions).links.map((l) => l.href)).toEqual([
      'https://github.com/ranacrocando/lily-on-eink-app/releases/download/v0.1.0/lily-on-eink-engine-source-0.2.0.tar',
      'https://github.com/ranacrocando/lily-on-eink-app/tree/v0.1.0',
      'https://github.com/ranacrocando/lily-on-eink/tree/v0.1.0',
    ]);
  });
  it('points development builds to the releases page', () => {
    for (const appTag of [undefined, '']) {
      const { intro, links } = sourceLinks({ ...versions, appTag });
      expect(intro).toContain('development build');
      expect(links).toEqual([
        { text: 'Releases of this app', href: 'https://github.com/ranacrocando/lily-on-eink-app/releases' },
      ]);
    }
  });
  it('renders the intro and one link per entry', () => {
    const intro = document.createElement('p');
    const list = document.createElement('ul');
    renderSourceLinks(intro, list, versions);
    expect(intro.textContent).toContain('release v0.1.0');
    expect(list.querySelectorAll('li a')).toHaveLength(3);
  });
});
