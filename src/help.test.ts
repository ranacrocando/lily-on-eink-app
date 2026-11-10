// @vitest-environment happy-dom
import { listDevices } from '@lily-on-eink/core';
import { describe, expect, it } from 'vitest';
import { renderHelp, transferHelp } from './help';

describe('transferHelp', () => {
  it('knows every preset device family', () => {
    for (const d of listDevices()) expect(transferHelp(d.id).family, d.id).not.toBe('Other e-readers');
  });
  it('picks by id prefix', () => {
    expect(transferHelp('kobo-sage').family).toBe('Kobo');
    expect(transferHelp('kindle-scribe').family).toBe('Kindle');
    expect(transferHelp('pocketbook-era').family).toBe('PocketBook');
    expect(transferHelp('remarkable-2').family).toBe('reMarkable');
    expect(transferHelp('boox-note-air3').family).toBe('Boox');
    expect(transferHelp('custom').family).toBe('Other e-readers');
  });
  it('tells Kindle users to use USB and the documents folder', () => {
    const text = transferHelp('kindle-scribe').steps.join(' ');
    expect(text).toContain('"documents" folder');
    expect(text).toContain('Send to Kindle');
    expect(text).toContain("don't choose the option to convert");
    expect(text).toContain('library');
  });
  it('mentions the e-mail route for PocketBook and the web interface for reMarkable', () => {
    expect(transferHelp('pocketbook-era').steps.join(' ')).toContain('Send-to-PocketBook');
    expect(transferHelp('remarkable-2').steps.join(' ')).toContain('USB web interface');
    expect(transferHelp('remarkable-2').steps.join(' ')).toContain('http://10.11.99.1');
    expect(transferHelp('boox-note-air3').steps.join(' ')).toContain('File transfer');
  });
});

describe('renderHelp', () => {
  it('renders a heading and numbered steps', () => {
    const body = document.createElement('div');
    renderHelp(body, 'kobo-sage');
    expect(body.querySelector('h3')?.textContent).toBe('Kobo');
    expect(body.querySelectorAll('ol > li')).toHaveLength(transferHelp('kobo-sage').steps.length);
  });
});
