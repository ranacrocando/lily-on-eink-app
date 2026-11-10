export interface ExtraArchive {
  folder: string;
  name: string;
  url: string;
  sha256: string;
  requires: string;
}
export const EXTRA_ARCHIVES: ExtraArchive[];
export const TAR_OPTIONS: { portable: boolean; mtime: Date; noDirRecurse: boolean };
export function sha256(bytes: Uint8Array): string;
export function verifySha256(name: string, bytes: Uint8Array, expected: string): void;
export function verifyIntegrity(name: string, bytes: Uint8Array, integrity: string): void;
export function lockedIntegrity(
  lock: { packages?: Record<string, { version?: string; integrity?: string }> },
  name: string,
  version: string,
): string;
export function readProducers(bytes: Uint8Array): Record<string, [string, string][]>;
export function toolchainText(producers: Record<string, [string, string][]>): string;
export function writePortableTar(cwd: string, files: string[], out: string): void;
export function readmeSource(info: {
  engineVersion: string;
  packFile: string;
  integrity: string;
  appVersion: string;
  coreVersion: string;
  toolchain: string;
  archives: { path: string; url: string; sha256: string }[];
}): string;
export function collectEngineSource(root: string, outDir: string): Promise<string>;
