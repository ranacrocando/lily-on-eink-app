import { getDevice, type Engine, type EngineRequest, type EngineResult } from '@lily-on-eink/core';
import { describe, expect, it } from 'vitest';
import { calibrationFileName, makeCalibration } from './calibration';

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function fakeEngine(result: EngineResult): Engine & { requests: EngineRequest[] } {
  const requests: EngineRequest[] = [];
  return {
    requests,
    lilypondVersion: () => Promise.resolve('2.26.0'),
    compile: (req) => {
      requests.push(req);
      return Promise.resolve(result);
    },
    dispose: () => undefined,
  };
}

describe('calibrationFileName', () => {
  it('uses the device name', () => {
    expect(calibrationFileName('Kobo Sage')).toBe('Calibration – Kobo Sage.pdf');
  });
});

describe('makeCalibration', () => {
  const kobo = getDevice('kobo-sage');

  it('compiles the calibration source to a PDF', async () => {
    const engine = fakeEngine({ ok: true, exitCode: 0, files: { 'calibration.pdf': pdf }, log: '' });
    const file = await makeCalibration(engine, kobo);
    expect(file).toEqual({ name: 'Calibration – Kobo Sage (2021).pdf', bytes: pdf });
    expect(engine.requests).toHaveLength(1);
    expect(engine.requests[0]?.formats).toEqual(['pdf']);
    expect(engine.requests[0]?.source).toContain('2.26.0');
  });

  it('fails with the log when LilyPond fails', async () => {
    const engine = fakeEngine({ ok: false, exitCode: 1, files: {}, log: 'boom' });
    await expect(makeCalibration(engine, kobo)).rejects.toThrow('boom');
  });

  it('fails when no PDF comes back', async () => {
    const engine = fakeEngine({ ok: true, exitCode: 0, files: {}, log: '' });
    await expect(makeCalibration(engine, kobo)).rejects.toThrow('could not draw');
  });
});
