import './styles.css';
import { byId } from './dom';
import { isSupported, MINIMUM_BROWSERS } from './support';

const app = byId('app', HTMLElement);

async function start(): Promise<void> {
  const text = byId('engine-text', HTMLElement);
  const bar = byId('engine-progress', HTMLProgressElement);
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
  } catch (error) {
    bar.hidden = true;
    text.textContent = 'The music engine could not be loaded. Please reload the page.';
    console.error(error);
  }
}

if (isSupported()) {
  void start();
} else {
  const p = document.createElement('p');
  p.textContent = `Please update your browser. This app needs ${MINIMUM_BROWSERS} or newer.`;
  app.replaceChildren(p);
}
