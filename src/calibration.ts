import { calibrationSource, safeFileName, type DeviceSpec, type Engine } from '@lily-on-eink/core';

export const CALIBRATION_TIMEOUT_MS = 60_000;

export interface CalibrationFile {
  name: string;
  bytes: Uint8Array;
}

/** "Calibration – Kobo Sage.pdf", safe for FAT32 drives. */
export function calibrationFileName(deviceName: string): string {
  return `${safeFileName(`Calibration – ${deviceName}`)}.pdf`;
}

/** Compiles the calibration page of a device directly through the engine. Throws with the LilyPond log on failure. */
export async function makeCalibration(engine: Engine, device: DeviceSpec): Promise<CalibrationFile> {
  const source = calibrationSource(device, await engine.lilypondVersion());
  const result = await engine.compile({
    source,
    filename: 'calibration.ly',
    files: {},
    formats: ['pdf'],
    timeoutMs: CALIBRATION_TIMEOUT_MS,
  });
  const pdfName = Object.keys(result.files).find((n) => n.toLowerCase().endsWith('.pdf'));
  const bytes = pdfName ? result.files[pdfName] : undefined;
  if (!result.ok || !bytes) {
    throw new Error(
      `LilyPond could not draw the calibration page (exit code ${String(result.exitCode)}).\n${result.log}`,
    );
  }
  return { name: calibrationFileName(device.name), bytes };
}
