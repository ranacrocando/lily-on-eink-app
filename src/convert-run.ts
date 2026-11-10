import {
  convert,
  type ConvertOptions,
  type ConvertResult,
  type Engine,
  type Progress,
  type ProjectFile,
} from '@lily-on-eink/core';
import type { Resolved } from './settings';

export const TIMEOUT_MS = 60_000;

export interface RunInput {
  files: ProjectFile[];
  settings: Resolved;
  mainFiles: string[];
  signal: AbortSignal;
  onProgress?: (p: Progress) => void;
}

export interface RunOutcome {
  result: ConvertResult;
  /** True after a cancel or timeout: the engine's worker was stopped, so the engine must be loaded again. */
  engineReset: boolean;
  cancelled: boolean;
}

const isAbort = (message: string) => message.startsWith('conversion aborted');
const isTimeout = (message: string) => message.includes('timed out');

/** Converts the selected main files to PDFs. Does not reload the engine itself: see `engineReset`. */
export async function runConversion(input: RunInput, engine: Engine): Promise<RunOutcome> {
  const { settings } = input;
  const options: ConvertOptions = {
    device: settings.device,
    profile: settings.profile.id,
    mainFiles: input.mainFiles,
    outputs: ['pdf'],
    signal: input.signal,
    timeoutMs: TIMEOUT_MS,
  };
  if (settings.staffSizeOverride !== undefined) options.staffSize = settings.staffSizeOverride;
  if (input.onProgress) options.onProgress = input.onProgress;

  const result = await convert(input.files, options, engine);
  const cancelled = input.signal.aborted;
  const engineReset = cancelled || result.diagnostics.some((d) => isAbort(d.message) || isTimeout(d.message));
  if (cancelled) {
    // The user knows they cancelled; do not show it as an error.
    result.diagnostics = result.diagnostics.filter((d) => !isAbort(d.message));
  } else {
    // Only without a user cancel: after a cancel the timeout message is hidden together with the abort messages.
    result.diagnostics = result.diagnostics.map((d) =>
      isTimeout(d.message)
        ? {
            ...d,
            file: '',
            message: `${d.file} took longer than ${String(TIMEOUT_MS / 1000)} seconds and was stopped.`,
          }
        : d,
    );
  }
  return { result, engineReset, cancelled };
}

/** "Converting 2 of 5: song.ly" */
export function progressText(p: Progress): string {
  return `Converting ${String(p.index + 1)} of ${String(p.total)}: ${p.mainFile}`;
}
