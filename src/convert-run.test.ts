import type { Engine, EngineRequest, EngineResult, Progress } from '@lily-on-eink/core';
import { describe, expect, it } from 'vitest';
import { progressText, runConversion } from './convert-run';
import { DEFAULT_SETTINGS, resolve } from './settings';

function resolved(delta = 0) {
  const r = resolve({ ...DEFAULT_SETTINGS, noteSizeDelta: delta });
  if (!r) throw new Error('settings do not resolve');
  return r;
}
const settings = resolved();
const score = String.raw`\score { c }`;
const files = [
  { path: 'a.ly', content: score },
  { path: 'b.ly', content: score },
];
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function engineWith(compile: (req: EngineRequest) => Promise<EngineResult>): Engine & { requests: EngineRequest[] } {
  const requests: EngineRequest[] = [];
  return {
    requests,
    lilypondVersion: () => Promise.resolve('2.24.4'),
    compile: (req) => {
      requests.push(req);
      return compile(req);
    },
    dispose: () => undefined,
  };
}

const ok: EngineResult = { ok: true, exitCode: 0, files: { 'score.pdf': pdf }, log: '' };

describe('runConversion', () => {
  it('converts the selected files and reports progress', async () => {
    const engine = engineWith(() => Promise.resolve(ok));
    const seen: Progress[] = [];
    const outcome = await runConversion(
      {
        files,
        settings,
        mainFiles: ['a.ly', 'b.ly'],
        signal: new AbortController().signal,
        onProgress: (p) => seen.push(p),
      },
      engine,
    );
    expect(outcome.result.outputs.map((o) => o.mainFile)).toEqual(['a.ly', 'b.ly']);
    expect(outcome.engineReset).toBe(false);
    expect(outcome.cancelled).toBe(false);
    expect(engine.requests[0]?.formats).toEqual(['pdf']);
    expect(engine.requests[0]?.timeoutMs).toBe(60_000);
    expect(progressText({ mainFile: 'b.ly', index: 1, total: 2, phase: 'compiling' })).toBe('Converting 2 of 2: b.ly');
  });

  it('converts only the selected main files', async () => {
    const engine = engineWith(() => Promise.resolve(ok));
    const outcome = await runConversion(
      { files, settings, mainFiles: ['b.ly'], signal: new AbortController().signal },
      engine,
    );
    expect(outcome.result.outputs.map((o) => o.mainFile)).toEqual(['b.ly']);
  });

  it('passes the staff size only when the note size was changed', async () => {
    const engine = engineWith(() => Promise.resolve(ok));
    const run = (s: typeof settings) =>
      runConversion({ files, settings: s, mainFiles: ['a.ly'], signal: new AbortController().signal }, engine);
    await run(settings);
    await run(resolved(3));
    const [plain, bigger] = engine.requests.map((r) => /set-global-staff-size ([0-9.]+)\)/.exec(r.source)?.[1]);
    expect(plain).toBeDefined();
    expect(Number(bigger)).toBe(Number(plain) + 3);
  });

  it('returns diagnostics and the log of a failed file', async () => {
    const log = 'a.ly:3:1: error: syntax error\n';
    const engine = engineWith(() => Promise.resolve({ ok: false, exitCode: 1, files: {}, log }));
    const outcome = await runConversion(
      { files, settings, mainFiles: ['a.ly'], signal: new AbortController().signal },
      engine,
    );
    expect(outcome.result.outputs).toEqual([]);
    expect(outcome.result.diagnostics.some((d) => d.severity === 'error' && d.line === 3)).toBe(true);
    expect(outcome.result.logs['a.ly']).toContain('syntax error');
    expect(outcome.engineReset).toBe(false);
  });

  it('asks for an engine reload after a cancel during a compile', async () => {
    const controller = new AbortController();
    const engine = engineWith(
      (req) =>
        new Promise((resolve) => {
          req.signal?.addEventListener('abort', () => {
            resolve({ ok: false, exitCode: 1, files: {}, log: '', aborted: true });
          });
          controller.abort();
        }),
    );
    const outcome = await runConversion(
      { files, settings, mainFiles: ['a.ly', 'b.ly'], signal: controller.signal },
      engine,
    );
    expect(outcome.cancelled).toBe(true);
    expect(outcome.engineReset).toBe(true);
    expect(outcome.result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(engine.requests).toHaveLength(1);
  });

  it('asks for an engine reload after a timeout and keeps the message', async () => {
    const engine = engineWith(() => Promise.resolve({ ok: false, exitCode: 1, files: {}, log: '', aborted: true }));
    const outcome = await runConversion(
      { files, settings, mainFiles: ['a.ly'], signal: new AbortController().signal },
      engine,
    );
    expect(outcome.cancelled).toBe(false);
    expect(outcome.engineReset).toBe(true);
    expect(outcome.result.diagnostics.map((d) => d.message)).toContain(
      'a.ly took longer than 60 seconds and was stopped.',
    );
  });
});
