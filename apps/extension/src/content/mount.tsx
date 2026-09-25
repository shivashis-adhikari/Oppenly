import { render } from 'preact';
import { Controller } from './controller';
import { App } from './ui/App';

const HOST_STYLE = [
  'position: fixed !important',
  'top: 0 !important',
  'left: 0 !important',
  'width: 0 !important',
  'height: 0 !important',
  'overflow: visible !important',
  'display: block !important',
  'z-index: 2147483647 !important',
  'pointer-events: none !important',
  'transform: none !important',
  'filter: none !important',
  'contain: none !important',
].join(';');

/**
 * Mount Oppenly's in-page layer into `container` (inside a shadow root owned by `host`).
 * Returns a function that tears everything down.
 */
export function mountOverlay(container: HTMLElement, host: HTMLElement): () => void {
  host.style.cssText = HOST_STYLE;
  host.setAttribute('data-theme', 'light');
  const mirrors = document.createElement('div');
  mirrors.setAttribute('aria-hidden', 'true');
  const root = document.createElement('div');
  container.append(mirrors, root);
  render(<App />, root);
  const controller = new Controller(mirrors, host);
  void controller.start();
  return () => {
    controller.stop();
    render(null, root);
    mirrors.remove();
    root.remove();
  };
}
