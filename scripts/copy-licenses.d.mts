export interface LicenseEntry {
  file: string;
  package: string;
  license: string;
}
export interface LicenseIndex {
  appLicense: string;
  engine: { package: string; version: string; lilypond: string };
  files: LicenseEntry[];
}
export function pickLicenseFile(fileNames: string[]): string | undefined;
export function outputName(packageName: string, file: string): string;
export function packagesToCopy(
  dependencies: Record<string, string> | undefined,
  readDependencies?: (name: string) => Record<string, string> | undefined,
): string[];
export function buildIndex(files: LicenseEntry[], engineVersion: string, appLicense: string): LicenseIndex;
export function licenseOf(name: string, pkg: { license?: unknown }): string;
export function copyLicenses(root: string): number;
