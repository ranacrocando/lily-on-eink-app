/**
 * Runs asynchronous loads where only the newest one counts: when an older load finishes after a newer one
 * was started, its result is dropped (`apply` is not called).
 */
export function createLatest<T>(
  apply: (value: T) => void,
  fail: (error: unknown) => void,
): (load: Promise<T>) => Promise<void> {
  let generation = 0;
  return async (load) => {
    const mine = ++generation;
    try {
      const value = await load;
      if (mine === generation) apply(value);
    } catch (error) {
      if (mine === generation) fail(error);
    }
  };
}
