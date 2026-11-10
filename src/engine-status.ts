import { byId } from './dom';

export interface EngineStatus {
  isReady(): boolean;
  /** True when loading failed; only a page reload helps. */
  isFailed(): boolean;
  /** Loads the engine (again) and shows the progress bar until it is ready. Does nothing while a load is running. */
  load(): Promise<void>;
}

/** Shows the engine's loading progress in the status area; `onChange` runs when the engine becomes ready or not. */
export function initEngineStatus(onChange: () => void): EngineStatus {
  const text = byId('engine-text', HTMLElement);
  const bar = byId('engine-progress', HTMLProgressElement);
  let ready = false;
  let failed = false;
  let loadedBefore = false;
  let loading: Promise<void> | undefined;

  async function run(): Promise<void> {
    ready = false;
    failed = false;
    onChange();
    text.textContent = loadedBefore ? 'Restarting the music engine…' : 'Loading the music engine (30 MB, once)…';
    loadedBefore = true;
    bar.removeAttribute('value');
    bar.removeAttribute('max');
    bar.hidden = false;
    try {
      // Inside the try: a failed chunk load must show the error message instead of hanging.
      const { loadEngine } = await import('./engine');
      const version = await loadEngine(
        ({ loadedBytes, totalBytes }) => {
          if (totalBytes > 0) {
            bar.max = totalBytes;
            bar.value = loadedBytes;
          }
        },
        () => {
          text.textContent = 'Preparing…';
          bar.removeAttribute('value');
          bar.removeAttribute('max');
        },
      );
      bar.hidden = true;
      text.textContent = `Ready – LilyPond ${version}`;
      ready = true;
    } catch (error) {
      bar.hidden = true;
      failed = true;
      text.textContent = 'The music engine could not be loaded. Please reload the page.';
      console.error(error);
    }
    onChange();
  }

  return {
    isReady: () => ready,
    isFailed: () => failed,
    load: () => {
      loading ??= run().finally(() => {
        loading = undefined;
      });
      return loading;
    },
  };
}
