import { describe, expect, it } from 'vitest';
import { createLatest } from './latest';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createLatest', () => {
  it('drops the result of an older load that finishes last', async () => {
    const applied: string[] = [];
    const run = createLatest<string>(
      (v) => applied.push(v),
      () => undefined,
    );
    const slow = deferred<string>();
    const fast = deferred<string>();
    const first = run(slow.promise);
    const second = run(fast.promise);
    fast.resolve('new');
    slow.resolve('old');
    await Promise.all([first, second]);
    expect(applied).toEqual(['new']);
  });

  it('drops the error of an older load', async () => {
    const errors: unknown[] = [];
    const run = createLatest<string>(
      () => undefined,
      (e) => errors.push(e),
    );
    const slow = deferred<string>();
    const first = run(slow.promise);
    const second = run(Promise.resolve('new'));
    slow.reject(new Error('old'));
    await Promise.all([first, second]);
    expect(errors).toEqual([]);
  });

  it('reports the error of the newest load', async () => {
    const errors: unknown[] = [];
    const run = createLatest<string>(
      () => undefined,
      (e) => errors.push(e),
    );
    await run(Promise.reject(new Error('boom')));
    expect(errors).toHaveLength(1);
  });
});
