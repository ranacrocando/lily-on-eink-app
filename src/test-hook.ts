import { analyzeProject, convert } from '@lily-on-eink/core';
import { getEngine } from './engine';

/** A source file as plain text, so that it can be passed in from a test. */
export interface HookFile {
  path: string;
  text: string;
}

declare global {
  interface Window {
    __lilyOnEink?: {
      convertPng: (files: HookFile[], deviceId: string, profileId: string) => Promise<string>;
    };
  }
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/** Converts to PNG with the app's engine and returns the first page as base64. Only installed with `?test`. */
export function installTestHook(): void {
  window.__lilyOnEink = {
    convertPng: async (files, deviceId, profileId) => {
      const encoder = new TextEncoder();
      const texts = Object.fromEntries(files.map((f) => [f.path, f.text]));
      const result = await convert(
        files.map((f) => ({ path: f.path, content: encoder.encode(f.text) })),
        { device: deviceId, profile: profileId, mainFiles: analyzeProject(texts).mainFiles, outputs: ['png'] },
        getEngine(),
      );
      const png = result.outputs[0]?.pngPages?.[0];
      if (!png) throw new Error(`no PNG: ${result.diagnostics.map((d) => d.message).join('; ')}`);
      return toBase64(png);
    },
  };
}
